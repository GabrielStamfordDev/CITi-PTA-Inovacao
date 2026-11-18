import crypto from "crypto";
import { RAG_CONFIG } from "./config";
import { ExtractedPage } from "./pdfExtractor";

export interface StructuralChunk {
  position: number;
  content: string;
  sectionTitle: string | null;
  startPage: number;
  endPage: number;
  contentHash: string;
}

export interface ChunkingOptions {
  targetChars?: number;
  maxChars?: number;
  minChars?: number;
  overlapChars?: number;
}

interface PageParagraphBlock {
  pageNumber: number;
  text: string;
  isHeading: boolean;
  isCaveatOrAlert: boolean;
  isListContinuation: boolean;
}

const CAVEAT_START_REGEX =
  /^(aten[çc][ãa]o|alerta|cuidado|importante|observa[çc][ãa]o|aviso|ressalva|contraindica|evite|nunca|n[ãa]o\s+fa[çc]a|procure\s+(um\s+)?m[ée]dico|emerg[êe]ncia|warning|caution|important|do\s+not|never|avoid|except|unless|however)\b/i;

function isNoiseLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^\d{1,4}$/.test(trimmed)) return true;
  if (/^p[áa]gina\s+\d+(\s+de\s+\d+)?$/i.test(trimmed)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4},?\s*\d{2}:\d{2}\b/.test(trimmed) && trimmed.length < 130) {
    return true;
  }
  if (/^(HOME|MENU|BUSCAR)\s+(ALZHEIMER|SOBRE|CONTATO)/i.test(trimmed)) return true;
  if (/^www\.|^https?:\/\/\S+$/i.test(trimmed) && trimmed.length < 90) return true;
  return false;
}

function splitPageIntoBlocks(page: ExtractedPage): PageParagraphBlock[] {
  const blocks: PageParagraphBlock[] = [];
  if (!page.lines.length) return blocks;

  let currentLines: string[] = [];
  let currentIsHeading = false;

  const flushCurrent = () => {
    const joined = currentLines.join(" ").replace(/\s+/g, " ").trim();
    currentLines = [];
    if (!joined || isNoiseLine(joined)) {
      currentIsHeading = false;
      return;
    }

    blocks.push({
      pageNumber: page.pageNumber,
      text: joined,
      isHeading: currentIsHeading,
      isCaveatOrAlert: CAVEAT_START_REGEX.test(joined),
      isListContinuation: /^([•\-–*]|\d+[.)])\s+/.test(joined),
    });
    currentIsHeading = false;
  };

  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i];
    if (isNoiseLine(line.text)) continue;

    const isBullet = /^([•\-–*]|\d+[.)])\s+/.test(line.text);
    const largeGap = line.gapBefore > 14;
    const prevWasHeading = i > 0 && page.lines[i - 1].isHeading;
    const isCaveatStart = CAVEAT_START_REGEX.test(line.text);

    if (
      currentLines.length > 0 &&
      (line.isHeading || prevWasHeading || largeGap || isBullet || isCaveatStart)
    ) {
      flushCurrent();
    }

    if (line.isHeading) {
      currentIsHeading = true;
    }

    if (currentLines.length > 0) {
      const prev = currentLines[currentLines.length - 1];
      if (prev.endsWith("-") && /^[a-zà-ÿ]/.test(line.text)) {
        currentLines[currentLines.length - 1] = prev.slice(0, -1) + line.text;
        continue;
      }
    }

    currentLines.push(line.text);
  }

  flushCurrent();
  return blocks;
}

function splitOversizedParagraph(text: string, targetChars: number, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  // Prefer sentence boundaries (. ! ? ;) so recommendations are not chopped mid-clause
  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [text];
  const parts: string[] = [];
  let buffer = "";

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (!buffer) {
      buffer = sentence;
      continue;
    }

    if (buffer.length + 1 + sentence.length <= targetChars) {
      buffer += ` ${sentence}`;
    } else if (buffer.length + 1 + sentence.length <= maxChars && sentence.length < 320) {
      buffer += ` ${sentence}`;
    } else {
      parts.push(buffer);
      buffer = sentence;
    }
  }

  if (buffer) parts.push(buffer);

  // Hard fallback only if a single sentence itself exceeds maxChars
  const safeParts: string[] = [];
  for (const part of parts) {
    if (part.length <= maxChars) {
      safeParts.push(part);
      continue;
    }
    let start = 0;
    while (start < part.length) {
      let end = Math.min(part.length, start + targetChars);
      if (end < part.length) {
        const spaceIdx = part.lastIndexOf(" ", end);
        if (spaceIdx > start + targetChars * 0.5) end = spaceIdx;
      }
      safeParts.push(part.slice(start, end).trim());
      start = end;
    }
  }

  return safeParts.filter(Boolean);
}

function buildOverlapTail(blocks: PageParagraphBlock[], overlapChars: number): PageParagraphBlock[] {
  if (overlapChars <= 0 || !blocks.length) return [];

  const nonHeadingBlocks = blocks.filter((b) => !b.isHeading);
  if (!nonHeadingBlocks.length) return [];

  const last = nonHeadingBlocks[nonHeadingBlocks.length - 1];
  if (last.text.length <= overlapChars + 80) {
    return [last];
  }

  // Pick trailing complete sentences up to overlapChars
  const sentences = last.text.match(/[^.!?]+(?:[.!?]+|$)/g) || [last.text];
  let collected = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i].trim();
    if (!s) continue;
    const candidate = collected ? `${s} ${collected}` : s;
    if (candidate.length > overlapChars && collected) break;
    collected = candidate;
  }

  return collected
    ? [
        {
          pageNumber: last.pageNumber,
          text: collected.trim(),
          isHeading: false,
          isCaveatOrAlert: false,
          isListContinuation: false,
        },
      ]
    : [];
}

/**
 * Splits extracted PDF pages into semantically cohesive chunks that preserve
 * headings, paragraph limits, clinical warnings/caveats, page boundaries, and overlap.
 */
export function chunkExtractedPages(
  pages: ExtractedPage[],
  options: ChunkingOptions = {}
): StructuralChunk[] {
  const targetChars = options.targetChars ?? RAG_CONFIG.chunking.targetChars;
  const maxChars = options.maxChars ?? RAG_CONFIG.chunking.maxChars;
  const minChars = options.minChars ?? RAG_CONFIG.chunking.minChars;
  const overlapChars = options.overlapChars ?? RAG_CONFIG.chunking.overlapChars;

  const rawBlocks = pages.flatMap((page) => splitPageIntoBlocks(page));

  // Normalize any unusually long paragraph while preserving headings & caveat flags
  const blocks: PageParagraphBlock[] = [];
  for (const block of rawBlocks) {
    if (block.text.length <= maxChars || block.isHeading) {
      blocks.push(block);
      continue;
    }
    const splitTexts = splitOversizedParagraph(block.text, targetChars, maxChars);
    splitTexts.forEach((piece, idx) => {
      blocks.push({
        pageNumber: block.pageNumber,
        text: piece,
        isHeading: false,
        isCaveatOrAlert: idx === 0 && block.isCaveatOrAlert,
        isListContinuation: idx === 0 && block.isListContinuation,
      });
    });
  }

  const chunks: StructuralChunk[] = [];
  let activeBlocks: PageParagraphBlock[] = [];
  let activeSection: string | null = null;
  let chunkSection: string | null = null;

  const getCurrentLength = () =>
    activeBlocks.reduce((sum, b, idx) => sum + b.text.length + (idx > 0 ? 2 : 0), 0);

  const flushChunk = (carryOverlap: boolean) => {
    if (!activeBlocks.length) return;

    // Avoid dangling heading-only chunk with no body content
    const hasBody = activeBlocks.some((b) => !b.isHeading);
    if (!hasBody) return;

    const content = activeBlocks.map((b) => b.text).join("\n\n").trim();
    const startPage = Math.min(...activeBlocks.map((b) => b.pageNumber));
    const endPage = Math.max(...activeBlocks.map((b) => b.pageNumber));

    if (content.length < minChars && chunks.length > 0) {
      const prev = chunks[chunks.length - 1];
      if (prev.content.length + 2 + content.length <= maxChars + 260) {
        prev.content = `${prev.content}\n\n${content}`;
        prev.endPage = Math.max(prev.endPage, endPage);
        prev.contentHash = crypto.createHash("sha256").update(prev.content).digest("hex");
        activeBlocks = carryOverlap ? buildOverlapTail(activeBlocks, overlapChars) : [];
        chunkSection = activeSection;
        return;
      }
    }

    const contentHash = crypto.createHash("sha256").update(content).digest("hex");
    chunks.push({
      position: chunks.length + 1,
      content,
      sectionTitle: chunkSection || activeSection,
      startPage,
      endPage,
      contentHash,
    });

    activeBlocks = carryOverlap ? buildOverlapTail(activeBlocks, overlapChars) : [];
    chunkSection = activeSection;
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.isHeading) {
      const cleanHeading = block.text.replace(/\s+/g, " ").trim().slice(0, 140);
      // If active chunk already has substantial body text, start a clean section chunk
      if (getCurrentLength() >= minChars && activeBlocks.some((b) => !b.isHeading)) {
        flushChunk(false);
      }
      activeSection = cleanHeading;
      if (!activeBlocks.length) {
        chunkSection = cleanHeading;
      }
      activeBlocks.push(block);
      continue;
    }

    const currentLen = getCurrentLength();
    const projectedLen = currentLen + (activeBlocks.length ? 2 : 0) + block.text.length;

    // Keep warnings/alerts and short bullet follow-ups attached to their recommendation when safe
    if (
      activeBlocks.length > 0 &&
      (block.isCaveatOrAlert || block.isListContinuation) &&
      projectedLen <= maxChars + 250
    ) {
      activeBlocks.push(block);
      continue;
    }

    if (projectedLen > targetChars && currentLen >= minChars) {
      const hasBody = activeBlocks.some((b) => !b.isHeading);
      if (hasBody) {
        flushChunk(true);
      }
    }

    if (!activeBlocks.length) {
      chunkSection = activeSection;
    }
    activeBlocks.push(block);

    // If single addition pushed past hard maxChars, flush after including it
    if (getCurrentLength() >= maxChars) {
      const nextBlock = blocks[i + 1];
      if (!nextBlock || (!nextBlock.isCaveatOrAlert && getCurrentLength() >= maxChars)) {
        flushChunk(true);
      }
    }
  }

  flushChunk(false);
  return chunks;
}
