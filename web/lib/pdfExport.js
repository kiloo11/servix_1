import { jsPDF } from "jspdf";

// Every export here rasterizes onto a <canvas> and embeds the result as a
// PNG (via addImage), rather than using jsPDF's native text API — jsPDF's
// built-in fonts (helvetica/times/courier) only cover Latin/WinAnsi, so
// Cyrillic text passed to doc.text() comes out as mojibake (each character
// silently reinterpreted through the wrong encoding table). Embedding a
// Cyrillic-capable TTF into jsPDF is possible but heavier than needed here;
// canvas text instead uses the browser's own font stack, which already
// renders Cyrillic correctly — same reasoning for both exportPaymentsPdf's
// table pages and exportMonthlyReportPdf's report page below.

function buildPdfCanvases(title, headers, rows) {
  const width = 1600;
  const height = 1100;
  const margin = 48;
  const titleHeight = 64;
  const headHeight = 48;
  const rowHeight = 42;
  const colWidths = [250, 430, 360, 260];
  const pages = [];
  let offset = 0;

  while (offset < rows.length || !pages.length) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111827";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText(title, margin, 56);

    let y = margin + titleHeight;
    drawPdfRow(ctx, headers, margin, y, colWidths, headHeight, true);
    y += headHeight;

    while (offset < rows.length && y + rowHeight <= height - margin) {
      drawPdfRow(ctx, rows[offset], margin, y, colWidths, rowHeight, false);
      y += rowHeight;
      offset += 1;
    }

    pages.push(canvas);
  }

  return pages;
}

function drawPdfRow(ctx, cells, x, y, widths, height, isHead) {
  ctx.font = `${isHead ? "700" : "400"} 18px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  let currentX = x;
  widths.forEach((width, index) => {
    ctx.fillStyle = isHead ? "#111827" : "#ffffff";
    ctx.fillRect(currentX, y, width, height);
    ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(currentX, y, width, height);
    ctx.fillStyle = isHead ? "#ffffff" : "#111827";
    drawClippedPdfText(ctx, cells[index], currentX + 12, y + height / 2, width - 24);
    currentX += width;
  });
}

function drawClippedPdfText(ctx, value, x, y, maxWidth) {
  let text = String(value ?? "");
  while (text.length > 1 && ctx.measureText(text).width > maxWidth) {
    text = `${text.slice(0, -2)}…`;
  }
  ctx.fillText(text, x, y);
}

export async function exportPaymentsPdf(title, headers, rows, filename) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pages = buildPdfCanvases(title, headers, rows);
  pages.forEach((canvas, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 8, 8, 281, 194);
  });
  doc.save(filename);
}

// Brand tokens mirrored from web/app/globals.css's :root custom properties —
// canvas can't read CSS vars, so the report's palette is copied in as plain
// hex/rgba here.
const REPORT_COLOR_ACCENT = "#cf00a3";
const REPORT_COLOR_DARK = "#111827";
const REPORT_COLOR_MUTED = "#6b7280";
const REPORT_COLOR_FAINT = "#9ca3af";
const REPORT_COLOR_LINE = "#e5e7eb";
const REPORT_COLOR_GOOD = "#22c55e";
const REPORT_COLOR_BAD = "#ef4444";

function fitRight(ctx, text, rightEdge, y) {
  ctx.fillText(text, rightEdge - ctx.measureText(text).width, y);
}

// `sections` is [{ heading, rows: [{ label, value, trend? }] }], `trend` (if
// present) is `{ text, good }` with `good` true/false/null (null = flat,
// rendered muted instead of green/red) — entirely pre-translated/
// pre-formatted by the caller, this only lays it out onto a single
// A4-portrait-proportioned canvas page, styled to match the app's own accent
// color and card/heading conventions.
function buildReportCanvas({ siteTitle, title, monthLabel, generatedAt, sections }) {
  const width = 1240;
  const height = 1754; // matches A4's 1:√2 aspect ratio at this width
  const marginX = 90;
  const rightX = width - marginX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header band — same accent color as the app's own UI, with the site name
  // and reporting period, so a downloaded report is recognizable at a glance.
  const headerHeight = 260;
  ctx.fillStyle = REPORT_COLOR_ACCENT;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.fillText(String(siteTitle || "").toUpperCase(), marginX, 82);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 46px Arial, sans-serif";
  ctx.fillText(title, marginX, 152);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "400 28px Arial, sans-serif";
  ctx.fillText(monthLabel, marginX, 198);

  let y = headerHeight + 84;

  for (const section of sections) {
    ctx.fillStyle = REPORT_COLOR_ACCENT;
    ctx.fillRect(marginX, y - 26, 8, 34);
    ctx.fillStyle = REPORT_COLOR_DARK;
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(section.heading, marginX + 22, y);
    y += 20;
    ctx.strokeStyle = REPORT_COLOR_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    y += 48;

    for (const row of section.rows) {
      ctx.fillStyle = REPORT_COLOR_MUTED;
      ctx.font = "400 24px Arial, sans-serif";
      ctx.fillText(row.label, marginX, y);

      if (row.trend) {
        ctx.fillStyle = row.trend.good === null ? REPORT_COLOR_FAINT : row.trend.good ? REPORT_COLOR_GOOD : REPORT_COLOR_BAD;
        ctx.font = "700 22px Arial, sans-serif";
        fitRight(ctx, row.trend.text, rightX, y);
      }

      y += 42;
      ctx.fillStyle = REPORT_COLOR_DARK;
      ctx.font = "700 32px Arial, sans-serif";
      fitRight(ctx, String(row.value), rightX, y);
      y += 56;
    }
    y += 22;
  }

  ctx.strokeStyle = REPORT_COLOR_LINE;
  ctx.beginPath();
  ctx.moveTo(marginX, height - 96);
  ctx.lineTo(rightX, height - 96);
  ctx.stroke();
  ctx.fillStyle = REPORT_COLOR_FAINT;
  ctx.font = "400 20px Arial, sans-serif";
  ctx.fillText(generatedAt, marginX, height - 58);

  return canvas;
}

export function exportMonthlyReportPdf({ siteTitle, title, monthLabel, generatedAt, sections, filename }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const canvas = buildReportCanvas({ siteTitle, title, monthLabel, generatedAt, sections });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
  doc.save(filename);
}

export function exportPaymentsCsv(headers, rows, filename) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
