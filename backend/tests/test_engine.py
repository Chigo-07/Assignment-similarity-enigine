# tests/test_engine.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.preprocessor import clean_text
from app.similarity import tfidf_score, trigram_scores, sbert_scores, compare_documents

TEST_DIR = os.path.join(os.path.dirname(__file__), "test_docs")

def load(filename):
    with open(os.path.join(TEST_DIR, filename), "r") as f:
        return f.read()

def make_doc(filename, name, sid):
    raw = load(filename)
    return {
        "filename": filename,
        "raw_text": raw,
        "clean_text": clean_text(raw),
        "student_name": name,
        "student_id": sid,
    }

def run_tests():
    print("\n" + "="*55)
    print("  SIMILARITY ENGINE TEST SUITE")
    print("="*55)

    original     = make_doc("original.txt",     "Chidi Eze",    "STU001")
    exact_copy   = make_doc("exact_copy.txt",   "Amaka Obi",    "STU002")
    paraphrase   = make_doc("paraphrase.txt",   "Tunde Bello",  "STU003")
    partial_copy = make_doc("partial_copy.txt", "Ngozi Nwosu",  "STU004")
    different    = make_doc("different.txt",    "Emeka Adaeze", "STU005")

    others = [exact_copy, paraphrase, partial_copy, different]
    results = compare_documents(original, others)

    print(f"\n{'Document':<20} {'TF-IDF':>7} {'Trigram':>8} {'SBERT':>7} {'Final':>7} {'Risk':<8}")
    print("-"*55)
    for r in results:
        print(f"{r['filename']:<20} {r['tfidf_score']:>6}% {r['trigram_score']:>7}% "
              f"{r['sbert_score']:>6}% {r['final_score']:>6}%  {r['risk_level']}")

    print("\n--- VALIDATION CHECKS ---")
    results_by_file = {r["filename"]: r for r in results}

    checks = [
        ("exact_copy.txt",   "final_score", 85, ">=", "Exact copy must score >= 85%"),
        ("paraphrase.txt",   "sbert_score", 55, ">=", "Paraphrase SBERT must score >= 55%"),
        ("paraphrase.txt",   "tfidf_score", 60, "<=", "Paraphrase TF-IDF should be low (<= 60%)"),
        ("partial_copy.txt", "final_score", 30, ">=", "Partial copy must score >= 30%"),
        ("different.txt",    "final_score", 20, "<=", "Unrelated doc must score <= 20%"),
    ]

    all_passed = True
    for filename, field, threshold, op, message in checks:
        val = results_by_file[filename][field]
        if op == ">=":
            passed = val >= threshold
        else:
            passed = val <= threshold
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"  [{status}] {message} (got {val}%)")

    print("\n" + ("All checks passed!" if all_passed else
          "Some checks failed — review your scoring weights."))
    print("="*55 + "\n")

if __name__ == "__main__":
    run_tests()