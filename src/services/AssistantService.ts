import fs from "fs";
import path from "path";
import zlib from "zlib";
import * as AppRepository from "../repositories/AppRepository";
import {
  SCIENTIFIC_CHUNKS,
  SCIENTIFIC_SOURCES,
  ScientificChunk,
  ScientificSourceMeta,
} from "../data/acervoCientifico";

export interface CaregiverContext {
  id?: number;
  nome?: string | null;
  pessoaComAlzheimer?: string | null;
  parentesco?: string | null;
  estagioDaDoenca?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface SourceReference {
  filename: string;
  title: string;
  institution: string;
  year: string;
  focus: string;
  url: string;
}

export interface AssistantResponse {
  answer: string;
  sources: SourceReference[];
  suggestions: string[];
  engine: "gemini" | "rag-local";
}

interface DynamicDocExcerpt {
  filename: string;
  text: string;
}

const ACERVO_DIR = path.resolve(__dirname, "..", "..", "acervo-pdf");
const PROMPT_PTCF_PATH = path.resolve(__dirname, "..", "prompts", "assistente-cuida.ptcf.md");
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
];

let dynamicCache: DynamicDocExcerpt[] | null = null;

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeQuery(question: string): string[] {
  const stopWords = new Set([
    "como",
    "para",
    "com",
    "que",
    "por",
    "uma",
    "uns",
    "umas",
    "dos",
    "das",
    "nos",
    "nas",
    "meu",
    "minha",
    "ele",
    "ela",
    "eles",
    "elas",
    "esta",
    "estao",
    "nao",
    "sim",
    "fazer",
    "posso",
    "devo",
    "faco",
    "sobre",
    "muito",
    "muita",
    "quando",
    "onde",
    "qual",
    "quais",
    "quem",
    "isso",
    "isto",
    "aqui",
    "tenho",
    "pessoa",
    "idoso",
    "idosa",
    "alzheimer",
    "cuidador",
    "cuidadora",
  ]);

  return normalizeText(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

function extractReadableTextFromPdfBuffer(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  let scanned = 0;

  while ((match = streamRegex.exec(raw)) !== null && scanned < 45) {
    scanned++;
    try {
      const compressed = Buffer.from(match[1], "latin1");
      const decompressed = zlib.inflateSync(compressed).toString("latin1");
      if (!/\bBT\b/.test(decompressed)) continue;

      const textMatches = decompressed.match(/\(([^()]{2,200})\)/g) || [];
      for (const token of textMatches) {
        const clean = token.slice(1, -1).replace(/\\[()\\]/g, "");
        if (clean.length > 3 && /[a-zA-Z]{2,}/.test(clean)) {
          parts.push(clean);
        }
      }
    } catch {
      // Alguns streams são imagens/fontes ou usam outro filtro; ignorar com segurança
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").slice(0, 24000);
}

function loadExtraAcervoExcerpts(): DynamicDocExcerpt[] {
  if (dynamicCache) return dynamicCache;
  if (!fs.existsSync(ACERVO_DIR)) {
    dynamicCache = [];
    return dynamicCache;
  }

  const curatedNames = new Set(SCIENTIFIC_SOURCES.map((s) => s.filename));
  const files = fs.readdirSync(ACERVO_DIR);
  const loaded: DynamicDocExcerpt[] = [];

  for (const filename of files) {
    const ext = path.extname(filename).toLowerCase();
    if (![".pdf", ".txt", ".md"].includes(ext) || curatedNames.has(filename)) {
      continue;
    }

    const fullPath = path.join(ACERVO_DIR, filename);
    try {
      const text =
        ext === ".pdf"
          ? extractReadableTextFromPdfBuffer(fs.readFileSync(fullPath))
          : fs.readFileSync(fullPath, "utf-8").slice(0, 24000);

      if (text.trim()) {
        loaded.push({ filename, text });
      }
    } catch (err) {
      console.error(`Erro ao ler documento extra ${filename}:`, err);
    }
  }

  dynamicCache = loaded;
  return dynamicCache;
}

/**
 * Lista os arquivos reais disponíveis na pasta acervo-pdf/, enriquecidos com metadados oficiais.
 */
export function listAvailableSources(): {
  sources: SourceReference[];
  geminiEnabled: boolean;
} {
  const existingFiles = fs.existsSync(ACERVO_DIR)
    ? fs
        .readdirSync(ACERVO_DIR)
        .filter((f) => [".pdf", ".md", ".txt"].includes(path.extname(f).toLowerCase()))
    : [];

  const existingSet = new Set(existingFiles);
  const byFile = new Map<string, ScientificSourceMeta>(
    SCIENTIFIC_SOURCES.map((s) => [s.filename, s])
  );

  const ordered: SourceReference[] = [];

  for (const meta of SCIENTIFIC_SOURCES) {
    if (existingSet.has(meta.filename)) {
      ordered.push({
        ...meta,
        url: `/acervo-pdf/${encodeURIComponent(meta.filename)}`,
      });
    }
  }

  for (const fn of existingFiles) {
    if (!byFile.has(fn)) {
      ordered.push({
        filename: fn,
        title: fn.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        institution: "Documento adicionado ao acervo local",
        year: String(new Date().getFullYear()),
        focus: "Material complementar de apoio",
        url: `/acervo-pdf/${encodeURIComponent(fn)}`,
      });
    }
  }

  return {
    sources: ordered,
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
}

function scoreChunk(chunk: ScientificChunk, normQuestion: string, tokens: string[]): number {
  let score = 0;

  for (const kw of chunk.keywords) {
    const normKw = normalizeText(kw);
    if (normQuestion.includes(normKw)) {
      score += normKw.includes(" ") ? 12 : 7;
    } else {
      for (const tok of tokens) {
        if (normKw.includes(tok)) score += 3;
      }
    }
  }

  const bodySearch = normalizeText(
    `${chunk.topic} ${chunk.whyItHappens} ${chunk.whatToDo.join(" ")}`
  );
  for (const tok of tokens) {
    if (bodySearch.includes(tok)) score += 1.5;
  }

  return score;
}

function retrieveRelevantChunks(question: string, topK = 3): ScientificChunk[] {
  const normQuestion = normalizeText(question);
  const tokens = tokenizeQuery(question);

  const ranked = SCIENTIFIC_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, normQuestion, tokens),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    // Pergunta ampla ou saudação: retornar pilares centrais (comunicação, segurança e autocuidado)
    return [
      SCIENTIFIC_CHUNKS[4],
      SCIENTIFIC_CHUNKS[0],
      SCIENTIFIC_CHUNKS[8],
    ].filter(Boolean);
  }

  return ranked.slice(0, topK).map((r) => r.chunk);
}

function findRelevantDynamicExcerpts(question: string): { filename: string; snippet: string }[] {
  const extras = loadExtraAcervoExcerpts();
  if (!extras.length) return [];

  const tokens = tokenizeQuery(question);
  if (!tokens.length) return [];

  const results: { filename: string; snippet: string; score: number }[] = [];
  for (const doc of extras) {
    const normDoc = normalizeText(doc.text);
    let score = 0;
    let firstMatchIdx = -1;

    for (const tok of tokens) {
      const idx = normDoc.indexOf(tok);
      if (idx !== -1) {
        score += 2;
        if (firstMatchIdx === -1) firstMatchIdx = idx;
      }
    }

    if (score > 0 && firstMatchIdx !== -1) {
      const start = Math.max(0, firstMatchIdx - 120);
      const snippet = doc.text.slice(start, start + 650).trim();
      results.push({ filename: doc.filename, snippet, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 2);
}

function buildSourceReferences(
  chunks: ScientificChunk[],
  extraFiles: string[],
  availableSources: SourceReference[]
): SourceReference[] {
  const availableMap = new Map(availableSources.map((s) => [s.filename, s]));
  const seen = new Set<string>();
  const refs: SourceReference[] = [];

  const addFile = (filename: string) => {
    if (seen.has(filename)) return;
    const found = availableMap.get(filename);
    if (found) {
      seen.add(filename);
      refs.push(found);
    }
  };

  for (const chunk of chunks) {
    addFile(chunk.sourceFile);
  }
  for (const chunk of chunks) {
    for (const extra of chunk.extraSources || []) {
      if (refs.length >= 4) break;
      addFile(extra);
    }
  }
  for (const fn of extraFiles) {
    addFile(fn);
  }

  return refs.slice(0, 4);
}

function formatCaregiverProfileSummary(user?: CaregiverContext | null): string {
  if (!user || !user.nome) {
    return "Cuidador(a) não autenticado(a) no momento.";
  }

  const firstName = user.nome.trim().split(/\s+/)[0];
  const parts = [`Nome do(a) cuidador(a): ${firstName}`];
  if (user.pessoaComAlzheimer) parts.push(`Pessoa cuidada: ${user.pessoaComAlzheimer}`);
  if (user.parentesco) parts.push(`Vínculo: ${user.parentesco}`);
  if (user.estagioDaDoenca) parts.push(`Estágio informado: ${user.estagioDaDoenca}`);
  if (user.cidade || user.estado) {
    parts.push(`Localização: ${[user.cidade, user.estado].filter(Boolean).join(" - ")}`);
  }
  return parts.join(" | ");
}

async function getLocalAppSupportContext(question: string): Promise<string> {
  const q = normalizeText(question);
  const needsCommunityInfo =
    /(grupo|apoio|abraz|evento|simposio|webinario|palestra|encontro|desabafar|sozinho|sozinha|recife|cidade|links)/.test(
      q
    );

  if (!needsCommunityInfo) return "";

  try {
    const [links, eventos] = await Promise.all([
      AppRepository.findAllLinks(),
      AppRepository.findAllEventos(),
    ]);

    const linksText = links.map((l: any) => `- ${l.titulo}: ${l.url}`).join("\n");
    const eventosText = eventos
      .map((e: any) => `- ${e.titulo} (${e.data}, ${e.horario}, local: ${e.local})`)
      .join("\n");

    return `\nRECURSOS LOCAIS CADASTRADOS NO APP CUIDA:\nLinks de Apoio:\n${linksText}\nEventos e Encontros:\n${eventosText}\n`;
  } catch {
    return "";
  }
}

function loadPtcfPromptTemplate(): string {
  try {
    if (fs.existsSync(PROMPT_PTCF_PATH)) {
      return fs.readFileSync(PROMPT_PTCF_PATH, "utf-8");
    }
  } catch (err) {
    console.warn("Não foi possível ler o template PTCF em disco, usando padrão interno:", err);
  }

  return `# P — Persona
Você é o Assistente CuiDA, especialista acolhedor em cuidados informais na Doença de Alzheimer.

# T — Tarefa e Guardrails
Oriente exclusivamente com base no acervo científico e nos recursos locais do CuiDA, sem prescrever ou alterar dosagens de medicamentos.

# C — Contexto
{{PERFIL_CUIDADORA}}
{{ACERVO_CIENTIFICO}}
{{RECURSOS_LOCAIS}}

# F — Formato
Responda com acolhimento breve, **Por que isso acontece**, **O que fazer na prática** (tópicos "- "), **O que evitar** e **Quando procurar o médico**.`;
}

function buildSystemInstructionFromPtcf(params: {
  profileSummary: string;
  knowledgeText: string;
  extraText: string;
  localContext: string;
}): string {
  const template = loadPtcfPromptTemplate();
  const acervoCompleto = [params.knowledgeText.trim(), params.extraText.trim()]
    .filter(Boolean)
    .join("\n\n");
  const recursosLocais = params.localContext.trim()
    ? params.localContext.trim()
    : "Sem eventos ou links adicionais necessários para esta dúvida (lembre que as abas 'Links de Apoio' e 'Eventos e Encontros' estão disponíveis no app).";

  return template
    .replace("{{PERFIL_CUIDADORA}}", params.profileSummary)
    .replace("{{ACERVO_CIENTIFICO}}", acervoCompleto)
    .replace("{{RECURSOS_LOCAIS}}", recursosLocais);
}

async function callGeminiWithAcervo(params: {
  question: string;
  profileSummary: string;
  chunks: ScientificChunk[];
  dynamicExcerpts: { filename: string; snippet: string }[];
  localContext: string;
  history: ChatTurn[];
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const knowledgeText = params.chunks
    .map(
      (c, idx) => `
[FONTE ${idx + 1}: ${c.sourceFile} | Tema: ${c.topic}]
Por que ocorre: ${c.whyItHappens}
Condutas práticas recomendadas:
${c.whatToDo.map((step) => `- ${step}`).join("\n")}
O que evitar:
${c.whatToAvoid.map((avoid) => `- ${avoid}`).join("\n")}
Alerta médico: ${c.whenToSeekDoctor}
`
    )
    .join("\n");

  const extraText = params.dynamicExcerpts
    .map((d) => `\n[DOCUMENTO COMPLEMENTAR: ${d.filename}]\n${d.snippet}\n`)
    .join("\n");

  const systemInstruction = buildSystemInstructionFromPtcf({
    profileSummary: params.profileSummary,
    knowledgeText,
    extraText,
    localContext: params.localContext,
  });

  const contents = [
    ...params.history.slice(-6).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: [{ text: params.question }],
    },
  ];

  const fetchFn = (globalThis as any).fetch;
  if (typeof fetchFn !== "function") return null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn(`Gemini (${model}) retornou ${response.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.filter((p: any) => !p?.thought)
        .map((p: any) => p?.text || "")
        .join("")
        .trim();

      if (text) return text;
    } catch (err) {
      console.warn(`Falha ao consultar modelo Gemini ${model}:`, err);
    }
  }

  return null;
}

function buildGroundedFallbackAnswer(params: {
  question: string;
  user?: CaregiverContext | null;
  chunks: ScientificChunk[];
  dynamicExcerpts: { filename: string; snippet: string }[];
  localContext: string;
}): string {
  const primary = params.chunks[0];
  const secondary = params.chunks.length > 1 ? params.chunks[1] : null;
  const firstName = params.user?.nome?.trim().split(/\s+/)[0];
  const lovedOne = params.user?.pessoaComAlzheimer?.trim();

  const introPrefix = firstName ? `${firstName}, ` : "";
  const lovedOneText = lovedOne
    ? `ao cuidar de **${lovedOne}**`
    : "no cuidado cotidiano";

  const lines: string[] = [];
  lines.push(
    `${introPrefix}respire fundo — essa é uma dúvida muito comum ${lovedOneText} e existem estratégias práticas validadas para conduzir esse momento com calma.`
  );
  lines.push("");
  lines.push(`**Por que isso acontece (${primary.topic})**`);
  lines.push(primary.whyItHappens);
  lines.push("");
  lines.push("**O que fazer na prática**");
  for (const step of primary.whatToDo) {
    lines.push(`- ${step}`);
  }

  if (secondary && secondary.id !== primary.id) {
    lines.push("");
    lines.push(`**Orientações complementares (${secondary.topic})**`);
    for (const step of secondary.whatToDo.slice(0, 2)) {
      lines.push(`- ${step}`);
    }
  }

  if (primary.whatToAvoid.length) {
    lines.push("");
    lines.push("**O que evitar**");
    for (const avoid of primary.whatToAvoid) {
      lines.push(`- ${avoid}`);
    }
  }

  lines.push("");
  lines.push("**Quando buscar avaliação médica**");
  lines.push(primary.whenToSeekDoctor);

  if (params.localContext.trim()) {
    lines.push("");
    lines.push("**No próprio CuiDA você também encontra**");
    lines.push(
      "- Na tela inicial, acesse **Links de Apoio** (ABRAz Pernambuco, WhatsApp Cuidadores de Recife e grupos moderados) e **Eventos e Encontros** para participar de atividades gratuitas."
    );
  }

  if (params.dynamicExcerpts.length) {
    lines.push("");
    lines.push(`**Trecho complementar encontrado em ${params.dynamicExcerpts[0].filename}**`);
    lines.push(params.dynamicExcerpts[0].snippet);
  }

  return lines.join("\n");
}

export async function answerCaregiverQuestion(params: {
  question: string;
  user?: CaregiverContext | null;
  history?: ChatTurn[];
}): Promise<AssistantResponse> {
  const question = String(params.question || "").trim();
  const history = Array.isArray(params.history) ? params.history : [];

  const { sources: availableSources } = listAvailableSources();
  const chunks = retrieveRelevantChunks(question, 3);
  const dynamicExcerpts = findRelevantDynamicExcerpts(question);
  const localContext = await getLocalAppSupportContext(question);
  const profileSummary = formatCaregiverProfileSummary(params.user);

  const geminiReply = await callGeminiWithAcervo({
    question,
    profileSummary,
    chunks,
    dynamicExcerpts,
    localContext,
    history,
  });

  const engine: "gemini" | "rag-local" = geminiReply ? "gemini" : "rag-local";
  const answer =
    geminiReply ||
    buildGroundedFallbackAnswer({
      question,
      user: params.user,
      chunks,
      dynamicExcerpts,
      localContext,
    });

  const extraDocNames = dynamicExcerpts.map((d) => d.filename);
  const sources = buildSourceReferences(chunks, extraDocNames, availableSources);

  const suggestions = chunks[0]?.followUpSuggestions?.length
    ? chunks[0].followUpSuggestions
    : [
        "Como agir se ele(a) insistir em sair de casa no fim da tarde?",
        "Como facilitar o banho sem gerar conflito?",
      ];

  return {
    answer,
    sources,
    suggestions,
    engine,
  };
}
