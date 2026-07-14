import hashlib
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.preprocessor import get_trigrams, get_sentences

_model = None
# In-process embedding cache: md5(raw_text) → np.ndarray
_embedding_cache: dict = {}


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


# ── TF-IDF + cosine (lexical) ───────────────────────────────
def tfidf_score(doc1_clean: str, docs_clean: list) -> list:
    all_docs = [doc1_clean] + docs_clean
    vectorizer = TfidfVectorizer(min_df=1, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(all_docs)
    scores = cosine_similarity(matrix[0:1], matrix[1:])
    return scores[0].tolist()


# ── Word trigrams (containment) ─────────────────────────────
def _trigram_pair(doc1_clean: str, doc2_clean: str) -> float:
    t1 = get_trigrams(doc1_clean)
    t2 = get_trigrams(doc2_clean)
    if not t1 or not t2:
        return 0.0
    common = len(t1 & t2)
    return max(common / len(t1), common / len(t2))


def trigram_score(doc1_clean: str, docs_clean: list) -> list:
    return [_trigram_pair(doc1_clean, d) for d in docs_clean]


trigram_scores = trigram_score


def get_matched_phrases(doc1_clean: str, doc2_clean: str, limit: int = 20) -> list:
    common = get_trigrams(doc1_clean) & get_trigrams(doc2_clean)
    return [" ".join(tg) for tg in list(common)[:limit]]


# ── Sentence-BERT (semantic) — batched + cached ─────────────
def _content_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()


def _doc_embedding(model, raw_text: str) -> np.ndarray:
    """Embed a document by mean-pooling its sentence vectors.
    Caches results by content hash — repeated calls for the same text
    return instantly without re-encoding."""
    h = _content_hash(raw_text)
    if h in _embedding_cache:
        return _embedding_cache[h]
    sents = get_sentences(raw_text)
    if not sents:
        sents = [raw_text.strip()[:1000] or " "]
    emb = model.encode(sents, convert_to_numpy=True, normalize_embeddings=True,
                       batch_size=64, show_progress_bar=False)
    result = emb.mean(axis=0)
    _embedding_cache[h] = result
    return result


def sbert_scores(doc1_raw: str, docs_raw: list) -> list:
    """Compute SBERT semantic similarity. Encodes ALL uncached documents
    in a single batched model.encode() call for maximum speed."""
    model = get_model()
    all_raws = [doc1_raw] + docs_raw
    hashes   = [_content_hash(r) for r in all_raws]

    # Identify uncached docs
    uncached_idx = [i for i, h in enumerate(hashes) if h not in _embedding_cache]

    if uncached_idx:
        # Collect sentences from every uncached document
        all_sents: list = []
        sent_bounds: list = []
        for i in uncached_idx:
            sents = get_sentences(all_raws[i]) or [all_raws[i].strip()[:1000] or " "]
            start = len(all_sents)
            all_sents.extend(sents)
            sent_bounds.append((start, len(all_sents)))

        # ONE batched encode call for all outstanding sentences
        all_embs = model.encode(all_sents, convert_to_numpy=True,
                                normalize_embeddings=True, batch_size=64,
                                show_progress_bar=False)

        # Mean-pool per document and store in cache
        for idx, (start, end) in zip(uncached_idx, sent_bounds):
            emb = all_embs[start:end].mean(axis=0)
            _embedding_cache[hashes[idx]] = emb

    embeddings = [_embedding_cache[h] for h in hashes]
    e1 = embeddings[0]
    out = []
    for e2 in embeddings[1:]:
        denom = (np.linalg.norm(e1) * np.linalg.norm(e2)) or 1.0
        out.append(float(np.dot(e1, e2) / denom))
    return out


# ── Auto-grading ────────────────────────────────────────────
def auto_grade_doc(submission_text: str, criteria_text: str, max_marks: int = 100) -> float:
    """Score a submission by measuring semantic alignment with each criterion item.

    Strategy:
    - Split the criteria into individual rubric lines
    - Embed the submission once (cached)
    - Embed each criterion item (cached)
    - Average the cosine similarities and scale to max_marks
    """
    model = get_model()

    # Split criteria into individual rubric items
    raw_items = re.split(r"\n+|\r+|\d+[.)]\s*|-\s+|;\s*", criteria_text)
    criteria_items = [item.strip() for item in raw_items
                      if item.strip() and len(item.strip()) > 5]
    if not criteria_items:
        criteria_items = [criteria_text.strip()]

    sub_emb = _doc_embedding(model, submission_text)

    item_scores = []
    for item in criteria_items:
        h = _content_hash(item)
        if h not in _embedding_cache:
            emb = model.encode([item], convert_to_numpy=True,
                               normalize_embeddings=True, show_progress_bar=False)[0]
            _embedding_cache[h] = emb
        crit_emb = _embedding_cache[h]
        norm = (np.linalg.norm(sub_emb) * np.linalg.norm(crit_emb)) or 1.0
        sim = float(np.dot(sub_emb, crit_emb) / norm)
        item_scores.append(max(0.0, sim))

    avg_sim = sum(item_scores) / len(item_scores) if item_scores else 0.0
    # SBERT cosine similarity is conservative; calibrate so a well-aligned
    # submission (~0.55 raw) maps near 100 %.  Clamp at max_marks.
    calibrated = min(1.0, avg_sim / 0.55)
    return round(calibrated * max_marks, 1)


# ── Orchestration ───────────────────────────────────────────
def compare_documents(doc1: dict, others: list) -> list:
    doc1_clean = doc1["clean_text"]
    doc1_raw   = doc1["raw_text"]

    other_clean = [d["clean_text"] for d in others]
    other_raw   = [d["raw_text"]   for d in others]

    tf_scores = tfidf_score(doc1_clean, other_clean)
    tg_scores = trigram_score(doc1_clean, other_clean)
    sb_scores = sbert_scores(doc1_raw, other_raw)

    results = []
    for i, doc in enumerate(others):
        tf    = round(max(tf_scores[i], 0.0) * 100, 1)
        tg    = round(max(tg_scores[i], 0.0) * 100, 1)
        sb    = round(max(sb_scores[i], 0.0) * 100, 1)
        final = round(0.5 * tf + 0.3 * tg + 0.2 * sb, 1)
        risk  = "High" if final >= 70 else ("Medium" if final >= 40 else "Low")
        phrases = get_matched_phrases(doc1_clean, doc["clean_text"])
        results.append({
            "document_id":     doc.get("id"),
            "filename":        doc["filename"],
            "student_name":    doc["student_name"],
            "matric_no":       doc["matric_no"],
            "program":         doc["program"],
            "tfidf_score":     tf,
            "trigram_score":   tg,
            "sbert_score":     sb,
            "final_score":     final,
            "risk_level":      risk,
            "matched_phrases": phrases,
        })

    return sorted(results, key=lambda x: x["final_score"], reverse=True)
