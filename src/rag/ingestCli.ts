import "dotenv/config";
import "../database";
import prisma from "../database";
import { ingestAcervoPdfs } from "./ingestService";

async function main() {
  const args = new Set(process.argv.slice(2));
  const force = args.has("--force");
  const allowLexicalOnly = args.has("--lexical-only");

  console.log("=== Ingestão Documental do Acervo CuiDA ===");
  if (force) console.log("Modo --force ativado: todos os PDFs serão reprocessados.");
  if (allowLexicalOnly) console.log("Modo --lexical-only: embeddings ignorados se GEMINI_API_KEY ausente.");

  const summary = await ingestAcervoPdfs({ force, allowLexicalOnly });
  console.log("\n=== Resumo da Ingestão ===");
  console.log(
    JSON.stringify(
      {
        processed: summary.processed,
        skipped: summary.skipped,
        needsOcr: summary.needsOcr,
        failed: summary.failed,
        removed: summary.removed,
        totalChunksIndexed: summary.totalChunksIndexed,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Erro na ingestão RAG:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
