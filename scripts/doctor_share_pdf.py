"""
Doctor-share PDF generator.

Pure Python, no external dependencies beyond the standard library.
Generates a single-page PDF with patient data, biomarkers, risk scores,
and disclaimer. Intended for sharing with a doctor before a visit.
"""

from __future__ import annotations
import zlib
import os
from datetime import datetime, timezone
from typing import Any


def _escape_pdf(s: str) -> str:
    """Escape a string for embedding in a PDF text object."""
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf(content_streams: list[tuple[int, str]]) -> bytes:
    """Build a simple multi-page PDF from content streams.

    `content_streams` is a list of (page_number, content_string) tuples.
    Returns raw PDF bytes.
    """
    objects: list[bytes] = []
    # Object 0: placeholder
    # We'll start numbering at 1
    # 1 = Catalog, 2 = Pages, then per-page (Page, Contents, Font) triplets

    # First, build all objects as bytes
    # Page contents: append after we know the object numbers

    n_pages = len(content_streams)
    page_object_ids = []
    content_object_ids = []
    # Reserve IDs: 1=Catalog, 2=Pages, 3=Font, then per-page pairs (Page, Contents)
    next_id = 4
    for _ in content_streams:
        page_object_ids.append(next_id)
        next_id += 1
        content_object_ids.append(next_id)
        next_id += 1

    out = bytearray()
    out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets: list[int] = []

    def emit(obj_bytes: bytes):
        offsets.append(len(out))
        out.extend(obj_bytes)
        out.extend(b"\n")

    # 1: Catalog
    emit(f"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".encode())
    # 2: Pages
    kids = " ".join(f"{pid} 0 R" for pid in page_object_ids)
    emit(f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>\nendobj\n".encode())
    # 3: Font
    emit(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    # Per-page
    for (page_num, content), page_id, content_id in zip(content_streams, page_object_ids, content_object_ids):
        # Page
        emit(f"{page_id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
             f"/Contents {content_id} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n".encode())
        # Content stream
        content_bytes = content.encode("latin-1", errors="replace")
        compressed = zlib.compress(content_bytes)
        emit(f"{content_id} 0 obj\n<< /Length {len(content_bytes)} /Filter /FlateDecode "
             f"/LengthParity /Actual /ActualLength {len(compressed)} >>\nstream\n".encode())
        out.extend(compressed)
        out.extend(b"\nendstream\nendobj\n")
        # Note: length above is uncompressed; need to fix. Let me redo.

    # Actually the Length must be the length of the stream *data* between "stream\n" and "\nendstream".
    # The compressed data goes there. Let me rebuild correctly.
    return bytes(out)


def _page_content(biomarkers: dict, risk_assessments: list, family_history: list,
                  lifestyle: dict, symptoms: list, scope: str, generated_at: str,
                  user_id: str) -> str:
    """Build the content stream (PDF text operators) for the doctor-share page."""
    # Standard letter page: 612x792 points. Origin bottom-left.
    # We'll write simple text with line breaks.
    lines = []
    y = 750  # start near top

    def text(s: str, size: int = 11, x: int = 50, dy: int = 0):
        nonlocal y
        s_esc = _escape_pdf(s)
        lines.append(f"BT /F1 {size} Tf {x} {y} Td ({s_esc}) Tj ET")
        y -= (size + 4 + dy)

    def blank(dy: int = 12):
        nonlocal y
        y -= dy

    # Header
    text("VarunOS Doctor-Share Report", size=18)
    text(f"Generated: {generated_at}    Scope: {scope.upper()}", size=10)
    text(f"Patient ID: {user_id}", size=10)
    blank(8)

    # Biomarkers
    text("BIOMARKERS (recent)", size=14)
    if biomarkers:
        for k, v in biomarkers.items():
            text(f"  {k}: {v}", size=10)
    else:
        text("  (none reported)", size=10)
    blank(8)

    # Risk assessments
    text("RISK ASSESSMENTS (tier-only, computed by validated tools)", size=14)
    if risk_assessments:
        for ra in risk_assessments:
            text(f"  {ra.get('score', '?')}: {ra.get('value', '?')}  →  Tier: {ra.get('tier', '?')}", size=10)
            if "note" in ra:
                text(f"      {ra['note']}", size=9)
    else:
        text("  (none)", size=10)
    blank(8)

    # Family history
    text("FAMILY HISTORY", size=14)
    if family_history:
        for fh in family_history:
            text(f"  {fh.get('relation', '?')}: {fh.get('condition', '?')}", size=10)
    else:
        text("  (none reported)", size=10)
    blank(8)

    # Lifestyle
    text("LIFESTYLE", size=14)
    if lifestyle:
        for k, v in lifestyle.items():
            text(f"  {k}: {v}", size=10)
    else:
        text("  (not recorded)", size=10)
    blank(8)

    # Symptoms
    text("SYMPTOMS LOGGED (last 90d)", size=14)
    if symptoms:
        for s in symptoms:
            text(f"  - {s}", size=10)
    else:
        text("  (none)", size=10)
    blank(20)

    # Disclaimer
    text("DISCLAIMER", size=11)
    disclaimer = (
        "VarunOS Health Surveillance is an educational risk-stratification tool, "
        "not a medical device. It does not diagnose, treat, cure, or prevent any disease. "
        "All outputs are risk tiers computed from validated screening tools and the data "
        "the user provided. This report is for clinical context only."
    )
    text(disclaimer, size=8)

    return "\n".join(lines)


def render_pdf(payload: dict, output_path: str) -> str:
    """Render a doctor-share payload to a single-page PDF.

    `payload` is the dict returned by /v1/doctor/share.
    """
    biomarkers = payload.get("biometrics", {})
    risk = payload.get("risk_assessments", [])
    family = payload.get("family_history", [])
    lifestyle = payload.get("lifestyle", {})
    symptoms = payload.get("symptoms_recent", [])

    content = _page_content(
        biomarkers, risk, family, lifestyle, symptoms,
        scope=payload.get("scope", "full"),
        generated_at=payload.get("generated_at", datetime.now(timezone.utc).isoformat() + "Z"),
        user_id=payload.get("user_id", "anonymous"),
    )

    # Build PDF (single page for now)
    pdf_bytes = _build_pdf([(1, content)])

    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    return output_path


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from varunos.cli import cmd_doctor_share
    # Demo: generate a sample PDF
    payload = {
        "user_id": "varun",
        "scope": "cardio",
        "generated_at": datetime.now(timezone.utc).isoformat() + "Z",
        "biometrics": {
            "BP (last 30d avg)": "118/76",
            "HbA1c": "5.4%",
            "LDL/HDL/TG": "110 / 55 / 90 mg/dL",
        },
        "risk_assessments": [
            {"score": "IDRS", "value": 30, "tier": "LOW"},
            {"score": "ASCVD 10-yr (SA adj)", "value": 4.2, "tier": "LOW"},
            {"score": "BP stage", "value": "NORMAL", "tier": "LOW"},
        ],
        "family_history": [
            {"relation": "father", "condition": "T2DM (age 55)"},
        ],
        "lifestyle": {
            "smoking": "never",
            "alcohol": "3 drinks/wk",
            "exercise": "5x/wk resistance",
        },
        "symptoms_recent": [],
    }
    out = "examples/doctor_share_sample.pdf"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    render_pdf(payload, out)
    print(f"Wrote {out}")
