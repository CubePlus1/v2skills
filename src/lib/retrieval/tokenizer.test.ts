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
