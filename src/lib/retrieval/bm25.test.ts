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
    // 20 distinct chunks that all match "attention" but differ enough to dodge dedup
    const chunks = Array.from({ length: 20 }, (_, i) =>
      chunk(`c${i}`, `attention word${i} uniq${i} alpha${i} beta${i} gamma${i}`)
    );
    const res = scoreAndSelect(chunks, ["attention"], 5, 0.7);
    expect(res).toHaveLength(5);
  });

  it("dedups near-duplicate chunks by jaccard threshold", () => {
    const chunks = [
      chunk("a", "attention mechanism explains transformer models"),
      chunk("b", "attention mechanism explains transformer models"),
      chunk("c", "completely different words nothing overlap"),
    ];
    const res = scoreAndSelect(chunks, ["attention", "transformer"], 10, 0.7);
    const ids = res.map((r) => r.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
  });

  it("gives empty result when no keywords match", () => {
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
    expect(res[0].startRatio).toBe(0);
    expect(res[0].endRatio).toBe(1);
  });

  it("boosts keywords that appear in first 100 chars", () => {
    const headHit = chunk("head", "attention at the top " + "padding ".repeat(20));
    const tailHit = chunk("tail", "padding ".repeat(20) + "attention at the end");
    const res = scoreAndSelect([headHit, tailHit], ["attention"], 2, 0.7);
    expect(res[0].id).toBe("head");
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });
});
