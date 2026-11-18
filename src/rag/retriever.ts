import { Prisma } from "@prisma/client";
import prisma from "../database";
import { RAG_CONFIG } from "./config";
import { embedQueryText, formatPgVectorLiteral } from "./embeddingClient";

export type EvidenceStatus =
  | "sufficient"
  | "partial"
  | "ambiguous"
  | "insufficient"
  | "out_of_scope";

export interface RetrievedRagChunk {
  id: number;
  chunkKey: string;
  documentId: number;
  filename: string;
  docTitle: string | null;
  authorOrInstitution: string | null;
  publicationYear: string | null;
  documentType: string | null;
  content: string;
  sectionTitle: string | null;
  startPage: number;
  endPage: number;
  position: number;
  vectorRank: number | null;
  lexicalRank: number | null;
  cosineSim: number;
  lexicalScore: number;
  rrfScore: number;
}

export interface HybridRetrievalResult {
  indexAvailable: boolean;
  indexedDocumentsCount: number;
  indexedChunksCount: number;
  evidenceStatus: EvidenceStatus;
  chunks: RetrievedRagChunk[];
  diagnostics: {
    usedVectorSearch: boolean;
    usedLexicalSearch: boolean;
    vectorCandidates: number;
    lexicalCandidates: number;
    bestCosine: number;
    bestLexical: number;
    distinctDocuments: number;
  };
}

const PT_STOPWORDS = new Set([
  "a", "o", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "para", "por", "com", "sem", "sob", "que", "quem",
  "qual", "quais", "como", "quando", "onde", "porque", "se", "ao", "aos",
  "as", "os", "meu", "minha", "meus", "minhas", "seu", "sua", "seus", "suas",
  "ele", "ela", "eles", "elas", "isso", "isto", "aquilo", "esta", "este", "estao",
  "tem", "tenho", "ter", "pode", "posso", "devo", "deve", "fazer", "faco", "faz",
  "muito", "muita", "muitos", "muitas", "mais", "menos", "nao", "sim", "sobre",
  "aqui", "la", "ate", "entre", "ja", "vai", "vou", "estava", "sao", "ser",
  "foi", "pessoa", "idoso", "idosa", "alzheimer", "demencia", "cuidador", "cuidadora",
  "familiar", "mae", "pai", "avo", "ajuda", "ajudar", "dica", "dicas",
  "passo", "antes", "depois", "hoje", "ontem", "agora", "vezes", "coisa", "coisas",
  "dezenas", "seguidas", "momento", "hora", "certa", "agir", "fecha", "tento",
  "explicar", "lidar", "preciso", "saber", "exatas", "exata", "aplicar", "unidades",
]);

const DOMAIN_LEXICAL_EXPANSIONS: { pattern: RegExp; extras: string[] }[] = [
  {
    pattern: /\b(chuveiro|banheira|lavar|tomar banho|banho|higiene)\b/,
    extras: ["banho", "higiene", "agua", "privacidade", "toalha", "bathing", "washing", "shower"],
  },
  {
    pattern: /\b(dormir|madrugada|acorda|acordando|noite|insonia|sono)\b/,
    extras: ["sono", "noturno", "noite", "insonia", "rotina", "entardecer", "sleep", "night", "sleeping"],
  },
  {
    pattern: /\b(tarde|entardecer|escurecer|fim da tarde|por do sol|inquieta)\b/,
    extras: ["entardecer", "sundowning", "agitacao", "iluminacao", "tarde", "evening", "restless"],
  },
  {
    pattern: /\b(sair de casa|ir embora|voltar para casa|fugir|fuga|mala|tranca|porta)\b/,
    extras: ["sair", "casa", "validacao", "redirecionar", "seguranca", "perambulacao", "wandering", "home"],
  },
  {
    pattern: /\b(andar|anda sem parar|andando|perambulacao|caminhar|se perder)\b/,
    extras: ["perambulacao", "wandering", "identificacao", "seguranca", "walking"],
  },
  {
    pattern: /\b(remedio|remedios|medicamento|medicamentos|comprimido|sus|receita medica|tratamento)\b/,
    extras: ["medicamento", "tratamento", "sus", "pcdt", "donepezila", "rivastigmina", "galantamina", "memantina", "medication"],
  },
  {
    pattern: /\b(comer|alimentacao|comida|engasg|engolir|apetite|emagrec|refeicoes|refeicao)\b/,
    extras: ["alimentacao", "refeicao", "engasgo", "degluticao", "hidratacao", "eating", "feeding", "swallowing"],
  },
  {
    pattern: /\b(repet|mesma pergunta|perguntando|conversa|dialogo|teimos|paciencia)\b/,
    extras: ["repeticao", "comunicacao", "validacao", "dialogo", "calma", "repeating", "communication"],
  },
  {
    pattern: /\b(agressiv|bate|xing|alucinac|delirio|enxerg|vozes|desconfia|acusar)\b/,
    extras: ["agitacao", "agressividade", "alucinacoes", "delirio", "validacao", "aggression", "hallucinations", "delusions"],
  },
  {
    pattern: /\b(cansad|exausta|exaust|chorando|culpa|sozinho|sozinha|depress|sobrecarga|desgaste|estresse|grupo|apoio|direito|beneficio|imposto|curatela)\b/,
    extras: ["cuidador", "autocuidado", "sobrecarga", "apoio", "direitos", "isupport", "abraz", "stress", "carer", "support"],
  },
];

export function normalizeForMatching(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractCoreTokens(question: string): string[] {
  return normalizeForMatching(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PT_STOPWORDS.has(w));
}

function buildLexicalSearchTerms(question: string): { coreTerms: string[]; allTerms: string[] } {
  const norm = normalizeForMatching(question);
  const coreTerms = Array.from(new Set(extractCoreTokens(question))).slice(0, 12);
  const extraSet = new Set<string>();

  for (const exp of DOMAIN_LEXICAL_EXPANSIONS) {
    if (exp.pattern.test(norm)) {
      for (const word of exp.extras) {
        extraSet.add(word);
      }
    }
  }

  const allTerms = Array.from(new Set([...coreTerms, ...extraSet])).slice(0, 18);
  return { coreTerms, allTerms };
}

function buildSafeOrTsQuery(terms: string[]): string {
  const sanitized = terms
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  if (!sanitized.length) return "";
  return sanitized.map((t) => `${t}:*`).join(" | ");
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeForMatching(a).split(/\s+/).filter((w) => w.length > 3));
  const setB = new Set(normalizeForMatching(b).split(/\s+/).filter((w) => w.length > 3));
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeCoreTermCoverage(
  coreTerms: string[],
  matchedExtras: string[],
  chunks: RetrievedRagChunk[]
): number {
  if (!chunks.length) return 0;
  const corpus = normalizeForMatching(
    chunks.map((c) => `${c.docTitle || ""} ${c.sectionTitle || ""} ${c.content}`).join(" ")
  );

  let coreMatched = 0;
  for (const term of coreTerms) {
    const stem = term.length >= 6 ? term.slice(0, term.length - 2) : term;
    if (corpus.includes(term) || (stem.length >= 4 && corpus.includes(stem))) {
      coreMatched++;
    }
  }
  const coreRatio = coreTerms.length ? coreMatched / coreTerms.length : 0;

  if (!matchedExtras.length) return coreRatio;
  const extrasMatched = matchedExtras.filter((e) => corpus.includes(e)).length;
  const extraRatio = Math.min(1, extrasMatched / Math.min(3, matchedExtras.length));
  return Math.max(coreRatio, extraRatio * 0.9);
}

const OBVIOUS_NON_CARE_REGEX =
  /\b(bolo|chocolate|brigadeiro|receita culinaria|futebol|campeonato|bitcoin|criptomoeda|javascript|python|sql|programacao|novela|horoscopo)\b/;

function classifyEvidence(params: {
  question: string;
  coreTerms: string[];
  domainExtras: string[];
  hasDomainExpansion: boolean;
  ranked: RetrievedRagChunk[];
  usedVectorSearch: boolean;
}): EvidenceStatus {
  const { ranked, coreTerms, domainExtras, hasDomainExpansion, usedVectorSearch } = params;
  const normQuestion = normalizeForMatching(params.question);
  const wordCount = normQuestion.split(/\s+/).filter((w) => w.length >= 2).length;

  if (!ranked.length) {
    if (OBVIOUS_NON_CARE_REGEX.test(normQuestion)) return "out_of_scope";
    return wordCount <= 3 && !hasDomainExpansion ? "ambiguous" : "insufficient";
  }

  const bestCosine = Math.max(...ranked.map((r) => r.cosineSim), 0);
  const bestLexical = Math.max(...ranked.map((r) => r.lexicalScore), 0);
  const termCoverage = computeCoreTermCoverage(coreTerms, domainExtras, ranked);

  // Detect clearly underspecified one/two-word messages ("ajuda", "remédio", "como?")
  if (coreTerms.length <= 1 && wordCount <= 3 && !hasDomainExpansion) {
    return "ambiguous";
  }

  // Explicitly guard unrelated topics and unseen drug/dosage specificity (e.g. insulin dosage)
  if (OBVIOUS_NON_CARE_REGEX.test(normQuestion) && (!usedVectorSearch || bestCosine < 0.6)) {
    return "out_of_scope";
  }
  if (
    /\b(dosagem|unidade|unidades|insulina|nph|ibuprofeno|warfarina|amoxicilina|posologia)\b/.test(
      normQuestion
    ) &&
    computeCoreTermCoverage(coreTerms, [], ranked) < 0.45
  ) {
    return "insufficient";
  }

  if (usedVectorSearch) {
    const passesPartialVector = bestCosine >= RAG_CONFIG.retrieval.minCosineForPartial;
    const passesStrongVector = bestCosine >= RAG_CONFIG.retrieval.minCosineForStrong;
    const passesStrongLexical =
      bestLexical >= RAG_CONFIG.retrieval.minLexicalForStrong && termCoverage >= 0.35;

    if (!passesPartialVector && !passesStrongLexical) {
      return bestCosine < RAG_CONFIG.retrieval.minCosineForPartial && !hasDomainExpansion
        ? "out_of_scope"
        : "insufficient";
    }

    if (passesStrongVector || (passesPartialVector && passesStrongLexical)) {
      return "sufficient";
    }

    return "partial";
  }

  // Lexical-only mode (when GEMINI_API_KEY is absent or embed quota paused)
  if (!hasDomainExpansion && termCoverage < 0.35) {
    return "insufficient";
  }
  if (bestLexical >= RAG_CONFIG.retrieval.minLexicalForStrong && termCoverage >= 0.35) {
    return "sufficient";
  }
  if (bestLexical >= RAG_CONFIG.retrieval.minLexicalForPartial && termCoverage >= 0.22) {
    return "partial";
  }
  return "insufficient";
}

export async function getIndexedAcervoStats(): Promise<{
  documentsCount: number;
  chunksCount: number;
  activeFilenames: string[];
}> {
  try {
    const docs = await prisma.ragDocument.findMany({
      where: { status: "processed" },
      select: {
        filename: true,
        _count: { select: { chunks: true } },
      },
    });

    const active = docs.filter((d) => d._count.chunks > 0);
    const chunksCount = active.reduce((sum, d) => sum + d._count.chunks, 0);

    return {
      documentsCount: active.length,
      chunksCount,
      activeFilenames: active.map((d) => d.filename),
    };
  } catch {
    return {
      documentsCount: 0,
      chunksCount: 0,
      activeFilenames: [],
    };
  }
}

/**
 * Executes Hybrid Search (pgvector cosine similarity + PostgreSQL PT-BR/Simple FTS)
 * combined via Reciprocal Rank Fusion (RRF), deduplication, and multi-document diversification.
 */
export async function retrieveHybridRagContext(
  rawQuestion: string,
  options?: {
    topK?: number;
    maxChunksPerDoc?: number;
    forceLexicalOnly?: boolean;
  }
): Promise<HybridRetrievalResult> {
  const question = String(rawQuestion || "").trim();
  const finalTopK = options?.topK ?? RAG_CONFIG.retrieval.finalTopK;
  const maxChunksPerDoc = options?.maxChunksPerDoc ?? RAG_CONFIG.retrieval.maxChunksPerDoc;

  const stats = await getIndexedAcervoStats();
  if (stats.chunksCount === 0) {
    return {
      indexAvailable: false,
      indexedDocumentsCount: 0,
      indexedChunksCount: 0,
      evidenceStatus: "insufficient",
      chunks: [],
      diagnostics: {
        usedVectorSearch: false,
        usedLexicalSearch: false,
        vectorCandidates: 0,
        lexicalCandidates: 0,
        bestCosine: 0,
        bestLexical: 0,
        distinctDocuments: 0,
      },
    };
  }

  const normQuestion = normalizeForMatching(question);
  const { coreTerms, allTerms } = buildLexicalSearchTerms(question);
  const hasDomainExpansion = DOMAIN_LEXICAL_EXPANSIONS.some((exp) => exp.pattern.test(normQuestion));

  const queryVector = options?.forceLexicalOnly ? null : await embedQueryText(question);

  type RawRow = {
    id: number;
    chunkKey: string;
    documentId: number;
    filename: string;
    docTitle: string | null;
    authorOrInstitution: string | null;
    publicationYear: string | null;
    documentType: string | null;
    content: string;
    sectionTitle: string | null;
    startPage: number;
    endPage: number;
    position: number;
    score: number;
  };

  let vectorRows: RawRow[] = [];
  let lexicalRows: RawRow[] = [];

  if (queryVector) {
    const vecLiteral = formatPgVectorLiteral(queryVector);
    vectorRows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c."chunkKey",
        c."documentId",
        d.filename,
        d.title AS "docTitle",
        d."authorOrInstitution",
        d."publicationYear",
        d."documentType",
        c.content,
        c."sectionTitle",
        c."startPage",
        c."endPage",
        c.position,
        (1 - (c.embedding <=> ${vecLiteral}::vector))::float8 AS score
      FROM "RagChunk" c
      INNER JOIN "RagDocument" d ON d.id = c."documentId"
      WHERE d.status = 'processed'
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${vecLiteral}::vector ASC
      LIMIT ${RAG_CONFIG.retrieval.vectorTopK}
    `;
  }

  const orTsQuery = buildSafeOrTsQuery(allTerms);
  if (orTsQuery) {
    const coreTsQuery = buildSafeOrTsQuery(coreTerms);
    lexicalRows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id,
        c."chunkKey",
        c."documentId",
        d.filename,
        d.title AS "docTitle",
        d."authorOrInstitution",
        d."publicationYear",
        d."documentType",
        c.content,
        c."sectionTitle",
        c."startPage",
        c."endPage",
        c.position,
        (
          ts_rank_cd(
            to_tsvector('portuguese', coalesce(c."sectionTitle", '') || ' ' || c.content),
            to_tsquery('portuguese', ${orTsQuery})
          )
          +
          ts_rank_cd(
            to_tsvector('simple', coalesce(c."sectionTitle", '') || ' ' || c.content),
            to_tsquery('simple', ${orTsQuery})
          ) * 0.5
          +
          CASE
            WHEN ${coreTsQuery} <> '' THEN
              ts_rank_cd(
                to_tsvector('portuguese', coalesce(c."sectionTitle", '') || ' ' || coalesce(d.title, '')),
                to_tsquery('portuguese', ${coreTsQuery})
              ) * 0.8
            ELSE 0
          END
        )::float8 AS score
      FROM "RagChunk" c
      INNER JOIN "RagDocument" d ON d.id = c."documentId"
      WHERE d.status = 'processed'
        AND (
          to_tsvector('portuguese', coalesce(c."sectionTitle", '') || ' ' || c.content)
            @@ to_tsquery('portuguese', ${orTsQuery})
          OR
          to_tsvector('simple', coalesce(c."sectionTitle", '') || ' ' || c.content)
            @@ to_tsquery('simple', ${orTsQuery})
        )
      ORDER BY score DESC
      LIMIT ${RAG_CONFIG.retrieval.lexicalTopK}
    `;
  }

  // Merge via Reciprocal Rank Fusion (RRF)
  const merged = new Map<number, RetrievedRagChunk>();
  const { rrfK, vectorWeight, lexicalWeight } = RAG_CONFIG.retrieval;

  vectorRows.forEach((row, index) => {
    const rank = index + 1;
    merged.set(row.id, {
      id: row.id,
      chunkKey: row.chunkKey,
      documentId: row.documentId,
      filename: row.filename,
      docTitle: row.docTitle,
      authorOrInstitution: row.authorOrInstitution,
      publicationYear: row.publicationYear,
      documentType: row.documentType,
      content: row.content,
      sectionTitle: row.sectionTitle,
      startPage: row.startPage,
      endPage: row.endPage,
      position: row.position,
      vectorRank: rank,
      lexicalRank: null,
      cosineSim: Number(row.score || 0),
      lexicalScore: 0,
      rrfScore: vectorWeight / (rrfK + rank),
    });
  });

  lexicalRows.forEach((row, index) => {
    const rank = index + 1;
    const lexContrib = lexicalWeight / (rrfK + rank);
    const existing = merged.get(row.id);

    if (existing) {
      existing.lexicalRank = rank;
      existing.lexicalScore = Number(row.score || 0);
      // Small agreement bonus when both semantic and lexical signals select the same evidence
      existing.rrfScore += lexContrib + 0.003;
    } else {
      merged.set(row.id, {
        id: row.id,
        chunkKey: row.chunkKey,
        documentId: row.documentId,
        filename: row.filename,
        docTitle: row.docTitle,
        authorOrInstitution: row.authorOrInstitution,
        publicationYear: row.publicationYear,
        documentType: row.documentType,
        content: row.content,
        sectionTitle: row.sectionTitle,
        startPage: row.startPage,
        endPage: row.endPage,
        position: row.position,
        vectorRank: null,
        lexicalRank: rank,
        cosineSim: 0,
        lexicalScore: Number(row.score || 0),
        rrfScore: lexContrib,
      });
    }
  });

  const sortedCandidates = Array.from(merged.values()).sort((a, b) => b.rrfScore - a.rrfScore);

  // Deduplicate overlapping passages and cap per-document representation for multi-doc diversity
  const selected: RetrievedRagChunk[] = [];
  const docCounts = new Map<number, number>();
  const deferredForPass2: RetrievedRagChunk[] = [];

  const isDuplicateOfSelected = (candidate: RetrievedRagChunk): boolean => {
    return selected.some((s) => jaccardSimilarity(s.content, candidate.content) >= 0.72);
  };

  for (const cand of sortedCandidates) {
    if (selected.length >= finalTopK) break;
    if (isDuplicateOfSelected(cand)) continue;

    const currentDocCount = docCounts.get(cand.documentId) || 0;
    if (currentDocCount < maxChunksPerDoc) {
      selected.push(cand);
      docCounts.set(cand.documentId, currentDocCount + 1);
    } else {
      deferredForPass2.push(cand);
    }
  }

  for (const cand of deferredForPass2) {
    if (selected.length >= finalTopK) break;
    if (isDuplicateOfSelected(cand)) continue;
    selected.push(cand);
  }

  const evidenceStatus = classifyEvidence({
    question,
    coreTerms,
    domainExtras: allTerms.filter((t) => !coreTerms.includes(t)),
    hasDomainExpansion,
    ranked: selected,
    usedVectorSearch: Boolean(queryVector),
  });

  const bestCosine = selected.length ? Math.max(...selected.map((c) => c.cosineSim)) : 0;
  const bestLexical = selected.length ? Math.max(...selected.map((c) => c.lexicalScore)) : 0;
  const distinctDocuments = new Set(selected.map((c) => c.filename)).size;

  return {
    indexAvailable: true,
    indexedDocumentsCount: stats.documentsCount,
    indexedChunksCount: stats.chunksCount,
    evidenceStatus,
    chunks:
      evidenceStatus === "insufficient" || evidenceStatus === "out_of_scope"
        ? []
        : selected,
    diagnostics: {
      usedVectorSearch: Boolean(queryVector),
      usedLexicalSearch: Boolean(orTsQuery),
      vectorCandidates: vectorRows.length,
      lexicalCandidates: lexicalRows.length,
      bestCosine,
      bestLexical,
      distinctDocuments,
    },
  };
}
