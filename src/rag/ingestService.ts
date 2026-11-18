import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "../database";
import { SCIENTIFIC_SOURCES } from "../data/acervoCientifico";
import { resolveProjectPath } from "../utils/projectPaths";
import { RAG_CONFIG } from "./config";
import { chunkExtractedPages } from "./chunker";
import { embedDocumentChunks, formatPgVectorLiteral } from "./embeddingClient";
import { extractPdfFromDisk } from "./pdfExtractor";

export interface IngestDocumentReport {
  filename: string;
  action: "skipped" | "processed" | "needs_ocr" | "failed" | "removed";
  chunksCount: number;
  pageCount: number | null;
  totalWords: number | null;
  reason?: string;
}

export interface IngestSummary {
  processed: number;
  skipped: number;
  needsOcr: number;
  failed: number;
  removed: number;
  totalChunksIndexed: number;
  details: IngestDocumentReport[];
}

export interface IngestOptions {
  force?: boolean;
  allowLexicalOnly?: boolean;
  acervoDir?: string;
  onLog?: (msg: string) => void;
}

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function resolveDocumentMetadata(
  filename: string,
  extracted: {
    title: string | null;
    authorOrInstitution: string | null;
    publicationYear: string | null;
  }
) {
  const curated = SCIENTIFIC_SOURCES.find((s) => s.filename === filename);
  if (curated) {
    return {
      title: curated.title || extracted.title || null,
      authorOrInstitution: curated.institution || extracted.authorOrInstitution || null,
      publicationYear: curated.year || extracted.publicationYear || null,
      documentType: curated.documentType || null,
      focus: curated.focus || null,
      metadataSource: "curated-registry",
    };
  }

  return {
    title: extracted.title || null,
    authorOrInstitution: extracted.authorOrInstitution || null,
    publicationYear: extracted.publicationYear || null,
    documentType: null,
    focus: null,
    metadataSource:
      extracted.title || extracted.authorOrInstitution || extracted.publicationYear
        ? "pdf-metadata"
        : null,
  };
}

/**
 * Runs idempotent, incremental ingestion of all PDF documents in `acervo-pdf/`.
 * Unchanged files (same SHA-256 hash and existing indexed chunks) are skipped with 0 API calls.
 */
export async function ingestAcervoPdfs(options: IngestOptions = {}): Promise<IngestSummary> {
  const log = options.onLog || ((msg: string) => console.log(msg));
  const acervoDir = options.acervoDir || resolveProjectPath("acervo-pdf");

  if (!fs.existsSync(acervoDir)) {
    throw new Error(`Diretório do acervo não encontrado: ${acervoDir}`);
  }

  const diskFiles = fs
    .readdirSync(acervoDir)
    .filter((f) => path.extname(f).toLowerCase() === ".pdf")
    .sort((a, b) => fs.statSync(path.join(acervoDir, a)).size - fs.statSync(path.join(acervoDir, b)).size);
  const diskFileSet = new Set(diskFiles);

  const existingDocs = await prisma.ragDocument.findMany({
    include: { _count: { select: { chunks: true } } },
  });
  const existingByName = new Map(existingDocs.map((d) => [d.filename, d]));

  const summary: IngestSummary = {
    processed: 0,
    skipped: 0,
    needsOcr: 0,
    failed: 0,
    removed: 0,
    totalChunksIndexed: 0,
    details: [],
  };

  // Mark deleted PDFs as removed so they stop appearing in search while keeping historical rows safe
  for (const doc of existingDocs) {
    if (!diskFileSet.has(doc.filename) && doc.status !== "removed") {
      await prisma.ragDocument.update({
        where: { id: doc.id },
        data: { status: "removed", errorMessage: "Arquivo removido do diretório acervo-pdf/" },
      });
      summary.removed++;
      summary.details.push({
        filename: doc.filename,
        action: "removed",
        chunksCount: 0,
        pageCount: doc.pageCount,
        totalWords: doc.totalWords,
        reason: "Arquivo ausente em acervo-pdf/",
      });
      log(`[removed] ${doc.filename} marcado como removido.`);
    }
  }

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!hasGeminiKey && !options.allowLexicalOnly) {
    throw new Error(
      "GEMINI_API_KEY ausente. Configure a chave para gerar embeddings ou execute com --lexical-only para teste."
    );
  }

  for (const filename of diskFiles) {
    const fullPath = path.join(acervoDir, filename);
    const currentHash = sha256File(fullPath);
    const existing = existingByName.get(filename);

    const isUnchangedProcessed =
      !options.force &&
      existing &&
      existing.status === "processed" &&
      existing.fileHash === currentHash &&
      existing._count.chunks > 0;

    if (isUnchangedProcessed) {
      // Verifica se existem chunks pendentes de embedding (ex.: retomada após cota diária 429)
      const pendingRows =
        hasGeminiKey && !options.allowLexicalOnly
          ? await prisma.$queryRaw<{ id: number; content: string; sectionTitle: string | null }[]>`
              SELECT id, content, "sectionTitle"
              FROM "RagChunk"
              WHERE "documentId" = ${existing.id} AND "embedding" IS NULL
              ORDER BY position ASC
            `
          : [];

      if (pendingRows.length === 0) {
        summary.skipped++;
        summary.totalChunksIndexed += existing._count.chunks;
        summary.details.push({
          filename,
          action: "skipped",
          chunksCount: existing._count.chunks,
          pageCount: existing.pageCount,
          totalWords: existing.totalWords,
          reason: "Hash SHA-256 inalterado",
        });
        log(`[skip] ${filename} inalterado (${existing._count.chunks} chunks em banco).`);
        continue;
      }

      log(`[resume-embed] ${filename}: completando embeddings para ${pendingRows.length} chunks pendentes...`);
      const embedRes = await embedDocumentChunks(
        pendingRows.map((p) => ({
          text: p.sectionTitle ? `${p.sectionTitle}\n\n${p.content}` : p.content,
          title: existing.title || filename,
        })),
        (done, total) => log(`  [embed-progress] ${filename}: ${done}/${total} pendentes`)
      );

      for (let idx = 0; idx < pendingRows.length; idx++) {
        const vec = embedRes.vectors[idx];
        if (!vec) continue;
        await prisma.$executeRaw`
          UPDATE "RagChunk"
          SET "embedding" = ${formatPgVectorLiteral(vec)}::vector,
              "embeddingModel" = ${RAG_CONFIG.embedding.model},
              "embeddingDim" = ${RAG_CONFIG.embedding.dimension}
          WHERE id = ${pendingRows[idx].id}
        `;
      }

      summary.processed++;
      summary.totalChunksIndexed += existing._count.chunks;
      summary.details.push({
        filename,
        action: "processed",
        chunksCount: existing._count.chunks,
        pageCount: existing.pageCount,
        totalWords: existing.totalWords,
        reason: embedRes.quotaExhausted
          ? "Retomada parcial (cota de embeddings atingida)"
          : "Embeddings pendentes preenchidos",
      });
      continue;
    }

    log(`[extract] Lendo ${filename}...`);
    const extracted = await extractPdfFromDisk(fullPath);
    const docMeta = resolveDocumentMetadata(filename, extracted.metadata);

    if (extracted.status !== "processed") {
      await prisma.ragDocument.upsert({
        where: { filename },
        create: {
          filename,
          ...docMeta,
          fileHash: extracted.fileHash,
          pageCount: extracted.pageCount,
          totalWords: extracted.totalWords,
          status: extracted.status,
          errorMessage: extracted.errorMessage,
        },
        update: {
          ...docMeta,
          fileHash: extracted.fileHash,
          pageCount: extracted.pageCount,
          totalWords: extracted.totalWords,
          status: extracted.status,
          errorMessage: extracted.errorMessage,
        },
      });

      if (extracted.status === "needs_ocr") {
        summary.needsOcr++;
      } else {
        summary.failed++;
      }

      summary.details.push({
        filename,
        action: extracted.status,
        chunksCount: 0,
        pageCount: extracted.pageCount,
        totalWords: extracted.totalWords,
        reason: extracted.errorMessage || undefined,
      });
      log(`[${extracted.status}] ${filename}: ${extracted.errorMessage}`);
      continue;
    }

    const structuralChunks = chunkExtractedPages(extracted.pages);
    if (!structuralChunks.length) {
      await prisma.ragDocument.upsert({
        where: { filename },
        create: {
          filename,
          ...docMeta,
          fileHash: extracted.fileHash,
          pageCount: extracted.pageCount,
          totalWords: extracted.totalWords,
          status: "needs_ocr",
          errorMessage: "Nenhum chunk estrutural válido gerado após extração.",
        },
        update: {
          ...docMeta,
          fileHash: extracted.fileHash,
          pageCount: extracted.pageCount,
          totalWords: extracted.totalWords,
          status: "needs_ocr",
          errorMessage: "Nenhum chunk estrutural válido gerado após extração.",
        },
      });
      summary.needsOcr++;
      continue;
    }

    let vectors: (number[] | null)[] = structuralChunks.map(() => null);
    let quotaHit = false;
    if (hasGeminiKey && !options.allowLexicalOnly) {
      log(
        `[embed] ${filename}: gerando embeddings (${RAG_CONFIG.embedding.model}, ${RAG_CONFIG.embedding.dimension}d) para ${structuralChunks.length} chunks...`
      );
      const embedRes = await embedDocumentChunks(
        structuralChunks.map((c) => ({
          text: c.sectionTitle ? `${c.sectionTitle}\n\n${c.content}` : c.content,
          title: docMeta.title || filename,
        })),
        (done, total) => log(`  [embed-progress] ${filename}: ${done}/${total} chunks`)
      );
      vectors = embedRes.vectors;
      quotaHit = embedRes.quotaExhausted;
    }

    const embeddedCount = vectors.filter(Boolean).length;
    const partialWarning = quotaHit
      ? `Embeddings parciais (${embeddedCount}/${structuralChunks.length}) por cota da API; busca lexical ativa para todos os trechos.`
      : null;

    await prisma.$transaction(
      async (tx) => {
        const upsertedDoc = await tx.ragDocument.upsert({
          where: { filename },
          create: {
            filename,
            ...docMeta,
            fileHash: extracted.fileHash,
            pageCount: extracted.pageCount,
            totalWords: extracted.totalWords,
            status: "processed",
            errorMessage: partialWarning,
            ingestedAt: new Date(),
          },
          update: {
            ...docMeta,
            fileHash: extracted.fileHash,
            pageCount: extracted.pageCount,
            totalWords: extracted.totalWords,
            status: "processed",
            errorMessage: partialWarning,
            ingestedAt: new Date(),
          },
        });

        await tx.ragChunk.deleteMany({
          where: { documentId: upsertedDoc.id },
        });

        // Insert chunks in slices of 30 rows per SQL statement for fast remote writes
        const sliceSize = 30;
        for (let i = 0; i < structuralChunks.length; i += sliceSize) {
          const chunkSlice = structuralChunks.slice(i, i + sliceSize);
          const vectorSlice = vectors.slice(i, i + sliceSize);

          const valuesSql = Prisma.join(
            chunkSlice.map((ch, idx) => {
              const vec = vectorSlice[idx];
              const chunkKey = `${filename}#c${String(ch.position).padStart(4, "0")}#p${ch.startPage}-${ch.endPage}`;
              const vecExpr = vec
                ? Prisma.sql`${formatPgVectorLiteral(vec)}::vector`
                : Prisma.sql`NULL`;
              const embModel = vec ? RAG_CONFIG.embedding.model : null;
              const embDim = vec ? RAG_CONFIG.embedding.dimension : null;

              return Prisma.sql`(
                ${chunkKey},
                ${upsertedDoc.id},
                ${ch.content},
                ${ch.sectionTitle},
                ${ch.startPage},
                ${ch.endPage},
                ${ch.position},
                ${ch.contentHash},
                ${embModel},
                ${embDim},
                ${vecExpr}
              )`;
            })
          );

          await tx.$executeRaw`
            INSERT INTO "RagChunk" (
              "chunkKey",
              "documentId",
              "content",
              "sectionTitle",
              "startPage",
              "endPage",
              "position",
              "contentHash",
              "embeddingModel",
              "embeddingDim",
              "embedding"
            )
            VALUES ${valuesSql}
          `;
        }
      },
      { timeout: 60000 }
    );

    summary.processed++;
    summary.totalChunksIndexed += structuralChunks.length;
    summary.details.push({
      filename,
      action: "processed",
      chunksCount: structuralChunks.length,
      pageCount: extracted.pageCount,
      totalWords: extracted.totalWords,
    });
    log(
      `[ok] ${filename}: ${extracted.pageCount} páginas, ${structuralChunks.length} chunks indexados.`
    );
  }

  return summary;
}
