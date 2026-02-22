"""
DockIt pipeline — PDF report and ZIP archive generation.

Uses ReportLab for PDF creation and the standard-library ``zipfile``
module for archive bundling.
"""

from __future__ import annotations

import csv
import io
import logging
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PDF report
# ---------------------------------------------------------------------------

def generate_pdf_report(
    job_data: dict,
    results: list[dict],
    output_path: Path,
    generated_results: list[dict] | None = None,
) -> Path:
    """Generate a PDF report summarising the docking run.

    Parameters
    ----------
    job_data : dict
        Job metadata (``job_id``, ``uniprot_id``, ``protein_name``, ``mode``).
    results : list[dict]
        Scored docking results (top N).
    output_path : Path
        Where to write the PDF file.
    generated_results : list[dict], optional
        V2: AI-generated molecules results.

    Returns
    -------
    Path
        Absolute path to the generated PDF.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        return _generate_pdf_reportlab(job_data, results, output_path, generated_results)
    except ImportError:
        logger.warning("ReportLab not available; generating plain-text report")
        return _generate_txt_report(job_data, results, output_path, generated_results)
    except Exception as exc:
        logger.error("PDF generation failed: %s", exc)
        return _generate_txt_report(job_data, results, output_path, generated_results)


def _generate_pdf_reportlab(
    job_data: dict,
    results: list[dict],
    output_path: Path,
    generated_results: list[dict] | None = None,
) -> Path:
    """Create PDF using ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DockItTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#1e3a5f"),
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "DockItHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#1e3a5f"),
        spaceAfter=8,
    )

    elements: list[Any] = []

    # Title
    elements.append(Paragraph("DockIt - Virtual Screening Report", title_style))
    elements.append(Spacer(1, 6 * mm))

    # Job info
    job_id = job_data.get("job_id", "N/A")
    uniprot = job_data.get("uniprot_id", "N/A")
    protein = job_data.get("protein_name", uniprot)
    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    mode = job_data.get("mode", "basic")
    n_generated = len(generated_results) if generated_results else 0

    info_text = (
        f"<b>Job ID:</b> {job_id}<br/>"
        f"<b>Target protein:</b> {protein} ({uniprot})<br/>"
        f"<b>Date:</b> {date_str}<br/>"
        f"<b>Mode:</b> {mode.upper()}<br/>"
        f"<b>Known ligands screened:</b> {len(results)}"
    )
    if n_generated:
        info_text += f"<br/><b>AI-generated molecules:</b> {n_generated}"
    elements.append(Paragraph(info_text, styles["Normal"]))
    elements.append(Spacer(1, 8 * mm))

    # Results table
    elements.append(Paragraph("Top Docking Results", heading_style))

    top_n = results[:10]
    table_data = [["Rank", "Name", "Affinity\n(kcal/mol)", "QED", "LogP", "MW", "Score", "ADMET"]]
    for i, r in enumerate(top_n, 1):
        admet = r.get("admet", {})
        admet_label = "-"
        if isinstance(admet, dict) and admet.get("color_code"):
            admet_label = admet["color_code"].upper()
        table_data.append([
            str(i),
            str(r.get("name", "?"))[:25],
            f"{r.get('affinity', 0):.1f}",
            f"{r.get('qed', 0):.2f}" if r.get("qed") is not None else "-",
            f"{r.get('logP') or r.get('logp', 0):.1f}" if r.get("logP") or r.get("logp") is not None else "-",
            f"{r.get('MW') or r.get('mw', 0):.0f}" if r.get("MW") or r.get("mw") is not None else "-",
            f"{r.get('composite_score', 0):.3f}",
            admet_label,
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 10 * mm))

    # SMILES list
    elements.append(Paragraph("SMILES of Top Compounds", heading_style))
    for i, r in enumerate(top_n, 1):
        smi = r.get("smiles", "N/A")
        name = r.get("name", "?")
        elements.append(Paragraph(
            f"<b>{i}. {name}:</b> <font size=7>{smi}</font>",
            styles["Normal"],
        ))
    elements.append(Spacer(1, 6 * mm))

    # --- V2 Sections ---
    if generated_results:
        elements.append(Paragraph("AI-Generated Molecules", heading_style))
        elements.append(Paragraph(
            f"REINVENT4 generated <b>{len(generated_results)}</b> novel molecules optimized for this target.",
            styles["Normal"],
        ))
        elements.append(Spacer(1, 4 * mm))

        gen_data = [["Rank", "Name", "Affinity\n(kcal/mol)", "QED", "Novelty", "ADMET", "Score"]]
        for i, r in enumerate(generated_results[:10], 1):
            admet = r.get("admet", {})
            admet_score = admet.get("composite_score", "-") if isinstance(admet, dict) else "-"
            gen_data.append([
                str(i),
                str(r.get("name", "?"))[:20],
                f"{r.get('affinity', 0):.1f}",
                f"{r.get('qed', 0):.2f}" if r.get("qed") is not None else "-",
                f"{r.get('novelty_score', 0):.2f}" if r.get("novelty_score") is not None else "-",
                f"{admet_score:.2f}" if isinstance(admet_score, (int, float)) else "-",
                f"{r.get('composite_score', 0):.3f}",
            ])

        gen_table = Table(gen_data, repeatRows=1)
        gen_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.Color(0.96, 0.95, 1.0), colors.white]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(gen_table)
        elements.append(Spacer(1, 8 * mm))

    # ADMET summary for top molecules
    all_with_admet = [r for r in (results[:5] + (generated_results or [])[:5]) if r.get("admet")]
    if all_with_admet:
        elements.append(Paragraph("ADMET Profiles - Top Candidates", heading_style))
        for r in all_with_admet[:5]:
            admet = r.get("admet", {})
            name = r.get("name", "?")
            color = admet.get("color_code", "yellow") if isinstance(admet, dict) else "yellow"
            flags = admet.get("flags", []) if isinstance(admet, dict) else []
            score = admet.get("composite_score", 0) if isinstance(admet, dict) else 0
            flag_text = ", ".join(flags) if flags else "No alerts"
            elements.append(Paragraph(
                f"<b>{name}</b> — ADMET Score: {score:.2f} ({color.upper()}) — {flag_text}",
                styles["Normal"],
            ))
        elements.append(Spacer(1, 8 * mm))

    # Retrosynthesis summary
    all_with_synth = [r for r in (results + (generated_results or [])) if r.get("synthesis_route")]
    if all_with_synth:
        elements.append(Paragraph("Retrosynthesis Routes", heading_style))
        for r in all_with_synth[:5]:
            synth = r.get("synthesis_route", {})
            name = r.get("name", "?")
            n_steps = synth.get("n_steps", 0) if isinstance(synth, dict) else 0
            conf = synth.get("confidence", 0) if isinstance(synth, dict) else 0
            available = synth.get("all_reagents_available", False) if isinstance(synth, dict) else False
            cost = synth.get("estimated_cost", "unknown") if isinstance(synth, dict) else "unknown"
            avail_text = "All reagents available" if available else "Some reagents may need custom synthesis"
            elements.append(Paragraph(
                f"<b>{name}</b> — {n_steps} steps, confidence {conf:.0%}, cost: {cost}. {avail_text}",
                styles["Normal"],
            ))
        elements.append(Spacer(1, 8 * mm))

    # Footer
    elements.append(Paragraph(
        "<i>Generated by DockIt V3 - The Canva of molecular docking</i>",
        styles["Normal"],
    ))

    doc.build(elements)
    logger.info("PDF report generated: %s", output_path)
    return output_path


def _generate_txt_report(
    job_data: dict,
    results: list[dict],
    output_path: Path,
    generated_results: list[dict] | None = None,
) -> Path:
    """Plain-text fallback when ReportLab is unavailable."""
    txt_path = output_path.with_suffix(".txt")
    lines = [
        "=" * 60,
        "DockIt - Virtual Screening Report",
        "=" * 60,
        f"Job ID:   {job_data.get('job_id', 'N/A')}",
        f"Target:   {job_data.get('protein_name', job_data.get('uniprot_id', 'N/A'))}",
        f"UniProt:  {job_data.get('uniprot_id', 'N/A')}",
        f"Date:     {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"Ligands:  {len(results)}",
        "",
        "-" * 60,
        f"{'Rank':<5}{'Name':<25}{'Affinity':<10}{'QED':<8}{'Score':<8}",
        "-" * 60,
    ]
    for i, r in enumerate(results[:10], 1):
        lines.append(
            f"{i:<5}{str(r.get('name','?'))[:24]:<25}"
            f"{r.get('affinity', 0):>8.1f}  "
            f"{r.get('qed', 0):>6.2f}  "
            f"{r.get('composite_score', 0):>6.3f}"
        )
    lines.append("-" * 60)

    if generated_results:
        lines.append("")
        lines.append("=" * 60)
        lines.append("AI-GENERATED MOLECULES")
        lines.append("=" * 60)
        lines.append(f"{'Rank':<5}{'Name':<25}{'Affinity':<10}{'QED':<8}{'Score':<8}")
        lines.append("-" * 60)
        for i, r in enumerate(generated_results[:10], 1):
            lines.append(
                f"{i:<5}{str(r.get('name','?'))[:24]:<25}"
                f"{r.get('affinity', 0):>8.1f}  "
                f"{r.get('qed', 0):>6.2f}  "
                f"{r.get('composite_score', 0):>6.3f}"
            )
        lines.append("-" * 60)

    lines.append("\nGenerated by DockIt V2")

    txt_path.write_text("\n".join(lines))
    logger.info("Text report generated: %s", txt_path)
    return txt_path


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

def generate_csv(results: list[dict], output_path: Path) -> Path:
    """Write results to a CSV file.

    Parameters
    ----------
    results : list[dict]
        Scored docking results.
    output_path : Path
        Where to write the CSV.

    Returns
    -------
    Path
        Path to the CSV file.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "rank", "name", "smiles", "affinity_kcal", "composite_score",
        "qed", "logP", "MW", "tpsa", "hbd", "hba", "rotatable_bonds", "source",
        "docking_method", "novelty_score", "admet_score", "admet_color",
    ]

    with open(output_path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for i, r in enumerate(results, 1):
            admet = r.get("admet", {})
            row = {
                "rank": i,
                "name": r.get("name", ""),
                "smiles": r.get("smiles", ""),
                "affinity_kcal": r.get("affinity", ""),
                "composite_score": r.get("composite_score", ""),
                "qed": r.get("qed", ""),
                "logP": r.get("logP", ""),
                "MW": r.get("MW", ""),
                "tpsa": r.get("tpsa", ""),
                "hbd": r.get("hbd", ""),
                "hba": r.get("hba", ""),
                "rotatable_bonds": r.get("rotatable_bonds", ""),
                "source": r.get("source", ""),
                "docking_method": r.get("docking_method", ""),
                "novelty_score": r.get("novelty_score", ""),
                "admet_score": admet.get("composite_score", "") if isinstance(admet, dict) else "",
                "admet_color": admet.get("color_code", "") if isinstance(admet, dict) else "",
            }
            writer.writerow(row)

    logger.info("CSV written: %s", output_path)
    return output_path


# ---------------------------------------------------------------------------
# ZIP archive
# ---------------------------------------------------------------------------

def generate_zip_archive(work_dir: Path, output_path: Path) -> Path:
    """Bundle all job output files into a ZIP archive.

    Includes PDB, PDBQT poses, PDF/TXT report, CSV, and ligand files.

    Parameters
    ----------
    work_dir : Path
        Job working directory containing all output files.
    output_path : Path
        Where to write the ZIP file.

    Returns
    -------
    Path
        Path to the ZIP archive.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    extensions = {".pdb", ".pdbqt", ".pdf", ".txt", ".csv", ".sdf"}

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fpath in sorted(work_dir.rglob("*")):
            if fpath.is_file() and fpath.suffix.lower() in extensions:
                arcname = fpath.relative_to(work_dir)
                zf.write(fpath, arcname)
                logger.debug("Added to ZIP: %s", arcname)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("ZIP archive generated: %s (%.1f MB)", output_path, size_mb)
    return output_path
