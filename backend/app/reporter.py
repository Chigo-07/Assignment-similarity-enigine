from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Table,
                                TableStyle, Spacer)
from reportlab.lib.units import cm
from datetime import datetime


def generate_report(primary_doc: dict, results: list, output_path: str) -> str:
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
    styles = getSampleStyleSheet()
    story  = []

    story.append(Paragraph("Document Similarity Report", styles["Title"]))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        f"Course: {primary_doc.get('course_code', '-')} &nbsp;&nbsp; "
        f"Program: {primary_doc.get('program', '-')}", styles["Heading2"]))
    story.append(Paragraph(
        f"Primary Document: {primary_doc['filename']}", styles["Heading3"]))
    story.append(Paragraph(
        f"Student: {primary_doc['student_name']} ({primary_doc['matric_no']})",
        styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(
        "Similarity Results (ranked highest to lowest)", styles["Heading2"]))

    table_data = [["#", "Document", "Student", "Matric", "TF-IDF",
                   "Trigram", "Semantic", "Final", "Risk"]]
    for i, r in enumerate(results, 1):
        table_data.append([
            str(i),
            r["filename"][:22],
            r["student_name"][:18],
            r["matric_no"],
            f"{r['tfidf_score']}%",
            f"{r['trigram_score']}%",
            f"{r['sbert_score']}%",
            f"{r['final_score']}%",
            r["risk_level"],
        ])

    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0), colors.HexColor("#2C2C2A")),
        ("TEXTCOLOR",      (0, 0), (-1, 0), colors.white),
        ("FONTSIZE",       (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F1EFE8")]),
        ("GRID",           (0, 0), (-1, -1), 0.5, colors.HexColor("#D3D1C7")),
        ("ALIGN",          (4, 0), (-1, -1), "CENTER"),
        ("FONTNAME",       (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    high_risk = [r for r in results if r["risk_level"] == "High"]
    if high_risk:
        story.append(Paragraph("High Risk Matches", styles["Heading2"]))
        for r in high_risk:
            story.append(Paragraph(
                f"{r['filename']} — {r['student_name']} ({r['matric_no']}, "
                f"{r['program']}): {r['final_score']}% similarity",
                styles["Normal"]))
        story.append(Spacer(1, 0.3*cm))

    for r in results[:3]:
        if r.get("matched_phrases"):
            story.append(Paragraph(
                f"Matched phrases with: {r['filename']}", styles["Heading3"]))
            story.append(Paragraph(
                " | ".join(r["matched_phrases"][:10]), styles["Normal"]))
            story.append(Spacer(1, 0.3*cm))

    doc.build(story)
    return output_path
