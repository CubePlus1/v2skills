import { describe, it, expect, vi } from "vitest";

const mockExtract = vi.fn();
vi.mock("@/lib/extractor/registry", () => ({
  extractFromUrl: (url: string) => mockExtract(url),
}));

import { runBatchExtract } from "./runner";

const ok = (url: string) => ({
  title: `T-${url}`,
  author: "",
  description: "",
  transcript: "x",
  tags: [],
  duration: 0,
  platform: "youtube" as const,
  url,
  thumbnailUrl: "",
  subtitleMeta: { lang: "en", source: "auto" as const, format: "srt" as const, isAuto: true },
});

describe("runBatchExtract", () => {
  it("processes urls serially and returns per-url results", async () => {
    mockExtract.mockImplementation(async (url: string) => ok(url));
    const res = await runBatchExtract(["https://a.com", "https://b.com"]);
    expect(res.successCount).toBe(2);
    expect(res.failureCount).toBe(0);
    expect(res.items.map((i) => i.url)).toEqual(["https://a.com", "https://b.com"]);
    expect(res.items.every((i) => i.status === "done")).toBe(true);
  });

  it("isolates failures (one fails, others continue)", async () => {
    mockExtract.mockImplementationOnce(async () => {
      throw Object.assign(new Error("boom"), { code: "EXTRACTOR_FAILED" });
    });
    mockExtract.mockImplementationOnce(async (url: string) => ok(url));
    const res = await runBatchExtract(["https://bad", "https://good"]);
    expect(res.successCount).toBe(1);
    expect(res.failureCount).toBe(1);
    expect(res.items[0].status).toBe("failed");
    expect(res.items[0].error?.code).toBe("EXTRACTOR_FAILED");
    expect(res.items[1].status).toBe("done");
  });

  it("invokes onProgress for each status transition", async () => {
    mockExtract.mockImplementation(async (url: string) => ok(url));
    const seen: Array<[string, string]> = [];
    await runBatchExtract(["a", "b"], (item) => seen.push([item.url, item.status]));
    expect(seen).toContainEqual(["a", "extracting"]);
    expect(seen).toContainEqual(["a", "done"]);
    expect(seen).toContainEqual(["b", "extracting"]);
    expect(seen).toContainEqual(["b", "done"]);
  });

  it("handles extractor throwing plain error (no code field)", async () => {
    mockExtract.mockRejectedValue(new Error("network"));
    const res = await runBatchExtract(["https://x"]);
    expect(res.items[0].status).toBe("failed");
    expect(res.items[0].error?.code).toBe("EXTRACTOR_FAILED");
    expect(res.items[0].error?.message).toBe("network");
  });
});
