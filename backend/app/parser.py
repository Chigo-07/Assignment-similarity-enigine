import fitz          # PyMuPDF — for PDF
from docx import Document as DocxDocument
from docx.oxml.ns import qn
import os
 
W_P = qn("w:p")
W_T = qn("w:t")   # normal Word text: paragraphs, tables, legacy text boxes
A_T = qn("a:t")   # DrawingML text: shapes, SmartArt, WordArt
 
 
def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
 
    if ext == ".pdf":
        text = extract_pdf(file_path)
    elif ext == ".docx":
        text = extract_docx(file_path)
    elif ext == ".txt":
        text = extract_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
 
    if len(text.strip()) < 20:
        raise ValueError(
            "Could not extract readable text. The document appears to contain "
            "no selectable text — it is most likely a scan or photo (image only). "
            "Re-save it as a text document, or enable OCR."
        )
    return text
 
 
def extract_pdf(path: str) -> str:
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()
 
 
def _harvest(element):
    """Collect text from an XML element: paragraph runs (w:t, in reading order,
    which also covers tables and legacy text boxes) plus DrawingML runs (a:t,
    which covers shapes / SmartArt / WordArt)."""
    lines = []
    for p in element.iter(W_P):
        t = "".join(n.text for n in p.iter(W_T) if n.text)
        if t.strip():
            lines.append(t)
    for n in element.iter(A_T):
        if n.text and n.text.strip():
            lines.append(n.text)
    return lines
 
 
def extract_docx(path: str) -> str:
    doc = DocxDocument(path)
    parts = _harvest(doc.element.body)
    for section in doc.sections:
        for hf in (section.header, section.footer):
            parts.extend(_harvest(hf._element))
    # Drop exact-duplicate lines (Word's AlternateContent can store shape text
    # twice — once as DrawingML, once as a fallback) while preserving order.
    seen, out = set(), []
    for line in parts:
        key = line.strip()
        if key and key not in seen:
            seen.add(key)
            out.append(line)
    return "\n".join(out).strip()
 
 
def extract_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read().strip()