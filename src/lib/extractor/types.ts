export type ExtractPlatform = "bilibili" | "youtube" | "unknown";

export type SubtitleFormat = "srt" | "vtt" | "json";

export interface ExtractOptions {
  subtitleLangs?: string[];
  allowAutoSubs?: boolean;
  timeoutMs?: number;
  cookies?: string;
}

export interface ExtractSubtitleMeta {
  lang: string;
  source: "manual" | "auto";
  format: SubtitleFormat;
  isAuto: boolean;
}

export interface ExtractResult {
  title: string;
  author?: string;
  description?: string;
  duration?: number;
  tags?: string[];
  url: string;
  platform: ExtractPlatform;
  transcript: string;
  thumbnailUrl?: string;
  subtitleMeta: ExtractSubtitleMeta;
  raw?: unknown;
}

export interface VideoExtractor {
  canHandle(url: string): boolean;
  extract(url: string, options?: ExtractOptions): Promise<ExtractResult>;
}
