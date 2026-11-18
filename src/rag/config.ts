/**
 * Central configuration for CuiDA's hybrid RAG pipeline.
 * Thresholds and retrieval parameters are configurable via environment variables
 * and calibrated against the empirical evaluation suite (`yarn rag:eval`).
 */
export const RAG_CONFIG = {
  embedding: {
    model: "gemini-embedding-001",
    dimension: 768,
    batchSize: Number(process.env.RAG_EMBED_BATCH_SIZE || 20),
    batchDelayMs: Number(process.env.RAG_EMBED_DELAY_MS || 350),
    queryCacheMaxEntries: 128,
    queryCacheTtlMs: 15 * 60 * 1000,
    timeoutMs: Number(process.env.RAG_EMBED_TIMEOUT_MS || 20000),
  },
  chunking: {
    targetChars: Number(process.env.RAG_CHUNK_TARGET_CHARS || 1350),
    maxChars: Number(process.env.RAG_CHUNK_MAX_CHARS || 1950),
    minChars: Number(process.env.RAG_CHUNK_MIN_CHARS || 220),
    overlapChars: Number(process.env.RAG_CHUNK_OVERLAP_CHARS || 220),
  },
  extraction: {
    minCharsForTextPdf: 180,
    minAvgCharsPerPage: 45,
    minReadableWords: 30,
  },
  retrieval: {
    vectorTopK: Number(process.env.RAG_VECTOR_TOP_K || 24),
    lexicalTopK: Number(process.env.RAG_LEXICAL_TOP_K || 24),
    finalTopK: Number(process.env.RAG_FINAL_TOP_K || 6),
    maxChunksPerDoc: Number(process.env.RAG_MAX_CHUNKS_PER_DOC || 2),
    rrfK: Number(process.env.RAG_RRF_K || 60),
    vectorWeight: Number(process.env.RAG_VECTOR_WEIGHT || 1.0),
    lexicalWeight: Number(process.env.RAG_LEXICAL_WEIGHT || 0.85),
    // Empirically calibrated thresholds (tuned after running yarn rag:eval + clinical negative probes)
    minCosineForStrong: Number(process.env.RAG_MIN_COSINE_STRONG || 0.65),
    minCosineForPartial: Number(process.env.RAG_MIN_COSINE_PARTIAL || 0.62),
    minLexicalForStrong: Number(process.env.RAG_MIN_LEXICAL_STRONG || 0.16),
    minLexicalForPartial: Number(process.env.RAG_MIN_LEXICAL_PARTIAL || 0.09),
  },
} as const;
