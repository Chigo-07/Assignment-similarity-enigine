import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize


def _ensure_nltk():
    """Download required NLTK data on first run so a fresh clone doesn't crash."""
    needed = [("corpora/stopwords", "stopwords"),
              ("tokenizers/punkt", "punkt")]
    for path, pkg in needed:
        try:
            nltk.data.find(path)
        except LookupError:
            nltk.download(pkg, quiet=True)


_ensure_nltk()
STOPWORDS = set(stopwords.words("english"))


def clean_text(text: str) -> str:
    """Full cleaning pipeline for exact-copy detection (TF-IDF + trigrams)."""
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)        # collapse whitespace
    text = re.sub(r'[^\w\s]', '', text)     # remove punctuation
    tokens = word_tokenize(text)
    tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 2]
    return ' '.join(tokens)


def get_sentences(text: str) -> list[str]:
    """Split into sentences for SBERT — keep punctuation/meaning intact."""
    sentences = sent_tokenize(text)
    return [s.strip() for s in sentences if len(s.strip()) > 20]


def get_trigrams(text: str) -> set:
    """Extract all word trigrams from cleaned text."""
    tokens = text.split()
    return set(zip(tokens, tokens[1:], tokens[2:]))
