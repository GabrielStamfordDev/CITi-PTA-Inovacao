import { RAG_CONFIG } from "./config";

interface CachedEmbedding {
  vector: number[];
  expiresAt: number;
}

const queryCache = new Map<string, CachedEmbedding>();

function normalizeVector(vec: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (!norm || !Number.isFinite(norm)) return vec;
  return vec.map((v) => v / norm);
}

export function formatPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n.toFixed(6) : "0")).join(",")}]`;
}

function getCachedQueryEmbedding(key: string): number[] | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  // Move to end for simple LRU behavior
  queryCache.delete(key);
  queryCache.set(key, entry);
  return entry.vector;
}

function setCachedQueryEmbedding(key: string, vector: number[]): void {
  if (queryCache.size >= RAG_CONFIG.embedding.queryCacheMaxEntries) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey !== undefined) queryCache.delete(oldestKey);
  }
  queryCache.set(key, {
    vector,
    expiresAt: Date.now() + RAG_CONFIG.embedding.queryCacheTtlMs,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const recentTokenWindow: { ts: number; tokens: number }[] = [];

async function paceForTokenBudget(estimatedTokens: number): Promise<void> {
  const maxTpm = Number(process.env.RAG_EMBED_TPM_BUDGET || 22000);
  const windowMs = 62 * 1000;

  while (true) {
    const now = Date.now();
    while (recentTokenWindow.length && now - recentTokenWindow[0].ts > windowMs) {
      recentTokenWindow.shift();
    }
    const used = recentTokenWindow.reduce((sum, item) => sum + item.tokens, 0);
    if (used === 0 || used + estimatedTokens <= maxTpm) {
      recentTokenWindow.push({ ts: now, tokens: estimatedTokens });
      return;
    }

    const oldestTs = recentTokenWindow[0]?.ts || now;
    const waitMs = Math.max(1500, oldestTs + windowMs - now + 500);
    console.log(
      `[embed-throttle] Aguardando ${(waitMs / 1000).toFixed(1)}s para renovar janela TPM (${used}/${maxTpm} tokens)...`
    );
    await sleep(waitMs);
  }
}

function parseGeminiRetryDelayMs(errorText: string, response: any): number {
  const headerVal = Number(response?.headers?.get?.("retry-after") || "0");
  if (headerVal > 0) return Math.min(70000, headerVal * 1000 + 1000);

  const jsonDelayMatch = errorText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (jsonDelayMatch) {
    return Math.min(70000, Math.ceil(Number(jsonDelayMatch[1]) * 1000) + 1500);
  }

  const msgDelayMatch = errorText.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (msgDelayMatch) {
    return Math.min(70000, Math.ceil(Number(msgDelayMatch[1]) * 1000) + 1500);
  }

  return 0;
}

function isDailyOrLongQuotaExhausted(errorText: string, explicitDelayMs: number): boolean {
  if (explicitDelayMs > 90000) return true;
  if (/embed_content_free_tier_requests|PerDay|per day limit|retry in\s+\d+h/i.test(errorText)) {
    return true;
  }
  return false;
}

async function fetchWithRetry(
  url: string,
  payload: unknown,
  maxAttempts = 5
): Promise<{ ok: boolean; status: number; data: any; errorText: string; quotaExhausted?: boolean }> {
  const fetchFn = (globalThis as any).fetch;
  if (typeof fetchFn !== "function") {
    return { ok: false, status: 0, data: null, errorText: "fetch indisponível no runtime" };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(RAG_CONFIG.embedding.timeoutMs),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, status: response.status, data, errorText: "" };
      }

      const errorText = await response.text().catch(() => "");
      const explicitDelayMs = parseGeminiRetryDelayMs(errorText, response);

      if (response.status === 429 && isDailyOrLongQuotaExhausted(errorText, explicitDelayMs)) {
        return { ok: false, status: 429, data: null, errorText, quotaExhausted: true };
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return { ok: false, status: response.status, data: null, errorText };
      }

      const backoffMs =
        explicitDelayMs > 0
          ? explicitDelayMs
          : Math.min(65000, (response.status === 429 ? 15000 : 1500) * Math.pow(2, attempt - 1));
      console.warn(
        `[embed-retry ${attempt}/${maxAttempts}] HTTP ${response.status}; aguardando ${(backoffMs / 1000).toFixed(1)}s...`
      );
      await sleep(backoffMs);
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return {
          ok: false,
          status: 0,
          data: null,
          errorText: err?.message || String(err),
        };
      }
      await sleep(Math.min(10000, 1200 * Math.pow(2, attempt - 1)));
    }
  }

  return { ok: false, status: 0, data: null, errorText: "Falha após tentativas" };
}

/**
 * Generates an embedding for a caregiver query using Gemini's `gemini-embedding-001`
 * with `RETRIEVAL_QUERY`. Fails fast (`maxAttempts = 1`) so live chat falls back to
 * PostgreSQL FTS seamlessly without blocking user requests.
 */
export async function embedQueryText(rawQuery: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const query = rawQuery.trim();
  if (!apiKey || !query) return null;

  const cacheKey = `${RAG_CONFIG.embedding.model}:${RAG_CONFIG.embedding.dimension}:${query.toLowerCase()}`;
  const cached = getCachedQueryEmbedding(cacheKey);
  if (cached) return cached;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${RAG_CONFIG.embedding.model}:embedContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const result = await fetchWithRetry(
    url,
    {
      model: `models/${RAG_CONFIG.embedding.model}`,
      content: { parts: [{ text: query.slice(0, 4000) }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: RAG_CONFIG.embedding.dimension,
    },
    1
  );

  if (!result.ok) {
    console.warn(
      `Falha ao gerar embedding da consulta (${result.status}): ${result.errorText.slice(0, 180)}`
    );
    return null;
  }

  const values: unknown = result.data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== RAG_CONFIG.embedding.dimension) {
    console.warn(
      `Dimensão inesperada de embedding: esperado ${RAG_CONFIG.embedding.dimension}, recebido ${
        Array.isArray(values) ? values.length : typeof values
      }`
    );
    return null;
  }

  const normalized = normalizeVector(values as number[]);
  setCachedQueryEmbedding(cacheKey, normalized);
  return normalized;
}

/**
 * Generates document embeddings in controlled batches, tolerating partial completion
 * if the Gemini Free Tier daily quota is exhausted mid-document so chunks can still
 * be stored and queried lexically via FTS without losing already computed vectors.
 */
export async function embedDocumentChunks(
  items: { text: string; title?: string | null }[],
  onBatchProgress?: (done: number, total: number) => void
): Promise<{ vectors: (number[] | null)[]; quotaExhausted: boolean; lastError?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente para gerar embeddings.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${RAG_CONFIG.embedding.model}:batchEmbedContents?key=${encodeURIComponent(
    apiKey
  )}`;

  const batchSize = Math.max(1, RAG_CONFIG.embedding.batchSize);
  const allVectors: (number[] | null)[] = new Array(items.length).fill(null);

  for (let offset = 0; offset < items.length; offset += batchSize) {
    const slice = items.slice(offset, offset + batchSize);
    const estTokens = slice.reduce(
      (sum, item) => sum + Math.ceil((item.text.length + (item.title?.length || 0)) / 3),
      0
    );
    await paceForTokenBudget(estTokens);

    const requests = slice.map((item) => {
      const req: Record<string, any> = {
        model: `models/${RAG_CONFIG.embedding.model}`,
        content: { parts: [{ text: item.text.slice(0, 7500) }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: RAG_CONFIG.embedding.dimension,
      };
      if (item.title && item.title.trim()) {
        req.title = item.title.trim().slice(0, 200);
      }
      return req;
    });

    const result = await fetchWithRetry(url, { requests }, 5);
    if (!result.ok) {
      if (result.quotaExhausted || result.status === 429) {
        console.warn(
          `[embed-quota] Cota de embeddings atingida após ${offset}/${items.length} chunks; preservando vetores já gerados.`
        );
        return {
          vectors: allVectors,
          quotaExhausted: true,
          lastError: result.errorText.slice(0, 300),
        };
      }
      throw new Error(
        `Erro ao gerar embeddings em lote (${result.status}): ${result.errorText.slice(0, 800)}`
      );
    }

    const embeddings = result.data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== slice.length) {
      throw new Error(
        `Resposta inválida de batchEmbedContents: esperados ${slice.length} vetores, recebidos ${
          Array.isArray(embeddings) ? embeddings.length : 0
        }`
      );
    }

    for (let j = 0; j < embeddings.length; j++) {
      const vals = embeddings[j]?.values;
      if (!Array.isArray(vals) || vals.length !== RAG_CONFIG.embedding.dimension) {
        throw new Error(
          `Dimensão incompatível no embedding retornado: ${Array.isArray(vals) ? vals.length : typeof vals}`
        );
      }
      allVectors[offset + j] = normalizeVector(vals as number[]);
    }

    onBatchProgress?.(Math.min(offset + slice.length, items.length), items.length);

    if (offset + batchSize < items.length) {
      await sleep(RAG_CONFIG.embedding.batchDelayMs);
    }
  }

  return { vectors: allVectors, quotaExhausted: false };
}
