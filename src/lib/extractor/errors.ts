export type ExtractErrorCode =
  | "UNSUPPORTED_PLATFORM"
  | "INVALID_URL"
  | "NO_SUBTITLE"
  | "AUTH_REQUIRED"
  | "EXTRACTOR_FAILED"
  | "TIMEOUT";

const EXTRACT_ERROR_MESSAGES: Record<ExtractErrorCode, string> = {
  UNSUPPORTED_PLATFORM: "当前只支持 Bilibili 和 YouTube 视频链接。",
  INVALID_URL: "请输入正确的视频链接。",
  NO_SUBTITLE: "该视频没有可用字幕（人工字幕和自动字幕都未获取到）。",
  AUTH_REQUIRED: "该视频需要登录后才能抓取，请先配置对应平台的 cookies（BILIBILI_COOKIES / YOUTUBE_COOKIES）。",
  EXTRACTOR_FAILED: "视频信息抓取失败，请稍后再试。",
  TIMEOUT: "抓取超时，请稍后重试。",
};

const EXTRACT_ERROR_STATUS: Record<ExtractErrorCode, number> = {
  UNSUPPORTED_PLATFORM: 400,
  INVALID_URL: 400,
  NO_SUBTITLE: 422,
  AUTH_REQUIRED: 401,
  EXTRACTOR_FAILED: 502,
  TIMEOUT: 504,
};

export class ExtractError extends Error {
  readonly code: ExtractErrorCode;

  constructor(
    code: ExtractErrorCode,
    message: string = EXTRACT_ERROR_MESSAGES[code],
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "ExtractError";
    this.code = code;

    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function getExtractErrorMessage(code: ExtractErrorCode): string {
  return EXTRACT_ERROR_MESSAGES[code];
}

export function getExtractErrorStatus(code: ExtractErrorCode): number {
  return EXTRACT_ERROR_STATUS[code];
}

export function isExtractError(error: unknown): error is ExtractError {
  return error instanceof ExtractError;
}

export function toExtractError(error: unknown): ExtractError {
  if (error instanceof ExtractError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // youtube-dl-exec 把 tinyspawn 的细节挂在 error 上：
    //   - error.signal === "SIGKILL" / error.killed === true → 我们设的 timeout 触发
    //   - error.signal === "SIGTERM" 同理
    const errLike = error as Error & {
      signal?: string;
      killed?: boolean;
      name?: string;
    };
    const wasKilled =
      errLike.killed === true ||
      errLike.signal === "SIGKILL" ||
      errLike.signal === "SIGTERM";

    if (
      wasKilled ||
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      message.includes("timed out") ||
      message.includes("timeout") ||
      message.includes("sigkill")
    ) {
      return new ExtractError("TIMEOUT", undefined, { cause: error });
    }

    if (
      message.includes("sign in") ||
      message.includes("login") ||
      message.includes("cookie") ||
      message.includes("sessdata") ||
      message.includes("会员") ||
      message.includes("付费") ||
      message.includes("权限")
    ) {
      return new ExtractError("AUTH_REQUIRED", undefined, { cause: error });
    }

    if (
      message.includes("unsupported url") ||
      message.includes("invalid url") ||
      message.includes("not a valid url")
    ) {
      return new ExtractError("INVALID_URL", undefined, { cause: error });
    }

    return new ExtractError("EXTRACTOR_FAILED", undefined, { cause: error });
  }

  return new ExtractError("EXTRACTOR_FAILED");
}
