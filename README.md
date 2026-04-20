# FavToSkill

> 粘贴视频链接，AI 解析成可执行的 Claude Code Skill。

**FavToSkill** 是一个本地运行的 Web 应用，把视频内容（标题、简介、字幕）通过 LLM 提炼成符合 Claude Code 规范的 `SKILL.md` 文件，一键下载即刻可用。

---

## 产品路线（两阶段）

### Phase A — 核心：Video → Skill（进行中）
用户**手动提供视频信息**（标题 + 描述 + 字幕/文字稿 + 分类），直接生成 Skill。不依赖任何抓取能力，最小闭环。

详见 [`docs/design/01-video-to-skill.md`](docs/design/01-video-to-skill.md)

### Phase B — 抓取：Bilibili API 接入（下一步）
粘贴 Bilibili 视频链接，自动抽取元数据 + 字幕（基于 [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) + Node 子进程）。抽象 `VideoExtractor` 接口，未来扩展 YouTube、抖音等平台。

详见 [`docs/design/02-video-extraction.md`](docs/design/02-video-extraction.md)

---

## 当前已实现能力

- ✅ 7 分类视频浏览（科技 / 解说 / 美食 / 旅行 / 人文 / 游戏 / 知识），每个分类带专属 AI 助手形象
- ✅ 基于关键词检索的流式问答（通义千问 qwen3.5-plus）
- ✅ AI 结构化输出生成 `SKILL.md`（Zod schema 约束）
- ✅ Demo 视频数据完整演示闭环
- ❌ 视频 URL 抓取（Phase B）
- ❌ 真正的向量 RAG（当前是加权关键词检索）

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| AI SDK | Vercel AI SDK (`streamText` / `generateObject`) |
| LLM | 通义千问 qwen3.5-plus（DashScope OpenAI 兼容） |
| 校验 | Zod v4 |
| 视频抽取 | yt-dlp + `youtube-dl-exec`（Phase B） |
| 运行 | 本地 Node.js 20+ |

---

## 快速开始

```bash
cd src
cp .env.example .env.local   # 可选：配置 AI_API_KEY；留空自动走 mock 模式
npm install
npm run dev
```

访问 <http://localhost:3000>。

### 环境变量

```bash
AI_API_KEY=sk-...                                      # 可选
AI_BASE_URL=https://coding.dashscope.aliyuncs.com/v1   # 默认 DashScope
AI_MODEL=qwen3.5-plus                                  # 默认千问
# Phase B（视频抓取）所需
# BILIBILI_COOKIES=SESSDATA=xxx; bili_jct=xxx          # 可选：部分受限视频需要
```

### Phase B 额外依赖
Phase B 抓取能力需要本机安装：
- Python 3.9+（yt-dlp 运行时）
- `youtube-dl-exec` 会在 `npm install` 时自动拉取 yt-dlp 二进制

---

## 设计文档

位于 [`docs/design/`](docs/design/)：

- [`01-video-to-skill.md`](docs/design/01-video-to-skill.md) — Phase A：核心 Video → Skill 功能
- [`02-video-extraction.md`](docs/design/02-video-extraction.md) — Phase B：视频抽取子系统
- [`../ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 整体架构（部分过时，以实际代码为准）
- [`../SKILL_GENERATION_DESIGN.md`](docs/SKILL_GENERATION_DESIGN.md) — Skill 生成管线细节

---

## 贡献

欢迎 Issue / PR。擅长前端交互、AI 管线、爬虫与数据采集、产品设计的朋友都可以参与。
