type BilibiliSubtitleBody = {
  body?: Array<{
    from?: number;
    to?: number;
    content?: unknown;
  }>;
};

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeHtmlEntities(input: string): string {
  return Object.entries(HTML_ENTITY_MAP).reduce(
    (text, [entity, replacement]) => text.split(entity).join(replacement),
    input
  );
}

function cleanSubtitleLine(line: string): string {
  return decodeHtmlEntities(line)
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\\[^}]+\}/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function collectCueLines(raw: string): string[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const lines: string[] = [];

  for (const block of blocks) {
    const blockLines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (blockLines.length === 0) {
      continue;
    }

    const firstLine = blockLines[0].toUpperCase();
    if (
      firstLine === "WEBVTT" ||
      firstLine.startsWith("NOTE") ||
      firstLine.startsWith("STYLE") ||
      firstLine.startsWith("REGION")
    ) {
      continue;
    }

    const timestampIndex = blockLines.findIndex((line) => line.includes("-->"));
    if (timestampIndex === -1) {
      continue;
    }

    const cueLines = blockLines.slice(timestampIndex + 1);
    for (const cueLine of cueLines) {
      const cleaned = cleanSubtitleLine(cueLine);
      if (cleaned) {
        lines.push(cleaned);
      }
    }
  }

  return lines;
}

function finalizeSubtitle(lines: string[]): string {
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseSRT(raw: string): string {
  return finalizeSubtitle(collectCueLines(raw));
}

export function parseVTT(raw: string): string {
  return finalizeSubtitle(collectCueLines(raw));
}

export function parseBilibiliJSON(raw: string): string {
  const parsed = JSON.parse(raw) as BilibiliSubtitleBody;
  const lines = Array.isArray(parsed.body)
    ? parsed.body
        .map((item) =>
          typeof item.content === "string" ? cleanSubtitleLine(item.content) : ""
        )
        .filter(Boolean)
    : [];

  return finalizeSubtitle(lines);
}

export function parseSubtitle(raw: string, ext: string): string {
  const normalizedExt = ext.trim().toLowerCase();

  if (normalizedExt === "srt") {
    return parseSRT(raw);
  }

  if (normalizedExt === "vtt" || normalizedExt === "webvtt") {
    return parseVTT(raw);
  }

  if (normalizedExt === "json" || normalizedExt.startsWith("json")) {
    return parseBilibiliJSON(raw);
  }

  return finalizeSubtitle(
    raw
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => cleanSubtitleLine(line))
      .filter(Boolean)
  );
}
