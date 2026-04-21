import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/batch/runner", () => ({
  runBatchExtract: vi.fn(async (urls: string[]) => ({
    items: urls.map((url) => ({
      url,
      status: "done" as const,
      result: {
        title: "T",
        transcript: "t",
        tags: [],
        url,
        platform: "youtube",
        subtitleMeta: { lang: "en", source: "auto", format: "srt", isAuto: true },
      },
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
    const res = await POST(makeReq({ urls: Array(11).fill("https://x.com") }));
    expect(res.status).toBe(422);
  });

  it("rejects non-url strings", async () => {
    const res = await POST(makeReq({ urls: ["not-a-url"] }));
    expect(res.status).toBe(422);
  });

  it("400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/videos/batch-extract", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
