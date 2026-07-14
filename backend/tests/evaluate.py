"""
evaluate.py  -  Detection evaluation for the Assignment Similarity Engine (ASE)

Place this file in  backend/tests/  (next to test_engine.py) and run it from the
backend/ directory so that the `app` package is importable:

    cd similarity-engine/backend
    python tests/evaluate.py --init            # 1. scaffold an eval_data/ folder
    #   ... fill eval_data/docs/ and eval_data/manifest.csv with your pairs ...
    python tests/evaluate.py                    # 2. run the evaluation

What it produces (all mapped to the report's Chapter 4 tables):
  * metrics_by_config.csv   -> Table 4.9  (precision / recall / F1 per technique)
  * detection_by_category   -> Table 4.8  (detection rate, i.e. recall, per category)
  * threshold_sweep.csv     -> supports the choice of operating threshold
  * results_pairs.csv       -> the raw per-pair scores (audit trail / appendix)

It evaluates FOUR configurations on the SAME labelled pairs and the SAME
threshold so the comparison is fair:
    TF-IDF only | Trigram only | SBERT only | Hybrid (0.5/0.3/0.2)

------------------------------------------------------------------------------
manifest.csv format (one row per document pair):

    primary,target,category,label
    src01.txt,copy01.txt,verbatim,1
    src01.txt,para01.txt,heavy_paraphrase,1
    src02.txt,unrel01.txt,unrelated,0

  - primary / target : file names located inside the docs/ folder
  - category         : any label you like; rows are grouped by it for Table 4.8
  - label            : 1 = the pair IS similar (positive), 0 = NOT similar
------------------------------------------------------------------------------
"""

import argparse
import csv
import os
import shutil
import sys

# --- make the `app` package importable when run as `python tests/evaluate.py` ---
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Fusion weights and risk bands — keep these identical to similarity.py.
W_TFIDF, W_TRIGRAM, W_SBERT = 0.5, 0.3, 0.2
HIGH, MEDIUM = 70.0, 40.0


# ---------------------------------------------------------------------------
# Engine adapters.  These wrap the real functions in app/ so the rest of the
# script does not depend on their exact names.  If your function names differ,
# this is the ONLY place you need to edit.
# ---------------------------------------------------------------------------
def load_engine(use_sbert=True):
    from app.preprocessor import clean_text

    from app.similarity import tfidf_score          # (doc1_clean, docs_clean) -> [0..1]

    # trigram: prefer a list wrapper, otherwise build one from the pairwise fn
    try:
        from app.similarity import trigram_scores as _tg_list   # (clean, [clean]) -> [0..1]
    except ImportError:
        try:
            from app.similarity import _trigram_pair
            def _tg_list(primary_clean, others_clean):
                return [_trigram_pair(primary_clean, o) for o in others_clean]
        except ImportError:
            from app.similarity import trigram_score
            def _tg_list(primary_clean, others_clean):
                return [trigram_score(primary_clean, o) for o in others_clean]

    if use_sbert:
        from app.similarity import sbert_scores      # (doc1_raw, docs_raw) -> [0..1]
    else:
        def sbert_scores(primary_raw, others_raw):
            return [0.0] * len(others_raw)

    return clean_text, tfidf_score, _tg_list, sbert_scores


def load_text(path):
    """Read a document's raw text. Uses the project parser for pdf/docx."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".pdf", ".docx"):
        try:
            from app.parser import extract_text
            return extract_text(path)
        except Exception as e:
            raise RuntimeError(f"Could not parse {path}: {e}")
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        return fh.read()


# ---------------------------------------------------------------------------
# Metrics helpers
# ---------------------------------------------------------------------------
def prf(tp, fp, fn):
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return precision, recall, f1


def confusion(rows, score_key, threshold):
    """Aggregate TP/FP/FN/TN for one configuration at a given threshold."""
    tp = fp = fn = tn = 0
    for r in rows:
        predicted = r[score_key] >= threshold
        positive = r["label"] == 1
        if predicted and positive:
            tp += 1
        elif predicted and not positive:
            fp += 1
        elif not predicted and positive:
            fn += 1
        else:
            tn += 1
    return tp, fp, fn, tn


# ---------------------------------------------------------------------------
# Core scoring
# ---------------------------------------------------------------------------
def clamp(x):
    return max(0.0, min(100.0, x))


def score_pairs(pairs, docs_dir, use_sbert=True):
    """Compute the four scores for every pair. Groups by primary for efficiency."""
    clean_text, tfidf_score, tg_list, sbert_scores = load_engine(use_sbert)

    # cache raw + clean text per file so each document is read/cleaned once
    raw_cache, clean_cache = {}, {}

    def get_raw(name):
        if name not in raw_cache:
            raw_cache[name] = load_text(os.path.join(docs_dir, name))
        return raw_cache[name]

    def get_clean(name):
        if name not in clean_cache:
            clean_cache[name] = clean_text(get_raw(name))
        return clean_cache[name]

    # group targets by their primary document
    groups = {}
    for p in pairs:
        groups.setdefault(p["primary"], []).append(p)

    results = []
    for primary, group in groups.items():
        targets = [g["target"] for g in group]
        p_clean, p_raw = get_clean(primary), get_raw(primary)
        t_clean = [get_clean(t) for t in targets]
        t_raw = [get_raw(t) for t in targets]

        tf = tfidf_score(p_clean, t_clean)          # 0..1
        tg = tg_list(p_clean, t_clean)              # 0..1
        sb = sbert_scores(p_raw, t_raw)             # 0..1

        for i, g in enumerate(group):
            tf100 = clamp(tf[i] * 100.0)
            tg100 = clamp(tg[i] * 100.0)
            sb100 = clamp(sb[i] * 100.0)
            final = clamp(W_TFIDF * tf100 + W_TRIGRAM * tg100 + W_SBERT * sb100)
            risk = "High" if final >= HIGH else ("Medium" if final >= MEDIUM else "Low")
            results.append({
                "primary": primary, "target": g["target"],
                "category": g["category"], "label": g["label"],
                "tfidf": round(tf100, 1), "trigram": round(tg100, 1),
                "sbert": round(sb100, 1), "final": round(final, 1), "risk": risk,
            })
    return results


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
CONFIGS = [("TF-IDF + cosine", "tfidf"),
           ("Trigram containment", "trigram"),
           ("Sentence-BERT", "sbert"),
           ("Hybrid (weighted)", "final")]


def report_metrics_by_config(rows, threshold, outdir):
    print("\n" + "=" * 64)
    print(f" Table 4.9 - Comparison of techniques  (threshold = {threshold:g})")
    print("=" * 64)
    print(f"{'Technique':<24}{'Precision':>10}{'Recall':>9}{'F1':>8}")
    print("-" * 64)
    csv_rows = []
    for name, key in CONFIGS:
        tp, fp, fn, tn = confusion(rows, key, threshold)
        p, r, f = prf(tp, fp, fn)
        print(f"{name:<24}{p:>10.2f}{r:>9.2f}{f:>8.2f}")
        csv_rows.append({"technique": name, "precision": round(p, 2),
                         "recall": round(r, 2), "f1": round(f, 2),
                         "tp": tp, "fp": fp, "fn": fn, "tn": tn})
    _write_csv(os.path.join(outdir, "metrics_by_config.csv"), csv_rows,
               ["technique", "precision", "recall", "f1", "tp", "fp", "fn", "tn"])


def report_detection_by_category(rows, threshold, outdir, key="final"):
    print("\n" + "=" * 64)
    print(f" Table 4.8 - Detection rate by category  (config: hybrid)")
    print("=" * 64)
    print(f"{'Category':<24}{'Pairs':>7}{'Positives':>11}{'Detected %':>12}")
    print("-" * 64)
    cats = {}
    for r in rows:
        cats.setdefault(r["category"], []).append(r)
    csv_rows = []
    for cat in sorted(cats):
        items = cats[cat]
        pos = [x for x in items if x["label"] == 1]
        neg = [x for x in items if x["label"] == 0]
        if pos:
            detected = 100.0 * sum(1 for x in pos if x[key] >= threshold) / len(pos)
            rate = f"{detected:>11.1f}"
            det_val = round(detected, 1)
        else:  # negative-only category: report correct-rejection instead
            rejected = 100.0 * sum(1 for x in neg if x[key] < threshold) / len(neg)
            rate = f"{('rej ' + format(rejected, '.1f')):>11}"
            det_val = f"reject={round(rejected,1)}"
        print(f"{cat:<24}{len(items):>7}{len(pos):>11}{rate:>12}")
        csv_rows.append({"category": cat, "pairs": len(items),
                         "positives": len(pos), "detection_rate": det_val})
    _write_csv(os.path.join(outdir, "detection_by_category.csv"), csv_rows,
               ["category", "pairs", "positives", "detection_rate"])


def report_threshold_sweep(rows, sweep, outdir, key="final"):
    print("\n" + "=" * 64)
    print(" Threshold sweep (hybrid) - choose your operating point")
    print("=" * 64)
    print(f"{'Threshold':>10}{'Precision':>11}{'Recall':>9}{'F1':>8}")
    print("-" * 64)
    csv_rows = []
    for t in sweep:
        tp, fp, fn, tn = confusion(rows, key, t)
        p, r, f = prf(tp, fp, fn)
        print(f"{t:>10g}{p:>11.2f}{r:>9.2f}{f:>8.2f}")
        csv_rows.append({"threshold": t, "precision": round(p, 2),
                         "recall": round(r, 2), "f1": round(f, 2)})
    _write_csv(os.path.join(outdir, "threshold_sweep.csv"), csv_rows,
               ["threshold", "precision", "recall", "f1"])


def _write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


# ---------------------------------------------------------------------------
# Dataset scaffolding
# ---------------------------------------------------------------------------
def do_init(manifest_path, docs_dir):
    os.makedirs(docs_dir, exist_ok=True)
    # try to seed from the existing test_docs folder if present
    seeded = []
    candidates = [os.path.join(BACKEND_DIR, "tests", "test_docs"),
                  os.path.join(os.getcwd(), "test_docs")]
    src = next((c for c in candidates if os.path.isdir(c)), None)
    if src:
        for fn in os.listdir(src):
            if fn.lower().endswith((".txt", ".pdf", ".docx")):
                shutil.copy(os.path.join(src, fn), os.path.join(docs_dir, fn))
                seeded.append(fn)

    if not os.path.exists(manifest_path):
        with open(manifest_path, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["primary", "target", "category", "label"])
            if {"original.txt", "exact_copy.txt"}.issubset(set(seeded)):
                # build a starter manifest from the known test_docs
                w.writerow(["original.txt", "exact_copy.txt", "verbatim", 1])
                if "paraphrase.txt" in seeded:
                    w.writerow(["original.txt", "paraphrase.txt", "heavy_paraphrase", 1])
                if "partial_copy.txt" in seeded:
                    w.writerow(["original.txt", "partial_copy.txt", "partial", 1])
                if "different.txt" in seeded:
                    w.writerow(["original.txt", "different.txt", "unrelated", 0])
            else:
                w.writerow(["src01.txt", "copy01.txt", "verbatim", 1])
                w.writerow(["src01.txt", "para01.txt", "heavy_paraphrase", 1])
                w.writerow(["src02.txt", "unrel01.txt", "unrelated", 0])
    print(f"Initialised:\n  docs dir : {docs_dir}\n  manifest : {manifest_path}")
    if seeded:
        print(f"  seeded {len(seeded)} file(s) from test_docs: {', '.join(sorted(seeded))}")
    print("\nNow add more document pairs to grow the dataset, then run:")
    print("  python tests/evaluate.py")


# ---------------------------------------------------------------------------
def read_manifest(path, docs_dir):
    pairs = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not row.get("primary"):
                continue
            for f in (row["primary"], row["target"]):
                if not os.path.exists(os.path.join(docs_dir, f)):
                    raise FileNotFoundError(f"Missing document: {os.path.join(docs_dir, f)}")
            pairs.append({"primary": row["primary"].strip(),
                          "target": row["target"].strip(),
                          "category": (row.get("category") or "uncategorised").strip(),
                          "label": int(row["label"])})
    return pairs


def main():
    ap = argparse.ArgumentParser(description="ASE detection evaluation")
    ap.add_argument("--manifest", default="eval_data/manifest.csv")
    ap.add_argument("--docs-dir", default=None,
                    help="folder holding the documents (default: <manifest dir>/docs)")
    ap.add_argument("--threshold", type=float, default=MEDIUM,
                    help=f"flag a pair as similar when final score >= this (default {MEDIUM:g})")
    ap.add_argument("--outdir", default="eval_out")
    ap.add_argument("--sweep", default="20,30,40,50,60,70")
    ap.add_argument("--no-sbert", action="store_true",
                    help="skip SBERT (faster; sets its score to 0)")
    ap.add_argument("--init", action="store_true",
                    help="scaffold eval_data/ then exit")
    args = ap.parse_args()

    docs_dir = args.docs_dir or os.path.join(os.path.dirname(args.manifest) or ".", "docs")

    if args.init:
        do_init(args.manifest, docs_dir)
        return

    if not os.path.exists(args.manifest):
        print(f"No manifest at {args.manifest}. Run with --init first.")
        sys.exit(1)

    os.makedirs(args.outdir, exist_ok=True)
    pairs = read_manifest(args.manifest, docs_dir)
    if not pairs:
        print("Manifest is empty.")
        sys.exit(1)

    n_pos = sum(1 for p in pairs if p["label"] == 1)
    print(f"Loaded {len(pairs)} pairs ({n_pos} positive, {len(pairs) - n_pos} negative)"
          f" across {len(set(p['category'] for p in pairs))} categories.")
    if args.no_sbert:
        print("WARNING: --no-sbert set; SBERT and the hybrid will be understated.")

    rows = score_pairs(pairs, docs_dir, use_sbert=not args.no_sbert)
    _write_csv(os.path.join(args.outdir, "results_pairs.csv"), rows,
               ["primary", "target", "category", "label",
                "tfidf", "trigram", "sbert", "final", "risk"])

    sweep = [float(x) for x in args.sweep.split(",") if x.strip()]
    report_metrics_by_config(rows, args.threshold, args.outdir)
    report_detection_by_category(rows, args.threshold, args.outdir)
    report_threshold_sweep(rows, sweep, args.outdir)
    print(f"\nCSV outputs written to: {os.path.abspath(args.outdir)}/")


if __name__ == "__main__":
    main()
