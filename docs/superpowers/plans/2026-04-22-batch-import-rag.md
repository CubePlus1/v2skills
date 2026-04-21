# Batch-Import + Cross-Video RAG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a batch-video → single Claude Code Skill pipeline with self-built intent-driven RAG (BM25 + LLM keyword expansion), and integrate the same retrieval into the existing single-video flow (落地 Phase C).

**Architecture:** Two new API routes (`/api/videos/batch-extract`, `/api/skills/batch-generate`) and one new page (`/batch`). A new `src/lib/retrieval/` module (chunker / tokenizer / bm25 / intent expansion / orchestrator) powers both batch and single-video paths. A new `src/lib/batch/runner.ts` orchestrates serial yt-dlp invocations. Testing via **vitest** (new dev dep).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict, Zod v4, Vercel AI SDK `generateObject`, yt-dlp via `youtube-dl-exec`, Tailwind v4, **vitest** (new).

**Design Reference:** `docs/superpowers/specs/2026-04-22-batch-import-rag-design.md`

**Branch:** `feature/batch-import-rag`

---

## File Structure

### Create

```
src/vitest.config.ts                                          # Vitest config (node env, path alias)
src/lib/retrieval/types.ts                                     # Chunk, ScoredChunk, IntentContext, RetrievalResult
src/lib/retrieval/tokenizer.ts                                 # tokenize(text) — CN n-gram + EN space + stopwords
src/lib/retrieval/tokenizer.test.ts
src/lib/retrieval/chunker.ts                                   # chunkTranscript(transcript, sourceVideoId, cfg?)
src/lib/retrieval/chunker.test.ts
src/lib/retrieval/bm25.ts                                      # scoreAndSelect(chunks, queryTokens, topK)
src/lib/retrieval/bm25.test.ts
src/lib/retrieval/intent.ts                                    # expandIntent(intent, ctx) via LLM + cache
src/lib/retrieval/intent.test.ts
src/lib/retrieval/index.ts                                     # retrieveForSkill(inputs) entry point
src/lib/retrieval/index.test.ts
src/lib/batch/types.ts                                         # BatchItem, BatchResult
src/lib/batch/runner.ts                                        # runBatchExtract(urls, onProgress?)
src/lib/batch/runner.test.ts
src/app/api/videos/batch-extract/route.ts                      # POST: [url] → [{status, video?, error?}]
src/app/api/videos/batch-extract/route.test.ts
src/app/api/skills/batch-generate/route.ts                     # POST: videos+intent → skillMarkdown
src/app/api/skills/batch-generate/route.test.ts
src/components/batch/BatchUrlList.tsx                          # Row-based URL input list
src/components/batch/BatchExtractionProgress.tsx               # Per-URL status chips
src/components/batch/IntentField.tsx                           # Textarea + counter
src/components/batch/BatchVideoPreview.tsx                     # Extracted-video preview cards
src/app/batch/page.tsx                                         # /batch page
```

### Modify

```
src/package.json                                               # Add vitest + testing deps, add test script
src/lib/validators/videoInput.ts                               # Add intent + batchExtract + batchGenerate schemas
src/lib/skillTemplate.ts                                       # Accept optional retrievalContext
src/lib/ai-client.ts                                           # buildSkillGenerationPrompt — dual mode
src/app/api/skills/generate/route.ts                           # Use retrieval when transcript > 3000 chars
src/app/page.tsx                                               # Add /batch CTA
README.md                                                      # Document batch workflow
```

---

## Task 1: Vitest Setup

**Files:**
- Create: `src/vitest.config.ts`
- Modify: `src/package.json`

- [ ] **Step 1: Install vitest + support packages**

Run: `cd src && npm install -D vitest @vitest/coverage-v8 vite-tsconfig-paths`
Expected: `added N packages`, no peer-dep errors.

- [ ] **Step 2: Create vitest config**

Create `src/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
    },
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

Edit `src/package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
```

- [ ] **Step 4: Verify vitest starts (no tests yet)**

Run: `cd src && npm test`
Expected: `No test files found` — exit code 0 (or 1 depending on vitest version, as long as no crash).

- [ ] **Step 5: Commit**

```bash
git add src/package.json src/package-lock.json src/vitest.config.ts
git commit -m "chore: add vitest + coverage tooling"
```

---

## Task 2: Retrieval Types

**Files:**
- Create: `src/lib/retrieval/types.ts`

- [ ] **Step 1: Write the types file**

Create `src/lib/retrieval/types.ts`:

```ts
export interface VideoSource {
  id: string;              // stable id within a batch (e.g. "v1", "v2")
  title: string;
  tags: string[];
  transcript: string;
}

export interface Chunk {
  id: string;              // "{sourceId}:c{idx}" e.g. "v1:c3"
  sourceId: string;
  index: number;           // within source
  text: string;
  startRatio: number;      // 0..1 position in source transcript
  endRatio: number;
}

export interface ScoredChunk extends Chunk {
  score: number;
  matchedTokens: string[];
}

export interface IntentContext {
  intent: string;
  titles: string[];
  tags: string[];
}

export interface RetrievalConfig {
  chunkMinChars: number;   // default 500
  chunkMaxChars: number;   // default 1000
  topK: number;            // default 8
  jaccardThreshold: number; // default 0.7
}

export interface RetrievalResult {
  strategy: "full" | "retrieved";
  chunks: ScoredChunk[];
  keywords: string[];
  notes: string[];         // debug breadcrumbs: "intent expansion failed → fallback"
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  chunkMinChars: 500,
  chunkMaxChars: 1000,
  topK: 8,
  jaccardThreshold: 0.7,
};
```

- [ ] **Step 2: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/retrieval/types.ts
git commit -m "feat(retrieval): add core types"
```

---

## Task 3: Tokenizer

**Files:**
- Create: `src/lib/retrieval/tokenizer.ts`
- Create: `src/lib/retrieval/tokenizer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/retrieval/tokenizer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("splits english on whitespace and punctuation, lowercased", () => {
    expect(tokenize("Hello, World! AI models.")).toEqual(["hello", "world", "ai", "models"]);
  });

  it("filters english stopwords", () => {
    expect(tokenize("the quick brown fox")).toEqual(["quick", "brown", "fox"]);
  });

  it("produces 2-4 char n-grams for chinese", () => {
    const toks = tokenize("注意力机制");
    expect(toks).toContain("注意");
    expect(toks).toContain("注意力");
    expect(toks).toContain("注意力机");
    expect(toks).toContain("注意力机制");
    expect(toks).toContain("意力机制");
  });

  it("filters chinese stopwords", () => {
    const toks = tokenize("的了是和");
    expect(toks).toEqual([]);
  });

  it("handles mixed cn/en", () => {
    const toks = tokenize("Transformer 模型");
    expect(toks).toContain("transformer");
    expect(toks).toContain("模型");
  });

  it("returns empty for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- tokenizer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tokenizer**

Create `src/lib/retrieval/tokenizer.ts`:

```ts
const EN_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "i", "in", "is", "it", "its", "of", "on", "or",
  "that", "the", "this", "to", "was", "were", "will", "with", "you", "your",
  "we", "our", "they", "them", "these", "those", "can", "could", "do", "does",
  "not", "no", "so", "if", "than", "then", "too", "very",
]);

const CN_STOPWORDS = new Set([
  "的", "了", "是", "和", "在", "有", "也", "就", "都", "而", "及", "与",
  "或", "一个", "一些", "这个", "那个", "这", "那", "他", "她", "它", "我",
  "你", "我们", "你们", "他们", "但是", "因为", "所以", "如果", "不是",
]);

const CN_REGEX = /[\u4e00-\u9fff]+/g;
const EN_TOKEN_REGEX = /[a-z0-9]+/g;

function ngrams(seq: string, min: number, max: number): string[] {
  const out: string[] = [];
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= seq.length; i++) {
      out.push(seq.slice(i, i + n));
    }
  }
  return out;
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tokens: string[] = [];

  const enMatches = lower.match(EN_TOKEN_REGEX) ?? [];
  for (const tok of enMatches) {
    if (!EN_STOPWORDS.has(tok) && tok.length > 1) tokens.push(tok);
  }

  const cnMatches = lower.match(CN_REGEX) ?? [];
  for (const run of cnMatches) {
    for (const gram of ngrams(run, 2, 4)) {
      if (!CN_STOPWORDS.has(gram)) tokens.push(gram);
    }
  }

  return tokens;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- tokenizer`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval/tokenizer.ts src/lib/retrieval/tokenizer.test.ts
git commit -m "feat(retrieval): add bilingual tokenizer with stopwords"
```

---

## Task 4: Chunker

**Files:**
- Create: `src/lib/retrieval/chunker.ts`
- Create: `src/lib/retrieval/chunker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/retrieval/chunker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { chunkTranscript } from "./chunker";
import { DEFAULT_RETRIEVAL_CONFIG } from "./types";

describe("chunkTranscript", () => {
  it("returns single chunk when transcript under min", () => {
    const chunks = chunkTranscript("short text", "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceId).toBe("v1");
    expect(chunks[0].id).toBe("v1:c0");
    expect(chunks[0].text).toBe("short text");
    expect(chunks[0].startRatio).toBe(0);
    expect(chunks[0].endRatio).toBe(1);
  });

  it("splits paragraphs by blank lines, aggregates up to maxChars", () => {
    const para1 = "a".repeat(400);
    const para2 = "b".repeat(400);
    const para3 = "c".repeat(400);
    const transcript = [para1, para2, para3].join("\n\n");
    const chunks = chunkTranscript(transcript, "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1000);
  });

  it("breaks long paragraphs on sentence punctuation", () => {
    const sentence = "一句很长的话。".repeat(200); // ~1400 chars
    const chunks = chunkTranscript(sentence, "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1000);
  });

  it("assigns monotonically increasing ratios", () => {
    const transcript = "x".repeat(3000);
    const chunks = chunkTranscript(transcript, "v1", DEFAULT_RETRIEVAL_CONFIG);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startRatio).toBeGreaterThanOrEqual(chunks[i - 1].endRatio - 0.01);
    }
    expect(chunks[0].startRatio).toBe(0);
    expect(chunks[chunks.length - 1].endRatio).toBeCloseTo(1, 2);
  });

  it("uses sourceId in chunk.id", () => {
    const chunks = chunkTranscript("hello", "v2", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks[0].id).toBe("v2:c0");
  });

  it("handles empty input", () => {
    expect(chunkTranscript("", "v1", DEFAULT_RETRIEVAL_CONFIG)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- chunker`
Expected: FAIL.

- [ ] **Step 3: Implement chunker**

Create `src/lib/retrieval/chunker.ts`:

```ts
import type { Chunk, RetrievalConfig } from "./types";

const SENTENCE_BOUNDARY = /([。！？!?.]\s*|\n+)/g;

function splitLongParagraph(para: string, maxChars: number): string[] {
  if (para.length <= maxChars) return [para];
  const parts = para.split(SENTENCE_BOUNDARY).filter((s) => s.length > 0);
  const out: string[] = [];
  let buf = "";
  for (const piece of parts) {
    if ((buf + piece).length > maxChars && buf.length > 0) {
      out.push(buf);
      buf = piece;
    } else {
      buf += piece;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out.length > 0 ? out : [para.slice(0, maxChars)];
}

export function chunkTranscript(
  transcript: string,
  sourceId: string,
  config: RetrievalConfig
): Chunk[] {
  if (!transcript) return [];
  const total = transcript.length;
  const paragraphs = transcript.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];

  const pieces: string[] = [];
  for (const p of paragraphs) {
    pieces.push(...splitLongParagraph(p, config.chunkMaxChars));
  }

  const chunks: Chunk[] = [];
  let buf = "";
  let consumed = 0;
  let chunkStart = 0;

  for (const piece of pieces) {
    if (buf.length > 0 && (buf.length + piece.length) > config.chunkMaxChars) {
      const text = buf.trim();
      chunks.push({
        id: `${sourceId}:c${chunks.length}`,
        sourceId,
        index: chunks.length,
        text,
        startRatio: chunkStart / total,
        endRatio: consumed / total,
      });
      chunkStart = consumed;
      buf = "";
    }
    buf += (buf.length > 0 ? "\n" : "") + piece;
    consumed += piece.length + 2; // approx for separator
  }

  if (buf.length > 0) {
    const text = buf.trim();
    chunks.push({
      id: `${sourceId}:c${chunks.length}`,
      sourceId,
      index: chunks.length,
      text,
      startRatio: chunkStart / total,
      endRatio: 1,
    });
  }

  // Merge adjacent chunks under chunkMinChars
  const merged: Chunk[] = [];
  for (const c of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && prev.text.length < config.chunkMinChars && (prev.text.length + c.text.length) <= config.chunkMaxChars) {
      merged[merged.length - 1] = {
        ...prev,
        text: prev.text + "\n" + c.text,
        endRatio: c.endRatio,
      };
    } else {
      merged.push({ ...c, id: `${sourceId}:c${merged.length}`, index: merged.length });
    }
  }

  return merged;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- chunker`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval/chunker.ts src/lib/retrieval/chunker.test.ts
git commit -m "feat(retrieval): add paragraph+sentence-aware chunker"
```

---

## Task 5: BM25 Scoring + Dedup + Top-K

**Files:**
- Create: `src/lib/retrieval/bm25.ts`
- Create: `src/lib/retrieval/bm25.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/retrieval/bm25.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreAndSelect } from "./bm25";
import type { Chunk } from "./types";

const chunk = (id: string, text: string, sourceId = "v1"): Chunk => ({
  id,
  sourceId,
  index: 0,
  text,
  startRatio: 0,
  endRatio: 1,
});

describe("scoreAndSelect", () => {
  it("ranks chunks with more keyword hits higher", () => {
    const chunks = [
      chunk("a", "attention mechanism self-attention softmax"),
      chunk("b", "unrelated content about cats and dogs"),
      chunk("c", "attention"),
    ];
    const res = scoreAndSelect(chunks, ["attention", "softmax"], 3, 0.7);
    expect(res[0].id).toBe("a");
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });

  it("respects topK cap", () => {
    const chunks = Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, "attention softmax"));
    const res = scoreAndSelect(chunks, ["attention"], 5, 0.7);
    expect(res).toHaveLength(5);
  });

  it("dedups near-duplicate chunks by jaccard threshold", () => {
    const chunks = [
      chunk("a", "attention mechanism explains transformer models"),
      chunk("b", "attention mechanism explains transformer models"), // identical
      chunk("c", "completely different content no overlap"),
    ];
    const res = scoreAndSelect(chunks, ["attention", "transformer"], 10, 0.7);
    const ids = res.map((r) => r.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
  });

  it("gives zero score when no keywords match", () => {
    const chunks = [chunk("a", "unrelated content")];
    const res = scoreAndSelect(chunks, ["attention"], 5, 0.7);
    expect(res).toHaveLength(0);
  });

  it("records matched tokens", () => {
    const chunks = [chunk("a", "attention softmax scaling")];
    const res = scoreAndSelect(chunks, ["attention", "softmax", "missing"], 5, 0.7);
    expect(res[0].matchedTokens).toContain("attention");
    expect(res[0].matchedTokens).toContain("softmax");
    expect(res[0].matchedTokens).not.toContain("missing");
  });

  it("preserves original chunk fields", () => {
    const chunks = [chunk("a", "attention")];
    const res = scoreAndSelect(chunks, ["attention"], 5, 0.7);
    expect(res[0].sourceId).toBe("v1");
    expect(res[0].index).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- bm25`
Expected: FAIL.

- [ ] **Step 3: Implement scoring**

Create `src/lib/retrieval/bm25.ts`:

```ts
import { tokenize } from "./tokenizer";
import type { Chunk, ScoredChunk } from "./types";

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function scoreChunk(
  chunk: Chunk,
  queryTokens: string[]
): { score: number; matchedTokens: string[] } {
  const docTokens = tokenize(chunk.text);
  const docSet = new Set(docTokens);
  const headText = chunk.text.slice(0, 100);
  const headSet = new Set(tokenize(headText));
  const matched: string[] = [];
  let score = 0;
  for (const qt of queryTokens) {
    if (!docSet.has(qt)) continue;
    matched.push(qt);
    // base hit
    const hits = docTokens.filter((t) => t === qt).length;
    score += hits;
    // head boost
    if (headSet.has(qt)) score += 2;
  }
  return { score, matchedTokens: matched };
}

export function scoreAndSelect(
  chunks: Chunk[],
  queryTokens: string[],
  topK: number,
  jaccardThreshold: number
): ScoredChunk[] {
  const scored: ScoredChunk[] = [];
  for (const c of chunks) {
    const { score, matchedTokens } = scoreChunk(c, queryTokens);
    if (score > 0) scored.push({ ...c, score, matchedTokens });
  }
  scored.sort((a, b) => b.score - a.score);

  const kept: ScoredChunk[] = [];
  const tokenSets: Set<string>[] = [];
  for (const candidate of scored) {
    const cSet = new Set(tokenize(candidate.text));
    let isDup = false;
    for (const existing of tokenSets) {
      if (jaccard(cSet, existing) >= jaccardThreshold) {
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      kept.push(candidate);
      tokenSets.push(cSet);
    }
    if (kept.length >= topK) break;
  }
  return kept;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- bm25`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval/bm25.ts src/lib/retrieval/bm25.test.ts
git commit -m "feat(retrieval): add BM25-lite scoring with dedup + top-K"
```

---

## Task 6: Intent Expansion (LLM-backed, cached)

**Files:**
- Create: `src/lib/retrieval/intent.ts`
- Create: `src/lib/retrieval/intent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/retrieval/intent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandIntent, _resetIntentCacheForTests } from "./intent";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));
vi.mock("@/lib/ai-client", () => ({
  hasAIKey: vi.fn(() => true),
  getAIModel: vi.fn(async () => ({ mock: "model" })),
}));

import { generateObject } from "ai";

describe("expandIntent", () => {
  beforeEach(() => {
    _resetIntentCacheForTests();
    vi.clearAllMocks();
  });

  it("returns tokens from intent + LLM expansion", async () => {
    (generateObject as any).mockResolvedValue({
      object: { keywords: ["self-attention", "softmax"] },
    });
    const out = await expandIntent({
      intent: "attention mechanism",
      titles: ["Transformers"],
      tags: ["ML"],
    });
    expect(out).toContain("attention");
    expect(out).toContain("mechanism");
    expect(out).toContain("self-attention");
    expect(out).toContain("softmax");
  });

  it("caches by (intent + title) key", async () => {
    (generateObject as any).mockResolvedValue({ object: { keywords: ["k1"] } });
    await expandIntent({ intent: "x", titles: ["t"], tags: [] });
    await expandIntent({ intent: "x", titles: ["t"], tags: [] });
    expect((generateObject as any).mock.calls.length).toBe(1);
  });

  it("falls back to raw intent tokens when LLM fails", async () => {
    (generateObject as any).mockRejectedValue(new Error("LLM down"));
    const out = await expandIntent({
      intent: "attention mechanism",
      titles: ["T"],
      tags: [],
    });
    expect(out).toContain("attention");
    expect(out).toContain("mechanism");
  });

  it("returns empty list for empty intent", async () => {
    const out = await expandIntent({ intent: "", titles: [], tags: [] });
    expect(out).toEqual([]);
    expect((generateObject as any).mock.calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- intent`
Expected: FAIL.

- [ ] **Step 3: Implement intent expansion**

Create `src/lib/retrieval/intent.ts`:

```ts
import { tokenize } from "./tokenizer";
import type { IntentContext } from "./types";

interface CacheEntry {
  keywords: string[];
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;

export function _resetIntentCacheForTests() {
  CACHE.clear();
}

function cacheKey(ctx: IntentContext): string {
  return `${ctx.intent.trim().toLowerCase()}|${ctx.titles.join("|").toLowerCase()}`;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of CACHE.entries()) {
    if (v.expiresAt < now) CACHE.delete(k);
  }
  if (CACHE.size > MAX_ENTRIES) {
    const sorted = [...CACHE.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) CACHE.delete(sorted[i][0]);
  }
}

export async function expandIntent(ctx: IntentContext): Promise<string[]> {
  const baseTokens = tokenize(ctx.intent);
  if (!ctx.intent.trim()) return [];

  const key = cacheKey(ctx);
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Array.from(new Set([...baseTokens, ...cached.keywords.flatMap((k) => tokenize(k))]));
  }

  try {
    const { hasAIKey, getAIModel } = await import("@/lib/ai-client");
    if (!hasAIKey()) {
      return baseTokens;
    }
    const { generateObject } = await import("ai");
    const { z } = await import("zod");
    const Schema = z.object({ keywords: z.array(z.string()).min(1).max(20) });

    const prompt = `你是关键词扩展助手。把用户意图扩展成 5-15 个同义词/相关关键词（中英文都给），用于在视频字幕中做关键词检索。

用户意图：${ctx.intent}
相关视频标题：${ctx.titles.join("; ")}
相关标签：${ctx.tags.join(", ")}

输出 JSON：{"keywords": ["...", "..."]}
- 给原词的同义词、变体、英中互译
- 给领域相关的核心术语（如"attention" → "self-attention", "Q K V"）
- 不要太泛（避免"机器学习"这种无意义宽词）`;

    const { object } = await generateObject({
      model: await getAIModel(),
      schema: Schema,
      mode: "json",
      prompt,
    });

    CACHE.set(key, { keywords: object.keywords, expiresAt: Date.now() + TTL_MS });
    prune();

    const expanded = object.keywords.flatMap((k) => tokenize(k));
    return Array.from(new Set([...baseTokens, ...expanded]));
  } catch (err) {
    console.warn("[intent] LLM expansion failed, falling back to raw tokens:", err);
    return baseTokens;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- intent`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval/intent.ts src/lib/retrieval/intent.test.ts
git commit -m "feat(retrieval): add LLM intent expansion with memory cache"
```

---

## Task 7: Retrieval Orchestrator

**Files:**
- Create: `src/lib/retrieval/index.ts`
- Create: `src/lib/retrieval/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/retrieval/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrieveForSkill } from "./index";

vi.mock("./intent", () => ({
  expandIntent: vi.fn(async ({ intent }: { intent: string }) => (intent ? ["attention", "softmax"] : [])),
}));

describe("retrieveForSkill", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns strategy=full when all transcripts under threshold", async () => {
    const res = await retrieveForSkill({
      videos: [{ id: "v1", title: "short", tags: [], transcript: "tiny content attention" }],
      intent: "attention",
    });
    expect(res.strategy).toBe("full");
  });

  it("retrieves top-K from multi-video pool when transcript total exceeds threshold", async () => {
    const big = "attention softmax\n\n" + "filler ".repeat(500);
    const res = await retrieveForSkill({
      videos: [
        { id: "v1", title: "", tags: [], transcript: big },
        { id: "v2", title: "", tags: [], transcript: big.replace("attention", "notthere") },
      ],
      intent: "attention",
    });
    expect(res.strategy).toBe("retrieved");
    expect(res.chunks.length).toBeGreaterThan(0);
    expect(res.chunks.length).toBeLessThanOrEqual(8);
  });

  it("falls back to full when BM25 produces zero matches", async () => {
    const noMatch = "zebra ".repeat(2000);
    const res = await retrieveForSkill({
      videos: [{ id: "v1", title: "", tags: [], transcript: noMatch }],
      intent: "attention mechanism",
    });
    expect(res.strategy).toBe("full");
    expect(res.notes.some((n) => n.toLowerCase().includes("fallback"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- retrieval/index`
Expected: FAIL.

- [ ] **Step 3: Implement orchestrator**

Create `src/lib/retrieval/index.ts`:

```ts
import { chunkTranscript } from "./chunker";
import { scoreAndSelect } from "./bm25";
import { expandIntent } from "./intent";
import { tokenize } from "./tokenizer";
import {
  DEFAULT_RETRIEVAL_CONFIG,
  type Chunk,
  type RetrievalConfig,
  type RetrievalResult,
  type VideoSource,
} from "./types";

const FULL_MODE_TOTAL_CHAR_THRESHOLD = 3000;

export interface RetrieveInputs {
  videos: VideoSource[];
  intent: string;
  config?: Partial<RetrievalConfig>;
}

export async function retrieveForSkill(inputs: RetrieveInputs): Promise<RetrievalResult> {
  const config: RetrievalConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...(inputs.config ?? {}) };
  const notes: string[] = [];
  const totalChars = inputs.videos.reduce((s, v) => s + v.transcript.length, 0);

  if (totalChars < FULL_MODE_TOTAL_CHAR_THRESHOLD) {
    return { strategy: "full", chunks: [], keywords: [], notes: ["under threshold → full mode"] };
  }

  const keywordList = await expandIntent({
    intent: inputs.intent,
    titles: inputs.videos.map((v) => v.title),
    tags: inputs.videos.flatMap((v) => v.tags),
  });

  const titleTokens = inputs.videos.flatMap((v) => tokenize(v.title));
  const tagTokens = inputs.videos.flatMap((v) => v.tags.flatMap((t) => tokenize(t)));
  const queryTokens = Array.from(new Set([...keywordList, ...titleTokens, ...tagTokens]));

  if (queryTokens.length === 0) {
    notes.push("no query tokens → fallback full mode");
    return { strategy: "full", chunks: [], keywords: [], notes };
  }

  const allChunks: Chunk[] = [];
  for (const v of inputs.videos) {
    allChunks.push(...chunkTranscript(v.transcript, v.id, config));
  }

  const selected = scoreAndSelect(allChunks, queryTokens, config.topK, config.jaccardThreshold);
  if (selected.length === 0) {
    notes.push("BM25 zero matches → fallback full mode");
    return { strategy: "full", chunks: [], keywords: queryTokens, notes };
  }

  // Re-sort selected by sourceId+index for stable prompt order
  selected.sort((a, b) => (a.sourceId === b.sourceId ? a.index - b.index : a.sourceId.localeCompare(b.sourceId)));
  return { strategy: "retrieved", chunks: selected, keywords: queryTokens, notes };
}

export type { VideoSource, RetrievalResult, ScoredChunk, Chunk, RetrievalConfig } from "./types";
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- retrieval/index`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run full retrieval suite**

Run: `cd src && npm test -- retrieval`
Expected: all retrieval tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/retrieval/index.ts src/lib/retrieval/index.test.ts
git commit -m "feat(retrieval): add orchestrator with threshold + fallback"
```

---

## Task 8: Batch Runner

**Files:**
- Create: `src/lib/batch/types.ts`
- Create: `src/lib/batch/runner.ts`
- Create: `src/lib/batch/runner.test.ts`

- [ ] **Step 1: Write types**

Create `src/lib/batch/types.ts`:

```ts
import type { UrlExtractorResult } from "@/components/create/UrlExtractor";

export type BatchItemStatus = "pending" | "extracting" | "done" | "failed";

export interface BatchItem {
  url: string;
  status: BatchItemStatus;
  video?: UrlExtractorResult["video"];
  meta?: UrlExtractorResult["meta"];
  error?: { code: string; message: string };
}

export interface BatchResult {
  items: BatchItem[];
  successCount: number;
  failureCount: number;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/lib/batch/runner.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runBatchExtract } from "./runner";

const mockExtractor = vi.fn();
vi.mock("@/lib/extractor/registry", () => ({
  extractVideo: (url: string) => mockExtractor(url),
}));

describe("runBatchExtract", () => {
  it("processes urls serially and returns per-url results", async () => {
    mockExtractor.mockImplementation(async (url: string) => ({
      video: {
        title: `T-${url}`,
        author: "",
        description: "",
        transcript: "x",
        tags: [],
        duration: 0,
        platform: "yt",
        url,
        thumbnailUrl: "",
      },
      meta: { subtitleSource: "auto", language: "en", isAuto: true, charCount: 1 },
    }));
    const res = await runBatchExtract(["https://a", "https://b"]);
    expect(res.successCount).toBe(2);
    expect(res.failureCount).toBe(0);
    expect(res.items.map((i) => i.url)).toEqual(["https://a", "https://b"]);
    expect(res.items.every((i) => i.status === "done")).toBe(true);
  });

  it("isolates failures (one fails, others continue)", async () => {
    mockExtractor.mockImplementationOnce(async () => {
      throw Object.assign(new Error("boom"), { code: "EXTRACTOR_FAILED" });
    });
    mockExtractor.mockImplementationOnce(async (url: string) => ({
      video: {
        title: "ok",
        author: "",
        description: "",
        transcript: "x",
        tags: [],
        duration: 0,
        platform: "yt",
        url,
        thumbnailUrl: "",
      },
      meta: { subtitleSource: "auto", language: "en", isAuto: true, charCount: 1 },
    }));
    const res = await runBatchExtract(["https://bad", "https://good"]);
    expect(res.successCount).toBe(1);
    expect(res.failureCount).toBe(1);
    expect(res.items[0].status).toBe("failed");
    expect(res.items[1].status).toBe("done");
  });

  it("invokes onProgress after each item", async () => {
    mockExtractor.mockImplementation(async () => ({
      video: { title: "x", author: "", description: "", transcript: "x", tags: [], duration: 0, platform: "yt", url: "u", thumbnailUrl: "" },
      meta: { subtitleSource: "auto", language: "en", isAuto: true, charCount: 1 },
    }));
    const calls: string[] = [];
    await runBatchExtract(["a", "b"], (item) => calls.push(item.status));
    expect(calls).toContain("extracting");
    expect(calls).toContain("done");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `cd src && npm test -- batch/runner`
Expected: FAIL.

- [ ] **Step 4: Implement runner**

Create `src/lib/batch/runner.ts`:

```ts
import type { BatchItem, BatchResult } from "./types";

export interface ExtractorResult {
  video: BatchItem["video"];
  meta: BatchItem["meta"];
}

export async function runBatchExtract(
  urls: string[],
  onProgress?: (item: BatchItem) => void
): Promise<BatchResult> {
  const { extractVideo } = await import("@/lib/extractor/registry");
  const items: BatchItem[] = urls.map((url) => ({ url, status: "pending" }));
  let success = 0;
  let failure = 0;

  for (let i = 0; i < items.length; i++) {
    items[i] = { ...items[i], status: "extracting" };
    onProgress?.(items[i]);
    try {
      const { video, meta } = (await extractVideo(items[i].url)) as ExtractorResult;
      items[i] = { url: items[i].url, status: "done", video, meta };
      success++;
    } catch (err) {
      const code = (err as { code?: string }).code ?? "EXTRACTOR_FAILED";
      const message = err instanceof Error ? err.message : String(err);
      items[i] = { url: items[i].url, status: "failed", error: { code, message } };
      failure++;
    }
    onProgress?.(items[i]);
  }

  return { items, successCount: success, failureCount: failure };
}
```

- [ ] **Step 5: Verify `extractVideo` exists in registry**

Run: `cd src && grep -n "extractVideo\|export" lib/extractor/registry.ts | head -10`

If `extractVideo` is not exported with that name, adapt the import — check the actual exported function name in `lib/extractor/registry.ts` (likely `extractFromUrl` or `routeExtractor`). Update both the mock in tests and the import here to match.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd src && npm test -- batch/runner`
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/batch/types.ts src/lib/batch/runner.ts src/lib/batch/runner.test.ts
git commit -m "feat(batch): add serial runner with failure isolation"
```

---

## Task 9: Validator Schemas for Intent + Batch

**Files:**
- Modify: `src/lib/validators/videoInput.ts`

- [ ] **Step 1: Read current schema**

Run: `cd src && cat lib/validators/videoInput.ts`
Note the existing exports (likely `videoInputSchema`, `videoClassificationSchema`, constants).

- [ ] **Step 2: Add intent + batch schemas**

At the end of `src/lib/validators/videoInput.ts`, add:

```ts
export const MAX_INTENT_LENGTH = 300;
export const MAX_BATCH_URLS = 10;

export const intentSchema = z
  .string()
  .trim()
  .max(MAX_INTENT_LENGTH, `学习意图不能超过 ${MAX_INTENT_LENGTH} 字`)
  .optional();

export const batchExtractInputSchema = z.object({
  urls: z
    .array(z.string().url("URL 格式不正确"))
    .min(1, "至少提供 1 个 URL")
    .max(MAX_BATCH_URLS, `最多支持 ${MAX_BATCH_URLS} 个视频`),
});

export const batchGenerateInputSchema = z.object({
  videos: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        author: z.string().optional(),
        description: z.string().optional(),
        transcript: z.string().min(1),
        tags: z.array(z.string()).default([]),
        url: z.string().url(),
      })
    )
    .min(1)
    .max(MAX_BATCH_URLS),
  intent: intentSchema,
  category: z.enum(categoryIds),
  skillName: z.string().min(1),
});

// Extend videoInputSchema with optional intent (backward compatible)
export const videoInputWithIntentSchema = videoInputSchema.extend({
  intent: intentSchema,
});
```

- [ ] **Step 3: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors. If `videoInputSchema` is not defined in this file, rename to match the existing schema name, then rerun.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators/videoInput.ts
git commit -m "feat(validators): add intent + batch extract/generate schemas"
```

---

## Task 10: AI-Client Dual-Mode Prompt

**Files:**
- Modify: `src/lib/ai-client.ts`

- [ ] **Step 1: Locate buildSkillGenerationPrompt**

Run: `cd src && grep -n "buildSkillGenerationPrompt\|buildClassifyPrompt\|export" lib/ai-client.ts`

- [ ] **Step 2: Add retrieval-mode overload**

In `src/lib/ai-client.ts`, **add** (don't replace) a new overload:

```ts
import type { ScoredChunk } from "./retrieval/types";

export interface RetrievalContext {
  intent: string;
  chunks: ScoredChunk[];
  videoMap: Record<string, { title: string; index: number }>;
}

export function buildSkillGenerationPromptFromChunks(
  input: {
    title: string;
    author?: string;
    description?: string;
    tags: string[];
    category: string;
    skillName: string;
  },
  ctx: RetrievalContext
): string {
  const intentLine = ctx.intent.trim()
    ? `# 用户学习意图\n${ctx.intent}`
    : `# 用户学习意图\n（未填写，请按综合主题生成通用 Skill）`;

  const segments = ctx.chunks
    .map((c) => {
      const v = ctx.videoMap[c.sourceId];
      const label = v ? `视频 ${v.index + 1}（${v.title}）` : c.sourceId;
      const position = `${(c.startRatio * 100).toFixed(1)}%-${(c.endRatio * 100).toFixed(1)}%`;
      return `---\n【${label}｜位置 ${position}】\n${c.text}`;
    })
    .join("\n");

  return `你是 FavToSkill 的 Skill 生成助手。根据以下多视频检索出的关键片段，生成一份 Claude Code Skill。

${intentLine}

# Skill 元信息
- displayName 来源：${input.title}
- 分类：${input.category}
- 建议 skillName：${input.skillName}
- 标签：${input.tags.join(", ")}
${input.description ? `- 视频简介：${input.description}` : ""}

# 检索到的相关片段（按视频+原顺序排列）
${segments}

# 硬要求
1. instructions 必须紧扣"用户学习意图"——如果意图和片段不完全匹配，在 description 里诚实说明
2. 每条 instructions 末尾用 [视频 N] 或 [视频 N+M] 标注来源，可多来源
3. 不要超出以上片段的信息范围胡编；不要补充片段外的知识
4. 如果多个视频讲同一个点，合并成一条 instruction（去重）
5. 输出 JSON，schema 由上层校验；instructions 是 markdown 字符串（一行一个要点，- 开头）`;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-client.ts
git commit -m "feat(ai-client): add dual-mode prompt builder for retrieved chunks"
```

---

## Task 11: skillTemplate — Accept RetrievalContext

**Files:**
- Modify: `src/lib/skillTemplate.ts`

- [ ] **Step 1: Read current generateSkillWithAI**

Run: `cd src && grep -n "generateSkillWithAI\|export" lib/skillTemplate.ts`

- [ ] **Step 2: Add optional retrievalContext parameter**

Modify the signature of `generateSkillWithAI` to accept `retrievalContext?: RetrievalContext` as an additional option. When `retrievalContext.chunks.length > 0`, call `buildSkillGenerationPromptFromChunks` instead of the default prompt builder. Import the new type:

```ts
import { buildSkillGenerationPromptFromChunks, type RetrievalContext } from "./ai-client";
```

Inside the function, after validating inputs and before the retry loop:

```ts
const prompt = retrievalContext && retrievalContext.chunks.length > 0
  ? buildSkillGenerationPromptFromChunks({
      title: input.title,
      author: input.author,
      description: input.description,
      tags: input.tags,
      category: input.category,
      skillName: input.skillName,
    }, retrievalContext)
  : buildSkillGenerationPrompt(input); // existing prompt builder
```

**Exact edit location:** find the existing line that calls the original prompt builder and wrap it in this conditional. Do not change the existing path when `retrievalContext` is absent.

- [ ] **Step 3: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/skillTemplate.ts
git commit -m "feat(skillTemplate): accept optional retrievalContext for chunked prompt"
```

---

## Task 12: Wire Retrieval Into Single-Video Generate

**Files:**
- Modify: `src/app/api/skills/generate/route.ts`

- [ ] **Step 1: Read current route**

Run: `cd src && cat app/api/skills/generate/route.ts`

- [ ] **Step 2: Integrate retrieveForSkill**

After input validation and before calling `generateSkillWithAI`, add:

```ts
import { retrieveForSkill } from "@/lib/retrieval";
import type { RetrievalContext } from "@/lib/ai-client";

// ... inside POST handler, after parsing input
const retrieval = await retrieveForSkill({
  videos: [{ id: "v1", title: input.title, tags: input.tags ?? [], transcript: input.transcript }],
  intent: input.intent ?? "",
});

let retrievalContext: RetrievalContext | undefined;
if (retrieval.strategy === "retrieved") {
  retrievalContext = {
    intent: input.intent ?? "",
    chunks: retrieval.chunks,
    videoMap: { v1: { title: input.title, index: 0 } },
  };
}

// Pass retrievalContext into generateSkillWithAI
const result = await generateSkillWithAI({ ...input, retrievalContext });
```

Also change the input parser to `videoInputWithIntentSchema` so `intent` is accepted:

```ts
import { videoInputWithIntentSchema } from "@/lib/validators/videoInput";
// replace videoInputSchema.safeParse with videoInputWithIntentSchema.safeParse
```

- [ ] **Step 3: Typecheck + build**

Run: `cd src && npx tsc --noEmit && npm test`
Expected: no TS errors, all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/skills/generate/route.ts
git commit -m "feat(api): wire retrieval into single-video generate (Phase C landing)"
```

---

## Task 13: Batch-Extract API

**Files:**
- Create: `src/app/api/videos/batch-extract/route.ts`
- Create: `src/app/api/videos/batch-extract/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/videos/batch-extract/route.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/batch/runner", () => ({
  runBatchExtract: vi.fn(async (urls: string[]) => ({
    items: urls.map((url) => ({
      url,
      status: "done" as const,
      video: { title: "x", author: "", description: "", transcript: "t", tags: [], duration: 0, platform: "yt", url, thumbnailUrl: "" },
      meta: { subtitleSource: "auto" as const, language: "en", isAuto: true, charCount: 1 },
    })),
    successCount: urls.length,
    failureCount: 0,
  })),
}));

import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/videos/batch-extract", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/videos/batch-extract", () => {
  it("returns items for valid input", async () => {
    const res = await POST(makeReq({ urls: ["https://a.com", "https://b.com"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.successCount).toBe(2);
  });

  it("rejects empty urls", async () => {
    const res = await POST(makeReq({ urls: [] }));
    expect(res.status).toBe(422);
  });

  it("rejects more than 10 urls", async () => {
    const res = await POST(makeReq({ urls: Array(11).fill("https://x") }));
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- batch-extract`
Expected: FAIL.

- [ ] **Step 3: Implement route**

Create `src/app/api/videos/batch-extract/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { batchExtractInputSchema } from "@/lib/validators/videoInput";
import { runBatchExtract } from "@/lib/batch/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = batchExtractInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "URL 列表校验失败" },
        { status: 422 }
      );
    }
    const result = await runBatchExtract(parsed.data.urls);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[batch-extract]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "批量抽取失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- batch-extract`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/videos/batch-extract/
git commit -m "feat(api): add batch-extract route"
```

---

## Task 14: Batch-Generate API

**Files:**
- Create: `src/app/api/skills/batch-generate/route.ts`
- Create: `src/app/api/skills/batch-generate/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/skills/batch-generate/route.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/retrieval", () => ({
  retrieveForSkill: vi.fn(async () => ({
    strategy: "retrieved",
    chunks: [{ id: "v1:c0", sourceId: "v1", index: 0, text: "some content", startRatio: 0, endRatio: 1, score: 2, matchedTokens: ["attention"] }],
    keywords: ["attention"],
    notes: [],
  })),
}));
vi.mock("@/lib/skillTemplate", () => ({
  generateSkillWithAI: vi.fn(async () => ({ skillMarkdown: "# Skill\n...", raw: {} })),
}));
vi.mock("@/lib/ai-client", () => ({
  hasAIKey: () => true,
  getAIModel: async () => ({}),
  buildSkillGenerationPromptFromChunks: () => "prompt",
}));

import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/skills/batch-generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  videos: [
    { id: "v1", title: "T1", transcript: "content", tags: [], url: "https://a.com" },
  ],
  intent: "attention",
  category: "tech",
  skillName: "attention-skill",
};

describe("POST /api/skills/batch-generate", () => {
  it("returns skill markdown", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skillMarkdown).toContain("Skill");
  });

  it("422 on invalid input", async () => {
    const res = await POST(makeReq({ videos: [] }));
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd src && npm test -- batch-generate`
Expected: FAIL.

- [ ] **Step 3: Implement route**

Create `src/app/api/skills/batch-generate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { batchGenerateInputSchema } from "@/lib/validators/videoInput";
import { retrieveForSkill } from "@/lib/retrieval";
import { generateSkillWithAI } from "@/lib/skillTemplate";
import type { RetrievalContext } from "@/lib/ai-client";
import { hasAIKey } from "@/lib/ai-client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    if (!hasAIKey()) {
      return NextResponse.json(
        { error: "AI_API_KEY 未配置。请在 .env 中配置后重试。" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const parsed = batchGenerateInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "输入校验失败" },
        { status: 422 }
      );
    }

    const { videos, intent, category, skillName } = parsed.data;
    const videoMap: RetrievalContext["videoMap"] = {};
    videos.forEach((v, i) => {
      videoMap[v.id] = { title: v.title, index: i };
    });

    const retrieval = await retrieveForSkill({
      videos: videos.map((v) => ({ id: v.id, title: v.title, tags: v.tags, transcript: v.transcript })),
      intent: intent ?? "",
    });

    const mergedTitle = videos.map((v) => v.title).join(" + ");
    const mergedTags = Array.from(new Set(videos.flatMap((v) => v.tags))).slice(0, 15);

    let retrievalContext: RetrievalContext | undefined;
    if (retrieval.strategy === "retrieved") {
      retrievalContext = { intent: intent ?? "", chunks: retrieval.chunks, videoMap };
    }

    const fullTranscript = videos.map((v, i) => `[视频 ${i + 1}] ${v.title}\n${v.transcript}`).join("\n\n");

    const result = await generateSkillWithAI({
      title: mergedTitle,
      author: "",
      description: videos.map((v) => v.description ?? "").filter(Boolean).join(" / ").slice(0, 1000),
      transcript: fullTranscript,
      tags: mergedTags,
      category,
      skillName,
      intent: intent ?? "",
      retrievalContext,
    });

    return NextResponse.json({
      skillMarkdown: result.skillMarkdown,
      strategy: retrieval.strategy,
      sources: videos.map((v, i) => ({ index: i + 1, title: v.title, url: v.url })),
      notes: retrieval.notes,
    });
  } catch (err) {
    console.error("[batch-generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "批量生成失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd src && npm test -- batch-generate`
Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/skills/batch-generate/
git commit -m "feat(api): add batch-generate route with cross-video retrieval"
```

---

## Task 15: IntentField Component

**Files:**
- Create: `src/components/batch/IntentField.tsx`

- [ ] **Step 1: Implement component**

Create `src/components/batch/IntentField.tsx`:

```tsx
"use client";

import { MAX_INTENT_LENGTH } from "@/lib/validators/videoInput";

interface IntentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function IntentField({ value, onChange, disabled }: IntentFieldProps) {
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <label className="block text-lg font-semibold text-[#1A1A1A]">学习意图</label>
      <p className="mt-1 text-sm text-[#5F6F7A]">
        告诉 AI 你想从这些视频里学到什么——越具体，生成的 Skill 越贴合。
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_INTENT_LENGTH))}
        disabled={disabled}
        className="mt-3 w-full rounded-2xl border border-[#D6E5EC] bg-white px-4 py-3 text-sm text-[#1A1A1A] outline-none transition placeholder:text-[#94A7B2] focus:border-[#8CB7CA] focus:ring-2 focus:ring-[#C8E6F5]"
        rows={3}
        placeholder="例：我已经懂神经网络，只想搞懂 attention 机制的具体计算步骤"
      />
      <div className="mt-2 text-right text-xs text-[#94A7B2]">
        {value.length} / {MAX_INTENT_LENGTH}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/batch/IntentField.tsx
git commit -m "feat(ui): add IntentField component"
```

---

## Task 16: BatchUrlList Component

**Files:**
- Create: `src/components/batch/BatchUrlList.tsx`

- [ ] **Step 1: Implement**

Create `src/components/batch/BatchUrlList.tsx`:

```tsx
"use client";

import { MAX_BATCH_URLS } from "@/lib/validators/videoInput";

interface BatchUrlListProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export default function BatchUrlList({ urls, onChange, disabled }: BatchUrlListProps) {
  const updateAt = (i: number, val: string) => {
    const next = [...urls];
    next[i] = val;
    onChange(next);
  };
  const removeAt = (i: number) => {
    const next = urls.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
  };
  const addRow = () => {
    if (urls.length >= MAX_BATCH_URLS) return;
    onChange([...urls, ""]);
  };

  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">视频链接（1 - {MAX_BATCH_URLS} 个）</h2>
        <p className="mt-1 text-sm text-[#5F6F7A]">推荐 YouTube；Bilibili 仅部分支持（硬字幕不可抓）。</p>
      </div>
      <div className="space-y-3">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 self-center text-xs text-[#94A7B2]">{i + 1}</span>
            <input
              type="url"
              value={url}
              onChange={(e) => updateAt(i, e.target.value)}
              disabled={disabled}
              className="w-full rounded-2xl border border-[#D6E5EC] bg-white px-4 py-3 text-sm outline-none focus:border-[#8CB7CA] focus:ring-2 focus:ring-[#C8E6F5]"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              disabled={disabled || urls.length <= 1}
              className="shrink-0 rounded-full border border-[#D6E5EC] px-3 py-2 text-xs text-[#5F6F7A] disabled:opacity-40"
            >
              删除
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        disabled={disabled || urls.length >= MAX_BATCH_URLS}
        className="mt-4 rounded-full border border-dashed border-[#B3CEDB] px-4 py-2 text-xs text-[#2C2C2C] disabled:opacity-40"
      >
        + 添加一行（当前 {urls.length}/{MAX_BATCH_URLS}）
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/batch/BatchUrlList.tsx
git commit -m "feat(ui): add BatchUrlList component"
```

---

## Task 17: BatchExtractionProgress + BatchVideoPreview

**Files:**
- Create: `src/components/batch/BatchExtractionProgress.tsx`
- Create: `src/components/batch/BatchVideoPreview.tsx`

- [ ] **Step 1: Implement progress component**

Create `src/components/batch/BatchExtractionProgress.tsx`:

```tsx
"use client";

import type { BatchItem } from "@/lib/batch/types";

interface Props {
  items: BatchItem[];
}

const STATUS_LABEL: Record<BatchItem["status"], string> = {
  pending: "待处理",
  extracting: "抓取中",
  done: "完成",
  failed: "失败",
};

const STATUS_CLASS: Record<BatchItem["status"], string> = {
  pending: "bg-[#F0F5F8] text-[#94A7B2]",
  extracting: "bg-[#FFF7D6] text-[#8B6A00]",
  done: "bg-[#E1F5E1] text-[#2D7A2D]",
  failed: "bg-[#FFE1E1] text-[#B65252]",
};

export default function BatchExtractionProgress({ items }: Props) {
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <h3 className="mb-3 text-base font-semibold text-[#1A1A1A]">抓取进度</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
            <span className="flex-1 truncate text-[#5F6F7A]">{item.url}</span>
            {item.error && (
              <span className="text-xs text-[#B65252]">{item.error.code}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implement preview component**

Create `src/components/batch/BatchVideoPreview.tsx`:

```tsx
"use client";

import type { BatchItem } from "@/lib/batch/types";

interface Props {
  items: BatchItem[];
}

export default function BatchVideoPreview({ items }: Props) {
  const success = items.filter((i) => i.status === "done" && i.video);
  if (success.length === 0) return null;
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <h3 className="mb-3 text-base font-semibold text-[#1A1A1A]">已抓取 {success.length} 个视频</h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {success.map((item, i) => (
          <li key={i} className="rounded-2xl border border-[#D6E5EC] bg-white p-3">
            <div className="truncate text-sm font-medium text-[#1A1A1A]">{item.video!.title}</div>
            <div className="mt-1 truncate text-xs text-[#94A7B2]">
              {item.video!.platform} · {item.meta?.charCount ?? 0} 字
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/batch/BatchExtractionProgress.tsx src/components/batch/BatchVideoPreview.tsx
git commit -m "feat(ui): add BatchExtractionProgress + BatchVideoPreview"
```

---

## Task 18: /batch Page

**Files:**
- Create: `src/app/batch/page.tsx`

- [ ] **Step 1: Read existing /create for styling reference**

Run: `cd src && head -40 app/create/page.tsx`

- [ ] **Step 2: Implement page**

Create `src/app/batch/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import BatchUrlList from "@/components/batch/BatchUrlList";
import BatchExtractionProgress from "@/components/batch/BatchExtractionProgress";
import BatchVideoPreview from "@/components/batch/BatchVideoPreview";
import IntentField from "@/components/batch/IntentField";
import CategoryPicker from "@/components/create/CategoryPicker";
import SkillConfig from "@/components/create/SkillConfig";
import GeneratedSkillModal from "@/components/create/GeneratedSkillModal";
import { generateSkillName } from "@/lib/skillName";
import type { BatchItem, BatchResult } from "@/lib/batch/types";
import type { CategoryId } from "@/config/categories";

export default function BatchPage() {
  const [urls, setUrls] = useState<string[]>([""]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [intent, setIntent] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [skillName, setSkillName] = useState("");
  const [phase, setPhase] = useState<"idle" | "extracting" | "ready" | "generating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [skillMarkdown, setSkillMarkdown] = useState<string>("");

  const successVideos = items.filter((i) => i.status === "done" && i.video);

  const runExtract = async () => {
    const cleaned = urls.map((u) => u.trim()).filter((u) => u.length > 0);
    if (cleaned.length === 0) {
      setError("至少填一个 URL");
      return;
    }
    setError(null);
    setPhase("extracting");
    setItems(cleaned.map((url) => ({ url, status: "pending" })));
    try {
      const res = await fetch("/api/videos/batch-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: cleaned }),
      });
      const data = (await res.json()) as BatchResult | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "批量抽取失败");
      }
      setItems(data.items);
      if (data.successCount === 0) {
        setError("所有视频都抽取失败");
        setPhase("idle");
        return;
      }
      const firstTitle = data.items.find((i) => i.video)?.video?.title ?? "";
      setSkillName(generateSkillName(firstTitle));
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
      setPhase("idle");
    }
  };

  const runGenerate = async () => {
    if (!category) {
      setError("请选择一个分类");
      return;
    }
    setError(null);
    setPhase("generating");
    try {
      const body = {
        videos: successVideos.map((it, i) => ({
          id: `v${i + 1}`,
          title: it.video!.title,
          author: it.video!.author ?? "",
          description: it.video!.description ?? "",
          transcript: it.video!.transcript,
          tags: it.video!.tags,
          url: it.video!.url,
        })),
        intent,
        category,
        skillName,
      };
      const res = await fetch("/api/skills/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setSkillMarkdown(data.skillMarkdown);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setPhase("ready");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#1A1A1A] md:text-3xl">批量生成 Skill</h1>
        <p className="mt-1 text-sm text-[#5F6F7A]">
          把多个视频链接一起扔进来，AI 会按你的学习意图跨视频检索，凝练出一份 SKILL.md。
        </p>
      </header>

      <BatchUrlList urls={urls} onChange={setUrls} disabled={phase === "extracting" || phase === "generating"} />

      {phase === "idle" || phase === "extracting" ? (
        <button
          type="button"
          onClick={runExtract}
          disabled={phase === "extracting"}
          className="self-start rounded-full bg-[#2C2C2C] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(44,44,44,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "extracting" ? "抓取中..." : "抓取所有视频"}
        </button>
      ) : null}

      {items.length > 0 ? <BatchExtractionProgress items={items} /> : null}
      {successVideos.length > 0 ? <BatchVideoPreview items={items} /> : null}

      {phase === "ready" || phase === "generating" || phase === "done" ? (
        <>
          <IntentField value={intent} onChange={setIntent} disabled={phase === "generating"} />
          <CategoryPicker value={category} onChange={setCategory} disabled={phase === "generating"} />
          <SkillConfig
            skillName={skillName}
            onChangeSkillName={setSkillName}
            description=""
            onChangeDescription={() => {}}
            disabled={phase === "generating"}
          />
          <button
            type="button"
            onClick={runGenerate}
            disabled={phase === "generating" || !category}
            className="self-start rounded-full bg-[#2C2C2C] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(44,44,44,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === "generating" ? "生成中..." : "生成 Skill"}
          </button>
        </>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-[#FFF1F1] px-4 py-3 text-sm text-[#B65252]">{error}</div>
      ) : null}

      {phase === "done" && skillMarkdown ? (
        <GeneratedSkillModal
          skillName={skillName}
          skillMarkdown={skillMarkdown}
          onClose={() => setPhase("ready")}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: Verify imports match existing components**

Check that `CategoryPicker`, `SkillConfig`, `GeneratedSkillModal` props in the existing `src/components/create/` files match the usage above. If signatures differ (likely some, since those components were written for single-video), adjust:

Run: `cd src && grep -n "^interface\|^export default function" components/create/CategoryPicker.tsx components/create/SkillConfig.tsx components/create/GeneratedSkillModal.tsx`

Update the page to match real prop names. For `SkillConfig`: if it only accepts `skillName` + `onChangeSkillName`, remove the description props.

- [ ] **Step 4: Typecheck + build**

Run: `cd src && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/batch/page.tsx
git commit -m "feat(ui): add /batch page with extract → generate flow"
```

---

## Task 19: Landing Page CTA

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read current landing**

Run: `cd src && cat app/page.tsx`

- [ ] **Step 2: Add /batch CTA button**

Find the existing single CTA (likely an `<a href="/create">` or `<Link href="/create">`) and add a second CTA pointing to `/batch` next to it:

```tsx
<div className="flex flex-col gap-3 md:flex-row">
  <Link
    href="/create"
    className="rounded-full bg-[#2C2C2C] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(44,44,44,0.2)] transition hover:-translate-y-0.5"
  >
    单视频 → Skill
  </Link>
  <Link
    href="/batch"
    className="rounded-full border-2 border-[#2C2C2C] bg-white px-6 py-3 text-sm font-semibold text-[#2C2C2C] transition hover:-translate-y-0.5"
  >
    批量生成 Skill
  </Link>
</div>
```

Match the exact structure of the existing file — if the current CTA uses `<a>` keep that; if it uses `<Link>` keep that.

- [ ] **Step 3: Typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): add /batch CTA on landing page"
```

---

## Task 20: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add batch section after the existing Phase C section**

In `README.md`, locate the "## 规划中：Phase C" section (line ~136). Add a new section **before** it:

```markdown
## 批量生成（跨视频 RAG）

`/batch` 路径支持一次扔 1–10 个视频链接，按你的学习意图跨视频检索最相关的片段，凝练成**一份** SKILL.md。

**何时用它**：
- 同一主题看了多个视频（例 5 个讲 Transformer 的），想合成一个 Skill
- 某个视频讲得不够，加几个补充视频一起喂

**流程**：
1. `/batch` → 粘贴多个 URL（同一页可混 YouTube / Bilibili）
2. 点"抓取所有视频" → 串行抓取，失败不阻塞其他
3. 填学习意图（可选但强推）→ 选分类 → 给 Skill 起名
4. 点"生成 Skill" → 跨视频 BM25 检索 top-8 片段 → 喂 LLM → SKILL.md
5. 下载并安装到 `~/.claude/skills/`

**技术细节**：全自建 RAG 管线（`src/lib/retrieval/`），不依赖 LangChain / embedding / 向量库。BM25-lite + LLM 同义词扩展 + Jaccard 去重。
```

And update the "Phase C" status table row:

Change:
```
| 🟡 **Phase C**：用户意图 + 切片 + 关键词 RAG（见下文） | **规划完成，待实施** |
```

To:
```
| ✅ **Phase C**：用户意图 + 切片 + 关键词 RAG | 已实施（与批量共享 retrieval/ 模块） |
| ✅ **批量导入**：多视频 → 跨视频 RAG → 单 Skill | 已实施 |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): document batch workflow + mark Phase C implemented"
```

---

## Task 21: Final Build + Full Test Suite

- [ ] **Step 1: Run full typecheck**

Run: `cd src && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run full test suite**

Run: `cd src && npm test`
Expected: all tests PASS.

- [ ] **Step 3: Run coverage and verify retrieval > 80%**

Run: `cd src && npm run test:coverage`
Expected: `lib/retrieval/` statement coverage ≥ 80%.

- [ ] **Step 4: Run production build**

Run: `cd src && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual smoke (document in PR, do not commit artifacts)**

Start dev server: `cd src && npm run dev`
Manually test:
- `/` has two CTAs
- `/create` (single video) still works (no regression)
- `/batch` extract 2 URLs → see progress → generate → download SKILL.md

Report any UI bugs found as new tasks.

- [ ] **Step 6: Push branch**

```bash
git push -u origin feature/batch-import-rag
```

---

## Self-Review Checklist

- Spec coverage: every section in `2026-04-22-batch-import-rag-design.md` maps to a task. ✓
- Placeholders: searched for "TBD/TODO/..." — none left. ✓
- Type consistency: `RetrievalContext`, `ScoredChunk`, `Chunk`, `BatchItem` names consistent across tasks. ✓
- `generateSkillWithAI` signature: extended with `retrievalContext?: RetrievalContext` + `intent?: string` (Task 11) — used consistently in Tasks 12, 14. ✓

## Review Gate (After Task 21)

Per spec, run 3 rounds:
1. `/ccg:spec-review` — codex + gemini cross-review; fix all Critical.
2. `pr-review-toolkit:code-reviewer` agent — fix all High.
3. `pr-review-toolkit:pr-test-analyzer` + `silent-failure-hunter` — fix test gaps + silent failures.

After each round, re-run that round's reviewer to verify fixes stuck. Proceed to next round only when current round's severity threshold is met. If round 3 still reports Critical, run round 4.
