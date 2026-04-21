import { ExtractError, toExtractError } from "@/lib/extractor/errors";
import { runExtract } from "@/lib/extractor/_runner";
import type {
  ExtractOptions,
  ExtractResult,
  VideoExtractor,
} from "@/lib/extractor/types";

// 英文优先，然后中文——YouTube 视频英文字幕覆盖率远高于中文
const DEFAULT_LANGS = ["en", "en-US", "en-GB", "zh-Hans", "zh-CN", "zh"];

const YT_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
]);

function isYouTubeHost(hostname: string): boolean {
  return YT_HOSTS.has(hostname);
}

function mapYouTubeError(error: unknown): ExtractError {
  const err = toExtractError(error);
  if (err.code !== "EXTRACTOR_FAILED") return err;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("private video") ||
      msg.includes("sign in to confirm") ||
      msg.includes("members-only") ||
      msg.includes("age-restricted") ||
      msg.includes("login required")
    ) {
      return new ExtractError("AUTH_REQUIRED", undefined, { cause: error });
    }
  }
  return err;
}

export class YouTubeExtractor implements VideoExtractor {
  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!isYouTubeHost(parsed.hostname)) return false;

      // 支持 /watch、/shorts/<id>、youtu.be/<id>、/embed/<id>
      if (parsed.hostname === "youtu.be") return parsed.pathname.length > 1;
      return (
        parsed.pathname === "/watch" ||
        parsed.pathname.startsWith("/shorts/") ||
        parsed.pathname.startsWith("/embed/") ||
        parsed.pathname.startsWith("/live/")
      );
    } catch {
      return false;
    }
  }

  async extract(
    url: string,
    options: ExtractOptions = {}
  ): Promise<ExtractResult> {
    try {
      return await runExtract(url, options, {
        platform: "youtube",
        defaultSubtitleLangs: DEFAULT_LANGS,
        defaultCookiesEnv: "YOUTUBE_COOKIES",
        cookieDomain: ".youtube.com",
        proxyEnv: "YOUTUBE_PROXY",
      });
    } catch (error) {
      throw mapYouTubeError(error);
    }
  }
}
