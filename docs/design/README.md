# 设计文档索引

> 本目录存放 FavToSkill 的功能级设计文档。高层架构见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)。

## 当前设计

| 编号 | 文档 | 阶段 | 状态 |
|---|---|---|---|
| 01 | [核心：Video → Skill](./01-video-to-skill.md) | Phase A | 待实现 |
| 02 | [视频抽取子系统（Bilibili + yt-dlp）](./02-video-extraction.md) | Phase B | 待实现 |

## 设计原则（贯穿所有设计）

**保留既有产品视觉语言**：
- **7 个固定分类**：`tech` / `jieshuo` / `food` / `trip` / `renwen` / `game` / `knowledge`（对应中文 科技 / 解说 / 美食 / 旅行 / 人文 / 游戏 / 知识）
- 每个分类配套 **Bot 头像**（`public/bot/bot_*.png`）和 **主题色**（`public/mock/categories.json` 中定义）
- **柔和温暖极简**配色：浅蓝绿渐变背景 `#D8EEF0` → `#C5E8EA`，主色 `#6DBF9E`
- **文件夹**形态的视觉隐喻（landing/map 页已用 SVG 文件夹卡片）
- **中文优先**的 UX 文案，AI 助手语气友好

**保留既有代码能力**：
- 复用 `generateSkillWithAI()`（`src/lib/skillTemplate.ts`）— Skill 生成管线已跑通
- 复用 `getAIModel()`（`src/lib/ai-client.ts`）— 通义千问接入已封装
- 复用现有 `MockVideo` 接口定义 — 新增 `VideoInput` 作为其"子集/输入态"
- 7 个分类元数据从 `public/mock/categories.json` 单一来源加载

**新增模块的命名约束**：
- 新路由：`/create`（Phase A）
- 新 API：`/api/skills/generate`（增强现有）· `/api/videos/extract`（新增 Phase B）
- 新库目录：`src/lib/extractor/`（Phase B）

## 实现顺序

1. **Phase A 先行**：设计文档 01。不依赖任何新的外部依赖，纯前端 + 现有 API 增强。
2. **Phase B 后置**：设计文档 02。引入 yt-dlp + `youtube-dl-exec`，需要 Python 3.9+。

实现时请严格按顺序推进：完成 Phase A 并能端到端生成 Skill 后再启动 Phase B。Phase B 的价值是让 Phase A 的"手动贴字幕"变成"贴 URL 自动填表"，UI 结构复用。
