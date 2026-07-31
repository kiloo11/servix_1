import { jsPDF } from "jspdf";

// Rasterizes the payments table into canvas pages (a "table as image" trick,
// not native PDF text) via buildPdfCanvases/drawPdfRow/drawClippedPdfText
// and exportPaymentsPdf.

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
