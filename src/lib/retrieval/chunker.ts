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
  if (out.length === 0) return [para.slice(0, maxChars)];
  // Further hard-cut any remaining oversize piece (e.g. no sentence boundaries at all)
  const safe: string[] = [];
  for (const piece of out) {
    if (piece.length <= maxChars) {
      safe.push(piece);
    } else {
      for (let i = 0; i < piece.length; i += maxChars) {
        safe.push(piece.slice(i, i + maxChars));
      }
    }
  }
  return safe;
}

export function chunkTranscript(
  transcript: string,
  sourceId: string,
  config: RetrievalConfig
): Chunk[] {
  if (!transcript) return [];
  const total = transcript.length;
  const paragraphs = transcript
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];

  // Flatten to pieces that each respect maxChars
  const pieces: string[] = [];
  for (const p of paragraphs) {
    pieces.push(...splitLongParagraph(p, config.chunkMaxChars));
  }

  // Greedy group pieces up to maxChars
  const groups: string[] = [];
  let buf = "";
  for (const piece of pieces) {
    const withSep = buf.length > 0 ? buf + "\n" + piece : piece;
    if (withSep.length > config.chunkMaxChars && buf.length > 0) {
      groups.push(buf);
      buf = piece;
    } else {
      buf = withSep;
    }
  }
  if (buf.length > 0) groups.push(buf);

  // Merge adjacent short groups when possible
  const merged: string[] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.length < config.chunkMinChars &&
      prev.length + g.length + 1 <= config.chunkMaxChars
    ) {
      merged[merged.length - 1] = prev + "\n" + g;
    } else {
      merged.push(g);
    }
  }

  // Emit chunks with ratio metadata (proportional spacing)
  const count = merged.length;
  return merged.map((text, i) => ({
    id: `${sourceId}:c${i}`,
    sourceId,
    index: i,
    text,
    startRatio: count === 1 ? 0 : i / count,
    endRatio: count === 1 ? 1 : (i + 1) / count,
  }));
}
