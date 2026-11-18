import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { RAG_CONFIG } from "./config";

export interface ExtractedPageLine {
  text: string;
  isHeading: boolean;
  gapBefore: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  charCount: number;
  wordCount: number;
  lines: ExtractedPageLine[];
}

export interface ExtractedPdfMetadata {
  title: string | null;
  authorOrInstitution: string | null;
  publicationYear: string | null;
}

export type PdfExtractionStatus = "processed" | "needs_ocr" | "failed";

export interface ExtractedPdfDocument {
  filename: string;
  fileHash: string;
  fileSizeBytes: number;
  status: PdfExtractionStatus;
  errorMessage: string | null;
  pageCount: number;
  totalChars: number;
  totalWords: number;
  metadata: ExtractedPdfMetadata;
  pages: ExtractedPage[];
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  height: number;
  width: number;
  hasEOL: boolean;
}

const dynamicImportEsm = new Function("specifier", "return import(specifier);") as (
  specifier: string
) => Promise<any>;

let cachedPdfJs: any = null;

async function getPdfJs(): Promise<{ pdfjs: any; standardFontDataUrl: string; cMapUrl?: string }> {
  const pkgPath = require.resolve("pdfjs-dist/package.json");
  const pkgDir = path.dirname(pkgPath);
  const standardFontDataUrl = pathToFileURL(path.join(pkgDir, "standard_fonts") + path.sep).href;
  const cMapDir = path.join(pkgDir, "cmaps");
  const cMapUrl = fs.existsSync(cMapDir) ? pathToFileURL(cMapDir + path.sep).href : undefined;

  if (!cachedPdfJs) {
    const legacyMjs = path.join(pkgDir, "legacy", "build", "pdf.mjs");
    cachedPdfJs = await dynamicImportEsm(pathToFileURL(legacyMjs).href);
  }

  return { pdfjs: cachedPdfJs, standardFontDataUrl, cMapUrl };
}

function parsePdfYear(rawDate: unknown): string | null {
  if (typeof rawDate !== "string" || !rawDate.trim()) return null;
  const match = rawDate.match(/(?:D:)?((?:19|20)\d{2})/);
  return match ? match[1] : null;
}

function cleanMetadataString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length < 2) return null;
  const lowered = trimmed.toLowerCase();
  if (["untitled", "unknown", "microsoft word", "adobe", "writer"].includes(lowered)) {
    return null;
  }
  return trimmed.slice(0, 300);
}

function computeMedian(values: number[]): number {
  if (!values.length) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isLikelyStructuralHeading(text: string, fontHeight: number, bodyFontHeight: number): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 4 || cleaned.length > 130) return false;
  if (/^\d+$/.test(cleaned) || /^p[áa]g\.?\s*\d+$/i.test(cleaned)) return false;
  if (/^\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}/.test(cleaned)) return false;
  if (/\b(HOME|CONTATO|POL[ÍI]TICA DE PRIVACIDADE|TERMOS DE USO|TV ALZHEIMER)\b/.test(cleaned)) {
    return false;
  }
  if (/[.!?;,]$/.test(cleaned) && !/^\d+(\.\d+)*\s+/.test(cleaned)) return false;

  const lettersOnly = cleaned.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (lettersOnly.length < 3) return false;

  const noticeablyLargerFont = fontHeight >= bodyFontHeight * 1.18;
  const numberedHeading = /^(m[óo]dulo|cap[íi]tulo|se[çc][ãa]o|parte|\d+(\.\d+){0,2}\.?)\s+[A-ZÀ-Ý]/i.test(
    cleaned
  );
  const upperRatio =
    lettersOnly.replace(/[^A-ZÀ-Ý]/g, "").length / Math.max(1, lettersOnly.length);
  const allCapsHeading =
    upperRatio >= 0.85 && cleaned.split(/\s+/).length >= 2 && cleaned.split(/\s+/).length <= 12;

  return noticeablyLargerFont || numberedHeading || allCapsHeading;
}

function buildLinesFromItems(rawItems: RawTextItem[], bodyFontHeight: number): ExtractedPageLine[] {
  if (!rawItems.length) return [];

  // Sort top-to-bottom (higher Y first in PDF coordinate space), then left-to-right
  const sorted = [...rawItems].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 2.8) return a.x - b.x;
    return b.y - a.y;
  });

  const rows: { y: number; maxHeight: number; items: RawTextItem[] }[] = [];
  for (const item of sorted) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(lastRow.y - item.y) <= Math.max(2.8, lastRow.maxHeight * 0.45)) {
      lastRow.items.push(item);
      lastRow.maxHeight = Math.max(lastRow.maxHeight, item.height);
    } else {
      rows.push({ y: item.y, maxHeight: item.height || bodyFontHeight, items: [item] });
    }
  }

  const lines: ExtractedPageLine[] = [];
  let prevY: number | null = null;

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let lineText = "";
    let prevEndX = -1;

    for (const part of row.items) {
      const piece = part.str;
      if (!piece) continue;
      if (prevEndX >= 0 && part.x - prevEndX > Math.max(2.2, (part.height || bodyFontHeight) * 0.22)) {
        if (!lineText.endsWith(" ") && !piece.startsWith(" ")) {
          lineText += " ";
        }
      }
      lineText += piece;
      prevEndX = Math.max(prevEndX, part.x + (part.width || 0));
    }

    const normalizedLine = lineText.replace(/\s+/g, " ").trim();
    if (!normalizedLine) continue;

    const gapBefore = prevY !== null ? Math.max(0, prevY - row.y) : 0;
    prevY = row.y;

    lines.push({
      text: normalizedLine,
      isHeading: isLikelyStructuralHeading(normalizedLine, row.maxHeight, bodyFontHeight),
      gapBefore,
    });
  }

  return lines;
}

function linesToPageText(lines: ExtractedPageLine[], bodyFontHeight: number): string {
  if (!lines.length) return "";
  const paragraphs: string[] = [];
  let current = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLargeGap = line.gapBefore > bodyFontHeight * 1.55;
    const isBullet = /^[•\-–*]\s+/.test(line.text) || /^\d+[.)]\s+/.test(line.text);

    if (!current) {
      current = line.text;
      continue;
    }

    if (line.isHeading || isLargeGap || isBullet || lines[i - 1]?.isHeading) {
      paragraphs.push(current.trim());
      current = line.text;
    } else if (current.endsWith("-") && /^[a-zà-ÿ]/.test(line.text)) {
      // Join hyphenated word breaks cleanly across line wraps
      current = current.slice(0, -1) + line.text;
    } else {
      current += ` ${line.text}`;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs.join("\n\n");
}

function countReadableWords(text: string): number {
  return (text.match(/[a-zA-ZÀ-ÿ0-9]{2,}/g) || []).length;
}

export async function extractPdfFromDisk(filePath: string): Promise<ExtractedPdfDocument> {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  let pdfDocument: any = null;
  try {
    const { pdfjs, standardFontDataUrl, cMapUrl } = await getPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(fileBuffer),
      standardFontDataUrl,
      ...(cMapUrl ? { cMapUrl, cMapPacked: true } : {}),
      verbosity: 0,
      useSystemFonts: false,
      disableFontFace: true,
    });

    pdfDocument = await loadingTask.promise;
    const metaResult = await pdfDocument.getMetadata().catch(() => null);
    const info = metaResult?.info || {};

    const metadata: ExtractedPdfMetadata = {
      title: cleanMetadataString(info.Title),
      authorOrInstitution: cleanMetadataString(info.Author),
      publicationYear:
        parsePdfYear(info.CreationDate) || parsePdfYear(info.ModDate) || null,
    };

    const numPages = Number(pdfDocument.numPages || 0);
    const pages: ExtractedPage[] = [];
    let totalChars = 0;
    let totalWords = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent({
        includeMarkedContent: false,
      });

      const rawItems: RawTextItem[] = [];
      const fontHeights: number[] = [];

      for (const item of textContent.items || []) {
        if (!item || typeof item.str !== "string") continue;
        const height = Math.abs(item.height || item.transform?.[3] || item.transform?.[0] || 0);
        if (item.str.trim() && height > 0) {
          fontHeights.push(height);
        }
        rawItems.push({
          str: item.str,
          x: Number(item.transform?.[4] || 0),
          y: Number(item.transform?.[5] || 0),
          height: height || 10,
          width: Number(item.width || 0),
          hasEOL: Boolean(item.hasEOL),
        });
      }

      const bodyFontHeight = computeMedian(fontHeights);
      const lines = buildLinesFromItems(rawItems, bodyFontHeight);
      const pageText = linesToPageText(lines, bodyFontHeight);
      const charCount = pageText.length;
      const wordCount = countReadableWords(pageText);

      totalChars += charCount;
      totalWords += wordCount;

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        charCount,
        wordCount,
        lines,
      });

      page.cleanup?.();
    }

    const avgCharsPerPage = numPages > 0 ? totalChars / numPages : 0;
    const insufficientText =
      numPages === 0 ||
      totalChars < RAG_CONFIG.extraction.minCharsForTextPdf ||
      totalWords < RAG_CONFIG.extraction.minReadableWords ||
      (numPages >= 2 && avgCharsPerPage < RAG_CONFIG.extraction.minAvgCharsPerPage);

    if (insufficientText) {
      return {
        filename,
        fileHash,
        fileSizeBytes: fileBuffer.length,
        status: "needs_ocr",
        errorMessage: `PDF sem texto extraível suficiente (${totalWords} palavras em ${numPages} páginas; provável arquivo digitalizado por imagem requerendo OCR).`,
        pageCount: numPages,
        totalChars,
        totalWords,
        metadata,
        pages,
      };
    }

    return {
      filename,
      fileHash,
      fileSizeBytes: fileBuffer.length,
      status: "processed",
      errorMessage: null,
      pageCount: numPages,
      totalChars,
      totalWords,
      metadata,
      pages,
    };
  } catch (err: any) {
    return {
      filename,
      fileHash,
      fileSizeBytes: fileBuffer.length,
      status: "failed",
      errorMessage: err?.message || String(err),
      pageCount: 0,
      totalChars: 0,
      totalWords: 0,
      metadata: {
        title: null,
        authorOrInstitution: null,
        publicationYear: null,
      },
      pages: [],
    };
  } finally {
    try {
      await pdfDocument?.destroy?.();
    } catch {
      // Ignore cleanup errors
    }
  }
}
