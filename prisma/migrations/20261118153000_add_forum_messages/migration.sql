-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumMessage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumMessage_createdAt_idx" ON "ForumMessage"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ForumMessage_userId_fkey'
    ) THEN
        ALTER TABLE "ForumMessage"
        ADD CONSTRAINT "ForumMessage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
