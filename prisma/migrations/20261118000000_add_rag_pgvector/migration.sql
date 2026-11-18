-- Enable pgvector (and unaccent if supported) before creating RAG tables
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateTable
CREATE TABLE "RagDocument" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "title" TEXT,
    "authorOrInstitution" TEXT,
    "publicationYear" TEXT,
    "documentType" TEXT,
    "focus" TEXT,
    "metadataSource" TEXT,
    "fileHash" TEXT NOT NULL,
    "pageCount" INTEGER,
    "totalWords" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "errorMessage" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagChunk" (
    "id" SERIAL NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sectionTitle" TEXT,
    "startPage" INTEGER NOT NULL,
    "endPage" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embeddingModel" TEXT,
    "embeddingDim" INTEGER,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RagDocument_filename_key" ON "RagDocument"("filename");

-- CreateIndex
CREATE INDEX "RagDocument_status_idx" ON "RagDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RagChunk_chunkKey_key" ON "RagChunk"("chunkKey");

-- CreateIndex
CREATE INDEX "RagChunk_documentId_position_idx" ON "RagChunk"("documentId", "position");

-- CreateIndex
CREATE INDEX "RagChunk_startPage_endPage_idx" ON "RagChunk"("startPage", "endPage");

-- HNSW index for fast cosine similarity search on 768-d Gemini embeddings
CREATE INDEX "RagChunk_embedding_hnsw_idx"
    ON "RagChunk" USING hnsw ("embedding" vector_cosine_ops);

-- GIN full-text search indexes for Brazilian Portuguese stemming and exact/international clinical terms
CREATE INDEX "RagChunk_fts_pt_idx"
    ON "RagChunk" USING gin (to_tsvector('portuguese', coalesce("sectionTitle", '') || ' ' || "content"));

CREATE INDEX "RagChunk_fts_simple_idx"
    ON "RagChunk" USING gin (to_tsvector('simple', coalesce("sectionTitle", '') || ' ' || "content"));

-- AddForeignKey
ALTER TABLE "RagChunk" ADD CONSTRAINT "RagChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
