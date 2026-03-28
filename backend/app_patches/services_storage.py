from pathlib import Path
from app.config import settings

def score_upload_dir(score_id: str) -> Path:
    p = settings.uploads_dir / score_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def score_output_dir(score_id: str) -> Path:
    p = settings.scores_dir / score_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def parts_dir(score_id: str) -> Path:
    p = score_output_dir(score_id) / "parts"
    p.mkdir(parents=True, exist_ok=True)
    return p

def shared_sheets_dir() -> Path:
    """Global mirror of all uploaded source files."""
    p = settings.data_dir / "Sheets"
    p.mkdir(parents=True, exist_ok=True)
    return p

def shared_pdf_dir() -> Path:
    """Global mirror of all generated PDFs."""
    p = settings.data_dir / "SheetsPDF"
    p.mkdir(parents=True, exist_ok=True)
    return p
