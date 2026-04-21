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
  const docFreq = new Map<string, number>();
  for (const t of docTokens) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  const headTokens = new Set(tokenize(chunk.text.slice(0, 100)));

  const matched: string[] = [];
  let score = 0;
  for (const qt of queryTokens) {
    const hits = docFreq.get(qt);
    if (!hits) continue;
    matched.push(qt);
    score += hits;
    if (headTokens.has(qt)) score += 2;
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
