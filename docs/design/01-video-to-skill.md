# Phase A · 核心：Video → Skill

> 版本：1.0 · 2026-04-20 · 状态：待实现

## 目标

让用户**不依赖任何抓取能力**，就能把一个视频的文本材料（标题/描述/字幕）转成一份可直接在 Claude Code 里用的 `SKILL.md` 文件。

这是整个产品的**最小可用闭环**，也是 Phase B（Bilibili 抓取）的前置基础——抓取只是把"手动填表"变成"自动填表"，生成逻辑完全复用。

## 非目标

- ❌ 不做 URL 抓取（Phase B 负责）
- ❌ 不做视频文件上传（不上传视频本体，只处理文本材料）
- ❌ 不做 ASR（本机 Whisper 之类）—— 用户贴现成字幕就够用
- ❌ 不改 `map/` `category/` 既有页面（它们继续演示 demo 数据）

## 用户流程

### 入口

主页（`/`）添加**第二个 CTA**，与现有"立即开始整理！"并列：

```
┌──────────────────────────────┐
│  主 CTA：立即开始整理！       │ → /loading → /map （演示流）
│  副 CTA：贴字幕生成 Skill    │ → /create （新）
└──────────────────────────────┘
```

### `/create` 页面布局

```
┌─────────────────────────────────────────────────────┐
│  [← 返回]   创建你的 Skill                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌ 输入模式 ─────────────────────────┐             │
│  │  ○ 手动填写 （默认，Phase A 唯一） │             │
│  │  ○ 贴视频链接  （Phase B 解锁）    │             │
│  └──────────────────────────────────┘             │
│                                                     │
│  ┌ 视频信息 ─────────────────────────┐             │
│  │  标题 *        [___________]       │             │
│  │  作者          [___________]       │             │
│  │  简介          [___________]       │             │
│  │  字幕/文字稿 * [            ]       │ ← textarea  │
│  │                [            ]       │             │
│  │  标签          [__] [__] [+]        │             │
│  │  来源链接      [___________]       │             │
│  └──────────────────────────────────┘             │
│                                                     │
│  ┌ 分类 ────────────────────────────┐             │
│  │  🤖 科技  🎬 解说  🍔 美食  ✈️ 旅行 │             │
│  │  📚 人文  🎮 游戏  📚 知识          │             │
│  │  [💡 AI 帮我选]                     │             │
│  └──────────────────────────────────┘             │
│                                                     │
│  ┌ Skill 配置 ──────────────────────┐             │
│  │  Skill 名称   [___________]       │             │
│  │    (kebab-case，AI 自动建议)       │             │
│  │  Skill 描述   [___________]       │             │
│  └──────────────────────────────────┘             │
│                                                     │
│                    [ 生成 Skill ]                   │
└─────────────────────────────────────────────────────┘
```

生成成功后原地弹出 **Skill 预览 Modal**（复用现有 `SkillGeneratorModal.tsx` 的预览区块）：

```
┌─────────────────────────────────────┐
│  ✨ Skill 已生成                     │
├─────────────────────────────────────┤
│  # 美食写作技巧                      │
│  ...（Markdown 预览）                │
├─────────────────────────────────────┤
│  [📋 复制]  [⬇️ 下载 SKILL.md]       │
└─────────────────────────────────────┘
```

### 保留的视觉语言

- 背景渐变 `#C8E6F5 → #E8F5FA`（与 landing 一致）
- 表单卡片用白色半透明 + 大圆角（24px）
- 分类选择器用 **Bot 头像 + 分类色** 做 chip，点击态用 `colorDark`
- 按钮用深炭黑 `#2C2C2C`，与 landing CTA 风格统一

## 数据流

```
用户填表
   │
   ├── 可选：点"AI 帮我选" → POST /api/skills/classify → 推荐 categoryId
   │
   └── 点"生成 Skill" → POST /api/skills/generate（增强版）
                              │
                              ▼
                      generateSkillWithAI(videos, category, name?, desc?)
                              │
                              ▼
                      generateSkillMarkdown(skill, videos)
                              │
                              ▼
                      { skillContent, skillName, skillPath }
                              │
                              ▼
                      客户端 Blob 下载 / 剪贴板复制
```

**关键复用**：`generateSkillWithAI()` 已存在于 `src/lib/skillTemplate.ts`，它接受 `MockVideo[]`。Phase A **不改这个函数**，只做 API 层适配：把用户填的表单转成一个 `MockVideo`（id 用 uuid 或 "user-input-{timestamp}"）。

## 类型定义

在 `src/types/index.ts` 新增：

```ts
// 用户通过表单直接提供的视频数据（MockVideo 的可写子集）
export interface VideoInput {
  title: string;              // 必填
  transcript: string;         // 必填（字幕/文字稿，至少 200 字）
  description?: string;
  author?: string;
  tags?: string[];
  url?: string;
  duration?: number;
}

// 增强的生成请求：两种输入模式二选一
export interface GenerateSkillRequest {
  category: CategoryId;
  // 模式 A（既有）：从 demo store 里按 ID 取
  videoIds?: string[];
  // 模式 B（新增）：直接提供内联视频数据
  videos?: VideoInput[];
  skillName?: string;
  skillDescription?: string;
  mode?: "default" | "advanced";
}
```

**校验规则**（服务端）：
- `videoIds` 和 `videos` 至少提供一个
- 若同时提供，以 `videos` 为准
- `videos[].transcript` 长度 ≥ 200 字（低于此阈值生成质量差）
- `videos[].title` 非空

## API 变更

### 1. `POST /api/skills/generate`（**增强既有**）

文件：`src/app/api/skills/generate/route.ts`

**新增逻辑**（高优先级于既有 `videoIds` 分支）：

```ts
if (body.videos && body.videos.length > 0) {
  // 把 VideoInput[] 转成 MockVideo[]（补齐 id/category/savedAt 字段）
  const videos: MockVideo[] = body.videos.map((v, idx) => ({
    id: `user-input-${Date.now()}-${idx}`,
    title: v.title,
    description: v.description ?? "",
    tags: v.tags ?? [],
    category: body.category,
    savedAt: new Date().toISOString(),
    transcript: v.transcript,
    author: v.author,
    url: v.url,
    duration: v.duration,
  }));
  // 走既有 pipeline
  const skill = await generateSkillWithAI(videos, body.category, body.skillName, body.skillDescription);
  const skillContent = generateSkillMarkdown(skill, videos);
  return NextResponse.json({ success: true, skillName: skill.name, skillContent, skillPath: `.claude/skills/${skill.name}/SKILL.md` });
}
// else 走既有 videoIds 分支（不动）
```

### 2. `POST /api/skills/classify`（**新增**）

文件：`src/app/api/skills/classify/route.ts`

**请求**：
```json
{ "title": "...", "description": "...", "transcript": "..." }
```

**响应**：
```json
{ "category": "tech", "confidence": 0.82, "reason": "讨论 AI 工具和编程" }
```

**实现**：Vercel AI SDK `generateObject`，Zod schema 限定 `category` 为 7 个既有 id 之一。无 API key 时走关键词 fallback（简单词表命中分类）。

```ts
const ClassifySchema = z.object({
  category: z.enum(["tech","jieshuo","food","trip","renwen","game","knowledge"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
```

## 文件清单

### 新增
| 路径 | 职责 |
|---|---|
| `src/app/create/page.tsx` | `/create` 页面入口，组合下列组件 |
| `src/components/create/ModeSwitch.tsx` | 手动 / URL 模式切换（URL 选项 Phase B 前禁用） |
| `src/components/create/VideoForm.tsx` | 核心视频信息表单（受控，带校验） |
| `src/components/create/CategoryPicker.tsx` | 7 分类 chip 选择器 + "AI 帮我选"按钮 |
| `src/components/create/SkillConfig.tsx` | Skill 名称/描述编辑器 |
| `src/components/create/GeneratedSkillModal.tsx` | 生成后预览 + 复制/下载（可复用 `SkillGeneratorModal` 预览部分） |
| `src/app/api/skills/classify/route.ts` | AI 分类 endpoint |
| `src/lib/validators/videoInput.ts` | Zod schema 校验 VideoInput |

### 修改
| 路径 | 改动 |
|---|---|
| `src/app/page.tsx` | 主 CTA 下方加副 CTA "贴字幕生成 Skill" → `/create` |
| `src/app/api/skills/generate/route.ts` | 支持 `videos` 字段 |
| `src/types/index.ts` | 新增 `VideoInput`，扩展 `GenerateSkillRequest` |

### 不动
- `src/lib/skillTemplate.ts`（生成核心）
- `src/lib/ai-client.ts`
- `src/app/map/*`、`src/app/category/*`（demo 流）

## 校验与错误处理

### 客户端
- `title` 非空 + ≤ 100 字
- `transcript` ≥ 200 字（提示"太短可能影响生成质量"）
- 标签最多 10 个，每个 ≤ 20 字
- Skill 名称若用户填写：`/^[a-z0-9\u4e00-\u9fa5]+(-[a-z0-9\u4e00-\u9fa5]+)*$/`（复用 `validateSkillName`）

### 服务端
- 所有字段用 Zod 校验
- transcript 长度兜底 200 字
- 超过 10k 字自动截断到 10k（防止 LLM context 爆炸）
- 无 `AI_API_KEY` 时自动走模板模式（`generateSkillFromTemplate`），前端提示"当前 Mock 模式"

### 常见失败
| 场景 | 处理 |
|---|---|
| AI 超时 | 返回 504，前端提示重试 |
| AI 输出不符合 Schema | 返回 500 + 错误详情 |
| 字幕过短 | 422 + 明确提示 |
| 字幕过长 | 自动截断，响应里带 `truncated: true` 标志提示用户 |

## 接受标准（Definition of Done）

- [ ] `npm run dev` 后访问 `/create`，手动填入一段真实视频字幕（≥ 200 字）
- [ ] 选一个分类，或点"AI 帮我选"获得建议
- [ ] 点"生成 Skill"，10 秒内看到预览 Modal
- [ ] 预览内容包含：displayName、useCases、capabilities、examples(3)、constraints(≥2)、instructions
- [ ] 点"下载"获得合法的 `SKILL.md` 文件
- [ ] 将该文件放入 `.claude/skills/<skill-name>/SKILL.md`，Claude Code 能识别并调用
- [ ] 移动端（≤ 768px）表单可用、按钮可点
- [ ] 无 `AI_API_KEY` 时走模板模式也能生成（内容质量降级但结构完整）

## 开放问题（等实现时回答）

1. **多视频合并成一个 Skill**：当前 `MockVideo[]` 支持多视频。Phase A UI 要不要暴露"继续加一条视频"？
   - 建议：MVP 单条即可，避免复杂度；多条在 Phase B 由 URL 批量抓取触发
2. **字幕格式识别**：用户可能贴 SRT/VTT/纯文本。要不要识别后剥离时间戳？
   - 建议：前端简单正则剥掉 `\d{2}:\d{2}:\d{2}` 行；不对就让用户粘纯文本
3. **分类的 AI 建议是否自动生效**：点按钮后直接选中，还是展示建议让用户确认？
   - 建议：展示 + 一键应用（类似 "使用此建议" 按钮），保留用户最终决定权
