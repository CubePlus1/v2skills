# FavToSkill

> 粘贴 YouTube 链接，AI 提炼成可执行的 Claude Code Skill。

**FavToSkill** 是一个本地运行的 Web 应用：把视频字幕扔给 LLM，输出一份符合 Claude Code 规范的 `SKILL.md` 文件，下载即用。

---

## 它能做什么

```
[ 输入 ]                                       [ 输出 ]

① 贴 YouTube / Bilibili 链接                   ┐
  ↓ (yt-dlp 抽字幕，不下视频)                  │
② 标题、作者、字幕、标签自动填表              │ → AI 生成 SKILL.md
  ↓                                           │   └─ displayName
③ 选分类（或 AI 帮我选）                      │      instructions
  ↓                                           │      examples × 2-3
④ 点「生成 Skill」                            │      constraints
                                              │      capabilities
  （或直接手动贴 transcript 走文本模式）      │      useCases
                                              ┘
```

## 首选 YouTube

YouTube **字幕覆盖率远高于 Bilibili**：

| 平台 | 字幕覆盖 | 抓取成功率 |
|---|---|---|
| **YouTube** | 绝大多数视频有 CC 或 AI 自动字幕 | ~95% |
| Bilibili | 大部分 UP 主用"硬字幕"（烧进画面），软字幕罕见 | ~10% |

**Bilibili 支持是保留的**——遇到真正带 CC 字幕的 B 站视频（官方账号、少数头部 UP 主）能正常工作；无字幕时会友好提示。

国内访问 YouTube 需要本机代理（见下方环境变量）。

---

## 快速开始

### 1. 安装依赖
```bash
cd src
npm install
```

依赖要求：
- **Node.js 20+**
- **Python 3.9+**（yt-dlp 运行时；`youtube-dl-exec` 在 postinstall 自动拉取 yt-dlp 二进制，不需要你手动装）

### 2. 配置环境变量
复制模板：
```bash
cp .env.example .env.local
```

然后在 `.env.local` 里填：
```bash
# AI 接口（必填；支持任何 OpenAI 兼容协议）
AI_API_KEY=sk-...
AI_BASE_URL=https://coding.dashscope.aliyuncs.com/v1    # 阿里 DashScope（通义千问）
AI_MODEL=qwen3.5-plus

# YouTube 代理（国内必填）
YOUTUBE_PROXY=http://127.0.0.1:7897

# 可选：付费/会员视频需要 cookies
# BILIBILI_COOKIES=SESSDATA=xxx
# YOUTUBE_COOKIES=...
```

推荐模型选择（按出品 Skill 质量从高到低）：
- OpenAI GPT-4o / GPT-4.1
- Anthropic Claude 3.5 Sonnet（via 兼容代理）
- 阿里通义千问 `qwen3.5-plus` / `qwen-max`
- 任何 OpenAI 兼容协议的本地模型（需要 JSON 模式支持）

### 3. 启动
```bash
npm run dev
```
访问 <http://localhost:3000>。

---

## 使用流程

1. 打开 `/` → 点「贴字幕生成 Skill」
2. 在 `/create` 选「贴 YouTube 链接」模式
3. 粘贴 URL → 点抓取 → 5~30 秒后表单自动填好
4. 点「AI 帮我选」分类（7 个领域：科技 / 解说 / 美食 / 旅行 / 人文 / 游戏 / 知识），也可手动选
5. 给 Skill 起个 kebab-case 名字（AI 会自动建议）
6. 点「生成 Skill」→ 弹出预览 → 下载 `SKILL.md`
7. 放到 `~/.claude/skills/<skill-name>/SKILL.md`，Claude Code 启动时自动加载

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) + React 19 |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| AI SDK | Vercel AI SDK (`generateObject` with `mode: "json"`) |
| LLM | 任何 OpenAI 兼容 API（默认通义千问） |
| 校验 | Zod v4 |
| 视频抽取 | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [`youtube-dl-exec`](https://github.com/microlinkhq/youtube-dl-exec) |
| 运行 | 本地 Node.js |

---

## 已知边界

- **硬字幕视频抓不到**——例如 B 站大部分翻译搬运视频，字幕直接烧进画面像素。需要 OCR 管线才能处理，本项目不做。
- **YouTube 某些视频的 YouTube 需要外挂 JS 运行时**（yt-dlp 2025.12+ 的变化）——少数新视频会提示这个。
- **小模型 JSON 输出不稳定**——例如 Qwen2.5-7b 一类更小的模型，`generateObject` 可能偶发 schema mismatch。代码已内置 3 次重试；换更大的模型可以彻底规避。

---

## 设计文档

`docs/design/` 下：
- [`01-video-to-skill.md`](docs/design/01-video-to-skill.md) — 核心 Video → Skill 功能
- [`02-video-extraction.md`](docs/design/02-video-extraction.md) — 视频抽取子系统（yt-dlp）

---

## 许可

MIT
