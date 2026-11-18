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
  "sentindo", "sente", "sentir", "sentiu", "ficando", "ficou", "fique", "passando",
  "teve", "apareceu", "surgiu", "comecou", "toma", "tomando", "forte", "direito",
  "esquerdo", "passar", "andar",
]);

const DOMAIN_LEXICAL_EXPANSIONS: { pattern: RegExp; extras: string[] }[] = [
  {
    pattern: /\b(chuveiro|banheira|lavar|tomar banho|banho|higiene)\b/,
    extras: ["banho", "higiene", "agua", "privacidade", "toalha", "bathing", "washing", "shower"],
  },
  {
    pattern: /\b(dormir|madrugada|acord\w*|noite|insonia|sono)\b/,
    extras: ["sono", "noturno", "noite", "insonia", "rotina", "entardecer", "sleep", "night", "sleeping"],
  },
  {
    pattern: /\b(tarde|entardec\w*|escurec\w*|fim da tarde|por do sol|inquieta\w*)\b/,
    extras: ["entardecer", "sundowning", "agitacao", "iluminacao", "tarde", "evening", "restless"],
  },
  {
    pattern: /\b(sair de casa|ir embora|voltar para casa|fugir|fuga|mala|tranca|porta)\b/,
    extras: ["sair", "casa", "validacao", "redirecionar", "seguranca", "perambulacao", "wandering", "home"],
  },
  {
    pattern: /\b(andar sem parar|anda sem parar|andando sem rumo|andando pela casa|perambulac\w*|wander\w*|se perder|desaparec\w*)\b/,
    extras: ["perambulacao", "wandering", "identificacao", "seguranca", "walking"],
  },
  {
    pattern: /\b(remedio\w*|medicament\w*|medicac\w*|comprimid\w*|sus|receita medica|tratamento)\b/,
    extras: ["medicamento", "tratamento", "sus", "pcdt", "donepezila", "rivastigmina", "galantamina", "memantina", "medication"],
  },
  {
    pattern: /\b(comer|alimentac\w*|comida|engasg\w*|engolir|deglut\w*|apetite|emagrec\w*|refeic\w*)\b/,
    extras: ["alimentacao", "refeicao", "engasgo", "degluticao", "hidratacao", "eating", "feeding", "swallowing"],
  },
  {
    pattern: /\b(repet\w*|mesma pergunta|perguntando|conversa|dialogo|teimos\w*|paciencia)\b/,
    extras: ["repeticao", "comunicacao", "validacao", "dialogo", "calma", "repeating", "communication"],
  },
  {
    pattern: /\b(agressiv\w*|agita\w*|bater|bate\b|xing\w*|alucinac\w*|delirio\w*|enxerg\w*|vozes|desconfia\w*|acusar|raiva|irritad\w*)\b/,
    extras: ["agitacao", "agressividade", "alucinacoes", "delirio", "validacao", "aggression", "hallucinations", "delusions"],
  },
  {
    pattern: /\b(cansad\w*|exaust\w*|chorand\w*|culpa|sozinho|sozinha|depress\w*|sobrecarg\w*|desgaste|estress\w*|grupo\w*|apoio|direitos|beneficio\w*|isencao|inss|curatela)\b/,
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

interface ChunkMatchMetrics {
  bestChunkCoreMatches: number;
  bestChunkCoreRatio: number;
  bestChunkExtraMatches: number;
  unionCoreRatio: number;
}

function measurePerChunkMatch(
  coreTerms: string[],
  matchedExtras: string[],
  chunks: RetrievedRagChunk[]
): ChunkMatchMetrics {
  if (!chunks.length) {
    return {
      bestChunkCoreMatches: 0,
      bestChunkCoreRatio: 0,
      bestChunkExtraMatches: 0,
      unionCoreRatio: 0,
    };
  }

  let bestChunkCoreMatches = 0;
  let bestChunkExtraMatches = 0;
  const unionMatchedCore = new Set<string>();

  for (const chunk of chunks) {
    const chunkText = normalizeForMatching(
      `${chunk.docTitle || ""} ${chunk.sectionTitle || ""} ${chunk.content}`
    );

    let localCore = 0;
    for (const term of coreTerms) {
      const stem = term.length >= 6 ? term.slice(0, term.length - 2) : term;
      if (chunkText.includes(term) || (stem.length >= 4 && chunkText.includes(stem))) {
        localCore++;
        unionMatchedCore.add(term);
      }
    }
    if (localCore > bestChunkCoreMatches) bestChunkCoreMatches = localCore;

    if (matchedExtras.length) {
      const localExtras = matchedExtras.filter((e) => chunkText.includes(e)).length;
      if (localExtras > bestChunkExtraMatches) bestChunkExtraMatches = localExtras;
    }
  }

  return {
    bestChunkCoreMatches,
    bestChunkCoreRatio: coreTerms.length ? bestChunkCoreMatches / coreTerms.length : 0,
    bestChunkExtraMatches,
    unionCoreRatio: coreTerms.length ? unionMatchedCore.size / coreTerms.length : 0,
  };
}

const OBVIOUS_NON_CARE_REGEX =
  /\b(bolo|chocolate|brigadeiro|receita culinaria|futebol|campeonato|bitcoin|criptomoeda|javascript|python|sql|programacao|novela|horoscopo)\b/;

const ACUTE_OR_NON_ALZHEIMER_SYMPTOM_REGEX =
  /\b(dor(?:es)?\s+(?:\w+\s+){0,2}(?:no\s+)?(?:peito|joelho|costas|dente|estomago|garganta|ombro|coluna|rim|figado|ouvido)|aperto no peito|infarto|angina|falta de ar|desmaio|desmaiou|convuls\w*|avc|derrame|hemorragia|sangramento intenso|fratura|quebrou|pomada|xarope|antibiotic\w*|anti-?inflamatori\w*|insulina|nph|apendicite)\b/;

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

  // Guard symptoms/emergencies outside the Alzheimer care acervo before retrieving unrelated PDFs
  if (ACUTE_OR_NON_ALZHEIMER_SYMPTOM_REGEX.test(normQuestion) && !hasDomainExpansion) {
    return "insufficient";
  }

  if (!ranked.length) {
    if (OBVIOUS_NON_CARE_REGEX.test(normQuestion)) return "out_of_scope";
    return wordCount <= 3 && !hasDomainExpansion ? "ambiguous" : "insufficient";
  }

  const bestCosine = Math.max(...ranked.map((r) => r.cosineSim), 0);
  const bestLexical = Math.max(...ranked.map((r) => r.lexicalScore), 0);
  const matchMetrics = measurePerChunkMatch(coreTerms, domainExtras, ranked);

  // Detect clearly underspecified one/two-word messages ("ajuda", "remédio", "como?")
  if (coreTerms.length <= 1 && wordCount <= 3 && !hasDomainExpansion) {
    return "ambiguous";
  }

  // Explicitly guard unrelated topics and unseen drug/dosage specificity (e.g. insulin dosage)
  if (OBVIOUS_NON_CARE_REGEX.test(normQuestion) && (!usedVectorSearch || bestCosine < 0.65)) {
    return "out_of_scope";
  }
  if (
    /\b(dosagem|unidade|unidades|insulina|nph|ibuprofeno|warfarina|amoxicilina|posologia)\b/.test(
      normQuestion
    ) &&
    matchMetrics.bestChunkCoreRatio < 0.6
  ) {
    return "insufficient";
  }

  // When a non-domain query only hits weak/single keywords across separate chunks, refuse safely
  const hasSingleChunkMultiTermCooccurrence =
    matchMetrics.bestChunkCoreRatio >= 0.65 &&
    matchMetrics.bestChunkCoreMatches >= Math.min(2, coreTerms.length);
  const hasStrongDomainMatch =
    hasDomainExpansion && matchMetrics.bestChunkExtraMatches >= 2;

  if (usedVectorSearch) {
    const passesPartialVector = bestCosine >= RAG_CONFIG.retrieval.minCosineForPartial;
    const passesStrongVector = bestCosine >= RAG_CONFIG.retrieval.minCosineForStrong;
    const passesVerifiedLexical =
      bestLexical >= RAG_CONFIG.retrieval.minLexicalForStrong &&
      (hasSingleChunkMultiTermCooccurrence || hasStrongDomainMatch);

    if (!passesPartialVector && !passesVerifiedLexical) {
      return bestCosine < 0.56 && !hasDomainExpansion ? "out_of_scope" : "insufficient";
    }

    if (passesStrongVector || (passesPartialVector && (hasSingleChunkMultiTermCooccurrence || hasStrongDomainMatch))) {
      return "sufficient";
    }

    return hasSingleChunkMultiTermCooccurrence || hasDomainExpansion ? "partial" : "insufficient";
  }

  // Lexical-only mode (when GEMINI_API_KEY is absent or embed quota paused)
  if (!hasDomainExpansion && !hasSingleChunkMultiTermCooccurrence) {
    return "insufficient";
  }
  if (
    bestLexical >= RAG_CONFIG.retrieval.minLexicalForStrong &&
    (hasStrongDomainMatch || hasSingleChunkMultiTermCooccurrence)
  ) {
    return "sufficient";
  }
  if (
    bestLexical >= RAG_CONFIG.retrieval.minLexicalForPartial &&
    (hasStrongDomainMatch || hasSingleChunkMultiTermCooccurrence || matchMetrics.bestChunkExtraMatches >= 1)
  ) {
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
