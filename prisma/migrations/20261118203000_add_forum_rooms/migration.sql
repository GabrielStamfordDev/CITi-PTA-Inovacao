-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumRoom" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "icone" TEXT NOT NULL DEFAULT 'messages-square',
    "cor" TEXT NOT NULL DEFAULT 'emerald',
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ForumRoom_slug_key" ON "ForumRoom"("slug");
CREATE INDEX IF NOT EXISTS "ForumRoom_ordem_idx" ON "ForumRoom"("ordem");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ForumMembership_userId_roomId_key" ON "ForumMembership"("userId", "roomId");
CREATE INDEX IF NOT EXISTS "ForumMembership_roomId_idx" ON "ForumMembership"("roomId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ForumMembership_userId_fkey'
    ) THEN
        ALTER TABLE "ForumMembership"
        ADD CONSTRAINT "ForumMembership_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ForumMembership_roomId_fkey'
    ) THEN
        ALTER TABLE "ForumMembership"
        ADD CONSTRAINT "ForumMembership_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "ForumRoom"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed default room before adding NOT NULL constraint on existing ForumMessage rows
INSERT INTO "ForumRoom" ("slug", "nome", "descricao", "categoria", "icone", "cor", "padrao", "ordem")
VALUES (
    'acolhimento-geral',
    'Acolhimento Geral',
    'Espaço principal para boas-vindas, trocas diárias e apoio entre todos os cuidadores.',
    'Geral',
    'heart-handshake',
    'purple',
    true,
    1
)
ON CONFLICT ("slug") DO NOTHING;

-- Add nullable roomId column to ForumMessage first (zero data loss)
ALTER TABLE "ForumMessage" ADD COLUMN IF NOT EXISTS "roomId" INTEGER;

-- Backfill existing messages into Acolhimento Geral
UPDATE "ForumMessage"
SET "roomId" = (SELECT "id" FROM "ForumRoom" WHERE "slug" = 'acolhimento-geral' LIMIT 1)
WHERE "roomId" IS NULL;

-- Backfill all existing users as members of Acolhimento Geral
INSERT INTO "ForumMembership" ("userId", "roomId")
SELECT u."id", r."id"
FROM "User" u
CROSS JOIN "ForumRoom" r
WHERE r."slug" = 'acolhimento-geral'
ON CONFLICT ("userId", "roomId") DO NOTHING;

-- Enforce NOT NULL, FK, and composite index
ALTER TABLE "ForumMessage" ALTER COLUMN "roomId" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ForumMessage_roomId_fkey'
    ) THEN
        ALTER TABLE "ForumMessage"
        ADD CONSTRAINT "ForumMessage_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "ForumRoom"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ForumMessage_roomId_createdAt_idx" ON "ForumMessage"("roomId", "createdAt");
