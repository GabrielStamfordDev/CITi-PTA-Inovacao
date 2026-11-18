import "dotenv/config";
import "../database";
import prisma from "../database";
import { SCIENTIFIC_CHUNKS } from "../data/acervoCientifico";
import { answerCaregiverQuestion } from "../services/AssistantService";
import { normalizeForMatching, retrieveHybridRagContext } from "./retriever";

interface EvalCase {
  id: number;
  category: string;
  question: string;
  expectedDocs: string[];
  expectedTopicRegex: RegExp;
  expectNoEvidence?: boolean;
}

const EVAL_DATASET: EvalCase[] = [
  {
    id: 1,
    category: "Resistência ao banho",
    question: "Ele não quer entrar no chuveiro e fica muito irritado na hora do banho. Como conduzir?",
    expectedDocs: ["API_04-Banho.pdf", "abraz-orientacoes.pdf", "API_02-iSupport-DA.pdf"],
    expectedTopicRegex: /banho|higien|privacid|toalh|temperatura|agua|chuveir|dignidad/i,
  },
  {
    id: 2,
    category: "Dificuldade de alimentação",
    question:
      "Minha mãe com Alzheimer está recusando comida ou demorando para engolir nas refeições. Como ajudar?",
    expectedDocs: [
      "abraz-orientacoes.pdf",
      "API_02-iSupport-DA.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
    ],
    expectedTopicRegex: /alimenta|refei|engol|deglut|comer|comida|nutri|apetit|eat|swallow/i,
  },
  {
    id: 3,
    category: "Recusa de medicamentos",
    question: "Meu pai fecha a boca e se recusa a tomar os remédios na hora certa. Como agir?",
    expectedDocs: [
      "abraz-orientacoes.pdf",
      "API_02-iSupport-DA.pdf",
      "API_01-MS-PCDT-DA.pdf",
    ],
    expectedTopicRegex: /medic|remed|farmac|comprim|tomar|adesao|tratament|medicac/i,
  },
  {
    id: 4,
    category: "Agitação no fim da tarde",
    question:
      "Quando vai escurecendo no fim da tarde, ela fica inquieta e quer ir embora para casa. O que fazer?",
    expectedDocs: [
      "drlucasgeriatra-idoso-quer-sair-de-casa.pdf",
      "abraz-orientacoes.pdf",
      "API_05-Dialogo.pdf",
      "API_02-iSupport-DA.pdf",
    ],
    expectedTopicRegex: /entardec|sundown|tarde|sair de casa|ir embora|valid|ilumin|noite/i,
  },
  {
    id: 5,
    category: "Insônia e alterações do sono",
    question: "Minha mãe está acordando várias vezes durante a madrugada. Como posso ajudá-la?",
    expectedDocs: [
      "API_02-iSupport-DA.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
      "abraz-orientacoes.pdf",
      "drlucasgeriatra-perambulacao-no-alzheimer.pdf",
    ],
    expectedTopicRegex: /sono|sleep|dormir|madrugad|noturn|noite|night|rotina|insoni/i,
  },
  {
    id: 6,
    category: "Perambulação e risco de sair de casa",
    question:
      "Ele anda sem parar pela casa e tenta sair sozinho para a rua. Como prevenir que se perca?",
    expectedDocs: [
      "drlucasgeriatra-perambulacao-no-alzheimer.pdf",
      "drlucasgeriatra-idoso-quer-sair-de-casa.pdf",
      "abraz-orientacoes.pdf",
      "API_02-iSupport-DA.pdf",
    ],
    expectedTopicRegex: /perambul|wandering|andar|identifica|pulseira|porta|rua|desaparec|sair/i,
  },
  {
    id: 7,
    category: "Repetição de perguntas",
    question:
      "Ele pergunta a mesma coisa dezenas de vezes seguidas. Como responder sem perder a paciência?",
    expectedDocs: ["API_05-Dialogo.pdf", "API_02-iSupport-DA.pdf", "abraz-orientacoes.pdf"],
    expectedTopicRegex: /repet|mesma pergunta|dialog|valid|calma|emoca|distra|comunic/i,
  },
  {
    id: 8,
    category: "Agressividade e alucinações",
    question:
      "Minha mãe enxerga pessoas na sala que não existem e fica agressiva quando tento explicar. O que fazer?",
    expectedDocs: [
      "API_02-iSupport-DA.pdf",
      "API_05-Dialogo.pdf",
      "abraz-orientacoes.pdf",
      "API_01-MS-PCDT-DA.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
    ],
    expectedTopicRegex: /alucinac|delir|agress|agitac|confront|valid|medo|hallucin|distress|agitat/i,
  },
  {
    id: 9,
    category: "Sobrecarga emocional do cuidador",
    question:
      "Estou me sentindo exausta, culpada e chorando sozinha cuidando dele. Como lidar com esse desgaste?",
    expectedDocs: [
      "API_02-iSupport-DA.pdf",
      "abraz-orientacoes.pdf",
      "API_01-MS-PCDT-DA.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
    ],
    expectedTopicRegex: /sobrecarg|estress|esgot|exaust|cuidar|autocuidado|carer|apoio|stress|sad|depress/i,
  },
  {
    id: 10,
    category: "Organização de grupos de apoio",
    question:
      "Como funcionam os grupos de apoio para familiares e como encontrar ou organizar auxílio mútuo?",
    expectedDocs: [
      "abraz-orientacoes.pdf",
      "API_02-iSupport-DA.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
    ],
    expectedTopicRegex: /grupo|apoio|abraz|suporte|support|familiar|rede|encontr|peer|carer/i,
  },
  {
    id: 11,
    category: "Direitos e acesso a medicamentos no SUS",
    question:
      "Quais remédios de Alzheimer são distribuídos gratuitamente pelo SUS e quais direitos o paciente e o cuidador têm?",
    expectedDocs: [
      "API_01-MS-PCDT-DA.pdf",
      "abraz-orientacoes.pdf",
      "API_03-dementia-assessment-management-and-support.pdf",
    ],
    expectedTopicRegex: /sus|pcdt|donepez|rivastigm|galantam|memantin|direito|benefic|receita|gratuit|medic/i,
  },
  {
    id: 12,
    category: "Fora de escopo (culinária)",
    question: "Qual a receita passo a passo de bolo de chocolate fofinho com cobertura de brigadeiro?",
    expectedDocs: [],
    expectedTopicRegex: /$^/,
    expectNoEvidence: true,
  },
  {
    id: 13,
    category: "Sem resposta no acervo (posologia específica de diabetes)",
    question:
      "Quantas unidades internacionais exatas de insulina NPH devo aplicar antes do jantar hoje?",
    expectedDocs: [],
    expectedTopicRegex: /$^/,
    expectNoEvidence: true,
  },
];

function evaluateLegacyBaseline(evalCase: EvalCase) {
  const normQ = normalizeForMatching(evalCase.question);
  const tokens = normQ
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const scored = SCIENTIFIC_CHUNKS.map((chunk) => {
    let score = 0;
    for (const kw of chunk.keywords) {
      const nkw = normalizeForMatching(kw);
      if (normQ.includes(nkw)) score += nkw.includes(" ") ? 12 : 7;
      else tokens.forEach((t) => { if (nkw.includes(t)) score += 3; });
    }
    const body = normalizeForMatching(`${chunk.topic} ${chunk.whyItHappens} ${chunk.whatToDo.join(" ")}`);
    tokens.forEach((t) => { if (body.includes(t)) score += 1.5; });
    return { chunk, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Old system fell back to [4, 0, 8] when nothing matched!
  const chosen = scored.length
    ? scored.slice(0, 3).map((x) => x.chunk)
    : [SCIENTIFIC_CHUNKS[4], SCIENTIFIC_CHUNKS[0], SCIENTIFIC_CHUNKS[8]].filter(Boolean);

  if (evalCase.expectNoEvidence) {
    return {
      precisionAtK: chosen.length === 0 ? 1 : 0,
      docRecall: 0,
      mrr: 0,
      correctlyRefused: chosen.length === 0,
      distinctDocs: new Set(chosen.map((c) => c.sourceFile)).size,
      pagesCount: 0,
    };
  }

  const hits = chosen.map((c) => {
    const body = `${c.topic} ${c.whyItHappens} ${c.whatToDo.join(" ")}`;
    return (
      evalCase.expectedDocs.includes(c.sourceFile) &&
      evalCase.expectedTopicRegex.test(normalizeForMatching(body))
    );
  });

  const relDocs = new Set(
    chosen.filter((_, idx) => hits[idx]).map((c) => c.sourceFile)
  );
  const firstRelIdx = hits.findIndex(Boolean);

  return {
    precisionAtK: chosen.length ? hits.filter(Boolean).length / chosen.length : 0,
    docRecall: evalCase.expectedDocs.length ? relDocs.size / evalCase.expectedDocs.length : 0,
    mrr: firstRelIdx >= 0 ? 1 / (firstRelIdx + 1) : 0,
    correctlyRefused: false,
    distinctDocs: new Set(chosen.map((c) => c.sourceFile)).size,
    pagesCount: 0,
  };
}

async function main() {
  const withLlm = process.argv.includes("--with-llm");
  console.log("=== Avaliação Objetiva do RAG Híbrido CuiDA (13 Casos) ===\n");

  const inScopeCases = EVAL_DATASET.filter((c) => !c.expectNoEvidence);
  const noEvidenceCases = EVAL_DATASET.filter((c) => c.expectNoEvidence);

  let sumPrecision = 0;
  let sumDocRecall = 0;
  let sumMrr = 0;
  let sumHitRate = 0;
  let sumDistinctDocs = 0;

  let legSumPrecision = 0;
  let legSumDocRecall = 0;
  let legSumMrr = 0;
  let legSumHitRate = 0;

  let noEvidenceCorrect = 0;
  let legNoEvidenceCorrect = 0;

  for (const tc of EVAL_DATASET) {
    const res = await retrieveHybridRagContext(tc.question, { topK: 6 });
    await new Promise((r) => setTimeout(r, 1200));
    const legacy = evaluateLegacyBaseline(tc);

    if (tc.expectNoEvidence) {
      const refused =
        (res.evidenceStatus === "insufficient" || res.evidenceStatus === "out_of_scope") &&
        res.chunks.length === 0;
      if (refused) noEvidenceCorrect++;
      if (legacy.correctlyRefused) legNoEvidenceCorrect++;

      console.log(
        `[${refused ? "PASS" : "FAIL"}] #${tc.id} (${tc.category}) -> status=${res.evidenceStatus}, chunks=${res.chunks.length}, bestCos=${res.diagnostics.bestCosine.toFixed(3)}`
      );
      continue;
    }

    const relevanceFlags = res.chunks.map((c) => {
      const textNorm = normalizeForMatching(`${c.sectionTitle || ""} ${c.content}`);
      return tc.expectedDocs.includes(c.filename) && tc.expectedTopicRegex.test(textNorm);
    });

    const relevantCount = relevanceFlags.filter(Boolean).length;
    const hit = relevantCount > 0 ? 1 : 0;
    const precisionAt6 = res.chunks.length ? relevantCount / res.chunks.length : 0;
    const matchedDocs = new Set(
      res.chunks.filter((_, idx) => relevanceFlags[idx]).map((c) => c.filename)
    );
    const docRecall = tc.expectedDocs.length ? matchedDocs.size / tc.expectedDocs.length : 0;
    const firstRelIdx = relevanceFlags.findIndex(Boolean);
    const mrr = firstRelIdx >= 0 ? 1 / (firstRelIdx + 1) : 0;

    sumPrecision += precisionAt6;
    sumDocRecall += docRecall;
    sumMrr += mrr;
    sumHitRate += hit;
    sumDistinctDocs += res.diagnostics.distinctDocuments;

    legSumPrecision += legacy.precisionAtK;
    legSumDocRecall += legacy.docRecall;
    legSumMrr += legacy.mrr;
    legSumHitRate += legacy.mrr > 0 ? 1 : 0;

    const citedSummary = res.chunks
      .slice(0, 4)
      .map((c) => `${c.filename}#p${c.startPage}`)
      .join(", ");

    console.log(
      `[${hit ? "PASS" : "MISS"}] #${tc.id} (${tc.category}) | status=${res.evidenceStatus} | Hit=${hit} | P@6=${precisionAt6.toFixed(
        2
      )} | DocRec=${docRecall.toFixed(2)} | MRR=${mrr.toFixed(2)} | Docs=${
        res.diagnostics.distinctDocuments
      } | Cos=${res.diagnostics.bestCosine.toFixed(3)}`
    );
    console.log(`   Top chunks: ${citedSummary}`);
  }

  const n = inScopeCases.length;
  console.log("\n=== Comparativo: Novo RAG Híbrido (PDFs Integrais + pgvector/FTS) vs Legado ===");
  console.log(
    JSON.stringify(
      {
        novoRagHibrido: {
          hitAt6: Number((sumHitRate / n).toFixed(3)),
          precisionAt6: Number((sumPrecision / n).toFixed(3)),
          docRecallAt6: Number((sumDocRecall / n).toFixed(3)),
          mrr: Number((sumMrr / n).toFixed(3)),
          avgDistinctDocsPerQuery: Number((sumDistinctDocs / n).toFixed(2)),
          outOfScopeRefusalRate: `${noEvidenceCorrect}/${noEvidenceCases.length}`,
        },
        ragLegadoCurado: {
          hitAt3: Number((legSumHitRate / n).toFixed(3)),
          precisionAt3: Number((legSumPrecision / n).toFixed(3)),
          docRecallAt3: Number((legSumDocRecall / n).toFixed(3)),
          mrr: Number((legSumMrr / n).toFixed(3)),
          outOfScopeRefusalRate: `${legNoEvidenceCorrect}/${noEvidenceCases.length}`,
        },
      },
      null,
      2
    )
  );

  if (withLlm) {
    console.log("\n=== Teste Ponta a Ponta com Gemini + Verificação de Citações (#page=N) ===");
    const e2eSamples = [
      EVAL_DATASET[0].question, // chuveiro -> banho
      EVAL_DATASET[4].question, // madrugada -> multi-doc sono
      EVAL_DATASET[11].question, // bolo de chocolate -> recusa
    ];
    for (const q of e2eSamples) {
      const ans = await answerCaregiverQuestion({
        question: q,
        user: { nome: "Maria Silva", pessoaComAlzheimer: "Dona Tereza", estagioDaDoenca: "Moderado" },
        history: [],
      });
      console.log(
        JSON.stringify({
          question: q.slice(0, 65),
          engine: ans.engine,
          evidenceStatus: ans.evidenceStatus,
          sources: ans.sources.map((s) => ({
            file: s.filename,
            page: s.startPage,
            pageUrl: s.pageUrl,
            section: s.sectionTitle,
          })),
          answerPreview: ans.answer.slice(0, 180).replace(/\s+/g, " "),
        })
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("Erro na avaliação RAG:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
