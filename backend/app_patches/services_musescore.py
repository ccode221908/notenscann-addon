"""MuseScore CLI service — typesetting and MIDI export."""
import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Any

from app.services.xml_parser import get_parts, extract_part_xml
from app.services.storage import shared_pdf_dir

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 120


def _musescore_env() -> dict:
    display = os.environ.get("XVFB_DISPLAY", ":99")
    return {**os.environ, "DISPLAY": display, "QT_QPA_PLATFORM": "xcb"}


def _musescore_cmd() -> str:
    return os.environ.get("MUSESCORE_BIN", "musescore3")


async def _run_musescore(input_file: Path, output_path: Path) -> None:
    """Run MuseScore to convert input_file to output_path."""
    env = _musescore_env()
    cmd = [_musescore_cmd(), "-o", str(output_path), str(input_file)]
    logger.info("Running MuseScore: %s", " ".join(cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise asyncio.TimeoutError(
            f"MuseScore timed out after {TIMEOUT_SECONDS}s converting {input_file} -> {output_path}"
        )

    stdout_text = stdout.decode(errors="replace")
    stderr_text = stderr.decode(errors="replace")
    logger.debug("MuseScore stdout: %s", stdout_text)
    logger.debug("MuseScore stderr: %s", stderr_text)

    if proc.returncode != 0:
        raise RuntimeError(
            f"MuseScore failed (rc={proc.returncode}): {stderr_text}"
        )


def _add_footer_to_pdf(pdf_path: Path, footer_text: str) -> None:
    """Overlay centred footer text on every page of a PDF, in-place."""
    import io
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.units import mm

    reader = PdfReader(str(pdf_path))
    writer = PdfWriter()

    for page in reader.pages:
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)

        # Build a single-page overlay with just the footer text
        buf = io.BytesIO()
        c = rl_canvas.Canvas(buf, pagesize=(w, h))
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.35, 0.35, 0.35)
        text_w = c.stringWidth(footer_text, "Helvetica", 8)
        c.drawString((w - text_w) / 2, 8 * mm, footer_text)
        c.save()

        buf.seek(0)
        overlay_page = PdfReader(buf).pages[0]
        page.merge_page(overlay_page)
        writer.add_page(page)

    # Write back to the same path via a temp file
    tmp = pdf_path.with_suffix(".tmp.pdf")
    with open(str(tmp), "wb") as f:
        writer.write(f)
    tmp.replace(pdf_path)
    logger.info("Added footer to PDF: %s", pdf_path.name)


async def export_score(musicxml_file: Path, output_dir: Path, score_id: str = "", footer_text: str = "") -> Dict[str, Any]:
    """
    Export a MusicXML file to PDF and MIDI using MuseScore.
    Also exports per-part MIDI files and copies PDF to shared SheetsPDF dir.
    Returns:
        {
            "pdf": Path,          # path to typeset PDF
            "midi_full": Path,    # path to full-score MIDI
            "parts": [            # list of per-part info
                {"name": str, "midi": Path},
                ...
            ]
        }
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    stem = musicxml_file.stem

    # 1a. Export MuseScore-normalised MusicXML (used by the browser viewer)
    clean_xml_path = output_dir / f"{stem}.ms.musicxml"
    await _run_musescore(musicxml_file, clean_xml_path)
    logger.info("Exported clean MusicXML: %s", clean_xml_path)

    # 1b. Export full PDF
    pdf_path = output_dir / f"{stem}.pdf"
    await _run_musescore(musicxml_file, pdf_path)
    logger.info("Exported PDF: %s", pdf_path)

    # 1b-footer: overlay footer text on every page (post-process, best-effort)
    if footer_text:
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, _add_footer_to_pdf, pdf_path, footer_text
            )
        except Exception as exc:
            logger.warning("Footer overlay failed (non-fatal): %s", exc)

    # 1b-mirror. Copy PDF to shared SheetsPDF directory (best-effort)
    try:
        prefix = f"{score_id}_" if score_id else ""
        mirror_pdf = shared_pdf_dir() / f"{prefix}{stem}.pdf"
        shutil.copy2(str(pdf_path), str(mirror_pdf))
        logger.info("Mirrored PDF to SheetsPDF: %s", mirror_pdf)
    except Exception as exc:
        logger.warning("PDF mirror failed (non-fatal): %s", exc)

    # 1c. Export SVG pages for browser display (best-effort)
    svg_source = clean_xml_path if clean_xml_path.exists() else musicxml_file
    svg_target = output_dir / f"{stem}.svg"
    try:
        await _run_musescore(svg_source, svg_target)
        svg_files = sorted(output_dir.glob(f"{stem}-*.svg"))
        logger.info("Exported %d SVG page(s)", len(svg_files))
    except Exception as exc:
        logger.warning("SVG export failed (non-fatal): %s", exc)

    # 2. Export full MIDI
    midi_full_path = output_dir / f"{stem}.mid"
    await _run_musescore(musicxml_file, midi_full_path)
    logger.info("Exported full MIDI: %s", midi_full_path)

    # 3. Parse parts from MusicXML
    parts_info = get_parts(musicxml_file)
    logger.info("Found %d part(s): %s", len(parts_info), parts_info)

    # 4. For each part, extract single-part MusicXML then export MIDI
    parts_dir = output_dir / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)

    parts_result = []
    for part_id, part_name in parts_info:
        safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in part_name)
        part_xml_path = parts_dir / f"{stem}_{safe_name}.xml"
        part_midi_path = parts_dir / f"{stem}_{safe_name}.mid"

        extract_part_xml(musicxml_file, part_id, part_xml_path)

        await _run_musescore(part_xml_path, part_midi_path)
        logger.info("Exported part MIDI: %s", part_midi_path)
        parts_result.append({"name": part_name, "midi": part_midi_path})

    return {
        "pdf": pdf_path,
        "midi_full": midi_full_path,
        "parts": parts_result,
    }
