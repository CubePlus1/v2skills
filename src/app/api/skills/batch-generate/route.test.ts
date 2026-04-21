import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/retrieval", () => ({
  retrieveForSkill: vi.fn(async () => ({
    strategy: "retrieved" as const,
    chunks: [
      {
        id: "v1:c0",
        sourceId: "v1",
        index: 0,
        text: "some content",
        startRatio: 0,
        endRatio: 1,
        score: 2,
        matchedTokens: ["attention"],
      },
    ],
    keywords: ["attention"],
    notes: [],
  })),
}));
vi.mock("@/lib/skillTemplate", () => ({
  generateSkillWithAI: vi.fn(async () => ({
    name: "test-skill",
    displayName: "Test Skill",
    description: "desc",
    trigger: "trigger",
    instructions: "- do x",
    examples: [{ userInput: "i", assistantOutput: "o" }],
    constraints: ["c"],
    capabilities: ["cap"],
    useCases: ["use"],
    category: "tech",
    sourceVideoIds: ["v1"],
    createdAt: new Date().toISOString(),
  })),
  generateSkillMarkdown: vi.fn(() => "# Skill\n..."),
  validateSkillName: vi.fn(() => ({ valid: true })),
}));
vi.mock("@/lib/ai-client", () => ({
  hasAIKey: () => true,
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
    {
      id: "v1",
      title: "T1",
      transcript: "content",
      tags: [],
      url: "https://a.com",
    },
  ],
  intent: "attention",
  category: "tech",
  skillName: "attention-skill",
};

describe("POST /api/skills/batch-generate", () => {
  it("returns skillContent + strategy for valid input", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.skillContent).toContain("Skill");
    expect(json.strategy).toBe("retrieved");
    expect(json.sources).toHaveLength(1);
  });

  it("422 on invalid input", async () => {
    const res = await POST(makeReq({ videos: [] }));
    expect(res.status).toBe(422);
  });

  it("400 on invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/skills/batch-generate", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
