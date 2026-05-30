from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.preprocessor import get_trigrams, get_sentences
import numpy as np

_model = None


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
    matrix = vectorizer.fit_transform(all_docs)        # fit on the whole batch
    scores = cosine_similarity(matrix[0:1], matrix[1:])
    return scores[0].tolist()


# ── Word trigrams (containment, not Jaccard) ────────────────
def _trigram_pair(doc1_clean: str, doc2_clean: str) -> float:
    t1 = get_trigrams(doc1_clean)
    t2 = get_trigrams(doc2_clean)
    if not t1 or not t2:
        return 0.0
    common = len(t1 & t2)
    # Containment catches partial copying that Jaccard dilutes when one
    # document is much longer than the other. Take the stronger direction.
    return max(common / len(t1), common / len(t2))


def trigram_score(doc1_clean: str, docs_clean: list) -> list:
    return [_trigram_pair(doc1_clean, d) for d in docs_clean]


# Backwards-compatible alias (older tests imported the plural name).
trigram_scores = trigram_score


def get_matched_phrases(doc1_clean: str, doc2_clean: str, limit: int = 20) -> list:
    common = get_trigrams(doc1_clean) & get_trigrams(doc2_clean)
    return [" ".join(tg) for tg in list(common)[:limit]]


# ── Sentence-BERT (semantic) ────────────────────────────────
def _doc_embedding(model, raw_text: str) -> np.ndarray:
    """Embed the whole document by mean-pooling its sentence vectors.
    Avoids the old 5000-char truncation that ignored most of long files."""
    sents = get_sentences(raw_text)
    if not sents:
        sents = [raw_text.strip()[:1000] or " "]
    emb = model.encode(sents, convert_to_numpy=True, normalize_embeddings=True)
    return emb.mean(axis=0)


def sbert_scores(doc1_raw: str, docs_raw: list) -> list:
    model = get_model()
    e1 = _doc_embedding(model, doc1_raw)        # encode primary doc ONCE
    out = []
    for d in docs_raw:
        e2 = _doc_embedding(model, d)
        denom = (np.linalg.norm(e1) * np.linalg.norm(e2)) or 1.0
        out.append(float(np.dot(e1, e2) / denom))
    return out


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
