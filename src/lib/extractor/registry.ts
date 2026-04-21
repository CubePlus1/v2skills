import { BilibiliExtractor } from "@/lib/extractor/bilibili";
import { YouTubeExtractor } from "@/lib/extractor/youtube";
import { ExtractError } from "@/lib/extractor/errors";
import type {
  ExtractOptions,
  ExtractResult,
  VideoExtractor,
} from "@/lib/extractor/types";

const extractors: VideoExtractor[] = [
  new BilibiliExtractor(),
  new YouTubeExtractor(),
];

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ExtractError("INVALID_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ExtractError("INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ExtractError("INVALID_URL");
  }

  return parsed.toString();
}

export function resolveExtractor(url: string): VideoExtractor | null {
  const normalizedUrl = normalizeUrl(url);
  return extractors.find((extractor) => extractor.canHandle(normalizedUrl)) ?? null;
}

export async function extractFromUrl(
  url: string,
  options?: ExtractOptions
): Promise<ExtractResult> {
  const normalizedUrl = normalizeUrl(url);
  const extractor = extractors.find((item) => item.canHandle(normalizedUrl));

  if (!extractor) {
    throw new ExtractError("UNSUPPORTED_PLATFORM");
  }

  return extractor.extract(normalizedUrl, options);
}
