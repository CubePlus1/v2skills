import { ExtractError, toExtractError } from "@/lib/extractor/errors";
import { runExtract } from "@/lib/extractor/_runner";
import type {
  ExtractOptions,
  ExtractResult,
  VideoExtractor,
} from "@/lib/extractor/types";

const DEFAULT_LANGS = ["zh-Hans", "zh-CN", "en"];

function isBilibiliHost(hostname: string): boolean {
  return (
    hostname === "www.bilibili.com" ||
    hostname === "bilibili.com" ||
    hostname === "m.bilibili.com" ||
    hostname === "b23.tv"
  );
}

function getPartIndex(url: string): number | undefined {
  const parsed = new URL(url);
  const value = parsed.searchParams.get("p");
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function mapBilibiliError(error: unknown): ExtractError {
  const err = toExtractError(error);
  if (err.code !== "EXTRACTOR_FAILED") return err;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("members-only") ||
      msg.includes("login required") ||
      msg.includes("need login")
    ) {
      return new ExtractError("AUTH_REQUIRED", undefined, { cause: error });
    }
  }
  return err;
}

export class BilibiliExtractor implements VideoExtractor {
  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!isBilibiliHost(parsed.hostname)) return false;
      return parsed.hostname === "b23.tv" || parsed.pathname.startsWith("/video/");
    } catch {
      return false;
    }
  }

  async extract(
    url: string,
    options: ExtractOptions = {}
  ): Promise<ExtractResult> {
    // 多 P 视频：URL 没指定 ?p=N 时默认抓 P1。
    // 不限制的话 yt-dlp 会枚举所有 P（百集合订视频会让进程卡死，且每 P 失败累积错误）。
    const partIndex = getPartIndex(url) ?? 1;
    try {
      return await runExtract(url, options, {
        platform: "bilibili",
        defaultSubtitleLangs: DEFAULT_LANGS,
        defaultCookiesEnv: "BILIBILI_COOKIES",
        cookieDomain: ".bilibili.com",
        playlistItems: String(partIndex),
        entryIndex: partIndex,
      });
    } catch (error) {
      throw mapBilibiliError(error);
    }
  }
}
