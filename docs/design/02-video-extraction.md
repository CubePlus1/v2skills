# Phase B · 视频抽取子系统（Bilibili + yt-dlp）

> 版本：1.0 · 2026-04-20 · 状态：待实现（依赖 Phase A 完成）

## 目标

让用户在 `/create` 页面粘贴一个 **Bilibili 视频 URL**，系统自动抓取：
- 视频元数据（标题、作者、简介、时长、标签）
- 字幕文本（优先人工 CC，兜底 AI 生成字幕，**排除弹幕**）

然后把这些字段**自动填入 Phase A 的表单**，用户可编辑后继续走"生成 Skill"流程。

未来扩展到 YouTube / 抖音 / 小红书时，**新平台只需实现一个 `VideoExtractor` 类**，前端与生成管线零改动。

## 选型决策

### 为什么用 yt-dlp

调研了三类方案：

| 方案 | 覆盖 | 维护 | 复杂度 | 结论 |
|---|---|---|---|---|
| `yt-dlp` via Node 子进程 | 1000+ 站点 | ★★★★★（2026.3.13 活跃）| 中（Python 依赖 + WBI 自动处理）| **选用** |
| 纯 TS Bilibili 库（`bili-api` / `bilibili-subtitles`）| 仅 Bilibili | ★★（WBI 轮换易挂）| 低 | 作为可选优化路径 |
| 自行用 fetch 调 Bilibili API | 仅 Bilibili | — | 高（要自己实现 WBI 签名 + 维护）| 不考虑 |

**决策**：主路径用 yt-dlp；抽象 `VideoExtractor` 接口方便将来把 Bilibili 换成纯 TS 实现做速度优化。

### Node 包装选型

**`youtube-dl-exec`**（[microlinkhq](https://github.com/microlinkhq/youtube-dl-exec)）
- 理由：`npm install` 自动拉取 yt-dlp 二进制，Promise + Stream API，零启动配置
- 备选 `yt-dlp-wrap`：TS 原生 + EventEmitter 进度，但要手动装 yt-dlp

### 已知 Bilibili 坑（设计必须处理）

1. **弹幕被当成字幕**：yt-dlp 默认 `--write-subs` 会把弹幕（`danmaku` 轨）也写出来 → 必须 `--sub-langs "zh-Hans,zh-CN,en,-danmaku"` 排除
2. **部分视频需登录**：Bilibili 对会员/付费内容要 `SESSDATA` cookie → 支持可选 `BILIBILI_COOKIES` 环境变量
3. **WBI 签名**：Bilibili 2023.3 起加的 API 签名，**yt-dlp 内部自动处理**，我们不用管
4. **多 P（分集）视频**：`BVxxx` 可能包含多个 `?p=N`，每 P 有独立 `cid` 和字幕 → 默认抽取 `p=1`，URL 含 `?p=N` 则取指定集
5. **字幕格式**：下载得到的是 SRT/VTT → 需解析成纯文本（剥时间戳）供 LLM 消费

## 架构

### 模块结构

```
src/lib/extractor/
├── types.ts              # VideoExtractor 接口 + ExtractResult 类型
├── registry.ts           # URL → Extractor 路由
├── bilibili.ts           # BilibiliExtractor（基于 yt-dlp）
├── subtitle.ts           # SRT/VTT → 纯文本解析
└── index.ts              # 公开 API：extractFromUrl(url)
```

### 核心接口

```ts
// types.ts

export interface ExtractOptions {
  /** 优先字幕语言 */
  subtitleLangs?: string[];        // 默认 ["zh-Hans", "zh-CN", "en"]
  /** 允许 AI 自动生成的字幕（fallback） */
  allowAutoSubs?: boolean;          // 默认 true
  /** 登录凭证（cookie 字符串或浏览器名） */
  cookies?: string;
}

export interface ExtractResult {
  title: string;
  author?: string;
  description?: string;
  duration?: number;                // 秒
  tags?: string[];
  url: string;                      // 规范化后的 URL
  platform: "bilibili" | "youtube" | "unknown";
  /** 字幕纯文本（已剥时间戳） */
  transcript: string;
  /** 字幕元数据 */
  subtitleMeta: {
    lang: string;
    source: "manual" | "auto";      // 人工 CC vs AI 生成
    format: "srt" | "vtt" | "json";
  } | null;
  /** yt-dlp 原始 JSON（调试用，可选返回） */
  raw?: unknown;
}

export interface VideoExtractor {
  /** 能否处理这个 URL */
  canHandle(url: string): boolean;
  /** 执行抽取 */
  extract(url: string, options?: ExtractOptions): Promise<ExtractResult>;
}
```

### URL 识别与路由

```ts
// registry.ts

const extractors: VideoExtractor[] = [
  new BilibiliExtractor(),
  // 后续 new YouTubeExtractor(), new DouyinExtractor()...
];

export function resolveExtractor(url: string): VideoExtractor | null {
  return extractors.find(e => e.canHandle(url)) ?? null;
}

export async function extractFromUrl(
  url: string,
  options?: ExtractOptions
): Promise<ExtractResult> {
  const extractor = resolveExtractor(url);
  if (!extractor) throw new ExtractError("UNSUPPORTED_PLATFORM", url);
  return extractor.extract(url, options);
}
```

### BilibiliExtractor 实现要点

```ts
// bilibili.ts
import youtubedl from "youtube-dl-exec";

const BILI_URL_RE = /^https?:\/\/(www\.)?bilibili\.com\/video\/(BV[\w]+|av\d+)/i;

export class BilibiliExtractor implements VideoExtractor {
  canHandle(url: string) {
    return BILI_URL_RE.test(url);
  }

  async extract(url: string, opts: ExtractOptions = {}): Promise<ExtractResult> {
    const langs = (opts.subtitleLangs ?? ["zh-Hans", "zh-CN", "en"]).concat("-danmaku");

    // 1) 拉元数据 + 字幕列表（不下视频本体）
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      skipDownload: true,
      writeSubs: true,
      writeAutoSubs: opts.allowAutoSubs ?? true,
      subLangs: langs.join(","),
      subFormat: "srt/vtt/best",
      cookies: opts.cookies,            // 或 --cookies-from-browser chrome
      noWarnings: true,
    });

    // 2) 从 info 里挑字幕：优先 manual，fallback auto
    const subtitle = pickBestSubtitle(info, opts.subtitleLangs ?? ["zh-Hans","zh-CN","en"]);
    if (!subtitle) {
      throw new ExtractError("NO_SUBTITLE", url);
    }

    // 3) 下载该字幕文件到内存（不落盘）
    const raw = await fetch(subtitle.url).then(r => r.text());

    // 4) 解析 SRT/VTT → 纯文本
    const transcript = parseSubtitle(raw, subtitle.ext);

    return {
      title: info.title,
      author: info.uploader,
      description: info.description,
      duration: info.duration,
      tags: info.tags ?? [],
      url: info.webpage_url ?? url,
      platform: "bilibili",
      transcript,
      subtitleMeta: {
        lang: subtitle.lang,
        source: subtitle.isAuto ? "auto" : "manual",
        format: subtitle.ext as "srt" | "vtt" | "json",
      },
      raw: process.env.NODE_ENV === "development" ? info : undefined,
    };
  }
}
```

### 字幕解析

```ts
// subtitle.ts

/** 剥掉时间戳、行号、格式标记，合并成连续纯文本 */
export function parseSubtitle(raw: string, ext: string): string {
  switch (ext) {
    case "srt": return parseSRT(raw);
    case "vtt": return parseVTT(raw);
    case "json": return parseBilibiliJSON(raw);    // Bilibili 原生字幕 JSON 格式
    default:    return raw;
  }
}
```

Bilibili CC 字幕是 JSON 格式（非 SRT），结构大致：
```json
{"body":[{"from":0.5,"to":2.1,"content":"大家好"},{"from":2.1,"to":3.9,"content":"欢迎收看"}]}
```
parseBilibiliJSON 把 `body[].content` 依次拼接即可。

## API 设计

### `POST /api/videos/extract`（**新增**）

文件：`src/app/api/videos/extract/route.ts`

**请求**：
```json
{
  "url": "https://www.bilibili.com/video/BV1xx411c7mu",
  "options": {
    "subtitleLangs": ["zh-Hans", "en"],
    "allowAutoSubs": true
  }
}
```

**响应**（成功）：
```json
{
  "success": true,
  "video": {
    "title": "年度好用 AI 大分享",
    "author": "秋芝2046",
    "description": "...",
    "transcript": "大家好，欢迎收看...",
    "tags": ["AI", "工具", "推荐"],
    "url": "https://www.bilibili.com/video/BV1xx",
    "duration": 847
  },
  "meta": {
    "platform": "bilibili",
    "subtitleSource": "manual",
    "subtitleLang": "zh-Hans"
  }
}
```

**响应**（失败）：
```json
{
  "success": false,
  "error": "NO_SUBTITLE",
  "message": "该视频没有可用字幕（人工或 AI 生成的都没有）。请提供带字幕的视频。"
}
```

**错误码**：

| code | 含义 | HTTP |
|---|---|---|
| `UNSUPPORTED_PLATFORM` | URL 不匹配任何已注册的 extractor | 400 |
| `INVALID_URL` | URL 格式错误 | 400 |
| `NO_SUBTITLE` | 视频无任何字幕可用 | 422 |
| `AUTH_REQUIRED` | 需要登录（付费/会员内容） | 401 |
| `EXTRACTOR_FAILED` | yt-dlp 执行失败（网络/binary/其他） | 502 |
| `TIMEOUT` | 执行超时（默认 30s） | 504 |

**运行时**：`export const runtime = "nodejs"`（必须，子进程依赖）

## 前端对接

### `/create` 页面新增 URL 模式

在 Phase A 已有的 `ModeSwitch` 组件里把 URL 模式**解锁**：

```tsx
// src/components/create/UrlExtractor.tsx （新增）
<div>
  <input placeholder="https://www.bilibili.com/video/BVxxx" />
  <button onClick={handleExtract}>
    {loading ? "抓取中..." : "抓取视频信息"}
  </button>
</div>
```

**交互**：
1. 用户贴 URL → 点击"抓取"
2. `POST /api/videos/extract` → Loading 状态（~5-15 秒）
3. 成功 → 把返回字段自动填进 Phase A 的 `VideoForm` 组件（`title` / `author` / `description` / `transcript` / `tags`）
4. 用户可编辑任何字段
5. 继续原有"生成 Skill"流程（复用 Phase A 的按钮与 `/api/skills/generate`）

**交互细节**：
- 自动抽取时如果 `subtitleMeta.source === "auto"`，顶部黄色条提示"当前为 AI 生成字幕，可能有错字"
- tags 展示为可点删 chip；`description` 若超 200 字折叠展示 + "展开"
- 分类**不自动填**，交给用户或让他们点"AI 帮我选"（Phase A 已有）

## 依赖与安装

### 新增 npm 依赖

```json
{
  "dependencies": {
    "youtube-dl-exec": "^3.0.0"
  }
}
```

### 系统依赖

- **Python 3.9+**（yt-dlp 运行时）
- `youtube-dl-exec` 的 postinstall 脚本会自动从 GitHub releases 拉取 yt-dlp 二进制到 `node_modules/youtube-dl-exec/bin/`
- 首次安装需外网访问 GitHub；离线环境需手动放置 binary 并设 `YOUTUBE_DL_DIR` 环境变量

### 环境变量

在 `src/.env.example` 追加：

```bash
# === Phase B: 视频抓取 ===

# Bilibili 可选登录凭证（付费/会员内容需要）
# 从浏览器 devtools → Application → Cookies 里拷 SESSDATA 值
BILIBILI_COOKIES=

# yt-dlp binary 路径覆盖（一般不用改）
# YOUTUBE_DL_PATH=/custom/path/to/yt-dlp

# 抽取超时（毫秒，默认 30000）
# VIDEO_EXTRACT_TIMEOUT=30000
```

### gitignore 追加

`src/.gitignore` 加一行（yt-dlp 缓存）：

```
# yt-dlp
.yt-dlp-cache/
*.srt
*.vtt
```

## 性能与限制

- **单次抽取耗时**：Bilibili 典型 5~15 秒（yt-dlp 网络请求 + 字幕下载）
- **并发**：建议客户端禁止同一 URL 并发（loading 状态锁），后端无限流（本地使用场景）
- **字幕长度**：最长截至 20k 字（超过的话前端自动截断并提示，`MockVideo.transcript` 在 LLM 端本就会被截）
- **断网失败**：yt-dlp 会重试 3 次，仍失败返回 `EXTRACTOR_FAILED`

## 安全注意

- `url` 入参必须严格 URL 校验（防止命令注入，虽然 `youtube-dl-exec` 已经做了参数化）
- `cookies` 不落盘，只走环境变量读取 → 不暴露到客户端
- 返回 `raw` 只在 dev 环境（`NODE_ENV === "development"`），生产响应不带

## 文件清单

### 新增
| 路径 | 职责 |
|---|---|
| `src/lib/extractor/types.ts` | `VideoExtractor` / `ExtractResult` 接口 |
| `src/lib/extractor/registry.ts` | URL → Extractor 路由 |
| `src/lib/extractor/bilibili.ts` | BilibiliExtractor 实现 |
| `src/lib/extractor/subtitle.ts` | SRT/VTT/Bilibili-JSON 解析 |
| `src/lib/extractor/errors.ts` | `ExtractError` 错误类型 |
| `src/lib/extractor/index.ts` | 模块公开 API |
| `src/app/api/videos/extract/route.ts` | 抽取 API endpoint |
| `src/components/create/UrlExtractor.tsx` | URL 输入 + 抽取组件 |

### 修改
| 路径 | 改动 |
|---|---|
| `src/package.json` | 加 `youtube-dl-exec` 依赖 |
| `src/.env.example` | 加 `BILIBILI_COOKIES` 等 |
| `src/.gitignore` | 加 yt-dlp 缓存与字幕文件 |
| `src/components/create/ModeSwitch.tsx`（Phase A 创建的）| 解锁 URL 模式选项 |
| `src/app/create/page.tsx`（Phase A 创建的）| 接入 `UrlExtractor`，抽取成功后调用 `setForm()` |

## 接受标准

- [ ] `npm install` 后，`node_modules/youtube-dl-exec/bin/yt-dlp`（或同等路径）可执行
- [ ] 访问 `/create`，选 "URL 模式"，贴一个带 CC 字幕的 Bilibili BV 链接，点"抓取"
- [ ] 15 秒内表单自动填上 title / author / description / transcript / tags
- [ ] 字幕里**不包含弹幕**内容
- [ ] 贴一个无字幕视频，返回 `NO_SUBTITLE` + 友好提示
- [ ] 贴一个非 Bilibili URL（如 `https://example.com`），返回 `UNSUPPORTED_PLATFORM`
- [ ] 贴一个带 `?p=3` 的多 P URL，抽取的是第 3 P
- [ ] 设置 `BILIBILI_COOKIES` 后，能抽取原本提示需登录的视频
- [ ] 抽取后继续走 Phase A 生成 Skill，端到端跑通

## 扩展路线（本次不做，留接口）

| 平台 | 新增文件 | 备注 |
|---|---|---|
| YouTube | `src/lib/extractor/youtube.ts` | yt-dlp 已原生支持，实现成本低；但需 JS 运行时（Node 已满足） |
| 抖音 | `src/lib/extractor/douyin.ts` | yt-dlp 支持有限，可能需要 `bilibili-api` 类纯 TS 方案兜底 |
| 小红书 | `src/lib/extractor/xiaohongshu.ts` | 字幕支持不稳定，优先抓简介 |
| 本地 SRT/VTT 上传 | `src/lib/extractor/file.ts` + 前端 FileUpload | 非 URL 模式，但走相同 `ExtractResult` 接口 |

每个新 extractor **只需实现 `canHandle` + `extract` 两个方法**，注册到 `registry.ts`，前端零改动。这就是 `VideoExtractor` 抽象的价值。
