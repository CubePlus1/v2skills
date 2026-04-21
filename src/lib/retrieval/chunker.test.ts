import { describe, it, expect } from "vitest";
import { chunkTranscript } from "./chunker";
import { DEFAULT_RETRIEVAL_CONFIG } from "./types";

describe("chunkTranscript", () => {
  it("returns single chunk when transcript under max", () => {
    const chunks = chunkTranscript("short text", "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceId).toBe("v1");
    expect(chunks[0].id).toBe("v1:c0");
    expect(chunks[0].text).toBe("short text");
    expect(chunks[0].startRatio).toBe(0);
    expect(chunks[0].endRatio).toBe(1);
  });

  it("splits paragraphs by blank lines, each chunk <= maxChars", () => {
    const para1 = "a".repeat(400);
    const para2 = "b".repeat(400);
    const para3 = "c".repeat(400);
    const transcript = [para1, para2, para3].join("\n\n");
    const chunks = chunkTranscript(transcript, "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1000);
  });

  it("breaks long paragraphs on sentence punctuation", () => {
    const sentence = "一句很长的话。".repeat(200); // ~1400 chars, no blank-line separators
    const chunks = chunkTranscript(sentence, "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1000);
  });

  it("assigns monotonically non-decreasing ratios starting at 0 and ending at 1", () => {
    const transcript = Array.from({ length: 6 }, () => "x".repeat(500)).join("\n\n");
    const chunks = chunkTranscript(transcript, "v1", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startRatio).toBeGreaterThanOrEqual(chunks[i - 1].startRatio);
    }
    expect(chunks[0].startRatio).toBe(0);
    expect(chunks[chunks.length - 1].endRatio).toBe(1);
  });

  it("uses sourceId in chunk.id and index", () => {
    const chunks = chunkTranscript("hello", "v2", DEFAULT_RETRIEVAL_CONFIG);
    expect(chunks[0].id).toBe("v2:c0");
    expect(chunks[0].sourceId).toBe("v2");
    expect(chunks[0].index).toBe(0);
  });

  it("handles empty input", () => {
    expect(chunkTranscript("", "v1", DEFAULT_RETRIEVAL_CONFIG)).toEqual([]);
  });

  it("uses sequential chunk ids after merge", () => {
    const transcript = Array.from({ length: 4 }, () => "x".repeat(400)).join("\n\n");
    const chunks = chunkTranscript(transcript, "v1", DEFAULT_RETRIEVAL_CONFIG);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].id).toBe(`v1:c${i}`);
      expect(chunks[i].index).toBe(i);
    }
  });
});
