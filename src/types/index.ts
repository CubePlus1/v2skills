import type { CategoryId } from "@/config/categories";

// ─────────────────────────────────────────────
// 视频数据结构
// ─────────────────────────────────────────────

/**
 * Skill 生成管线的完整视频记录——包含 transcript 与元数据。
 * 可以由用户直接填表（/create 手动模式）构造，
 * 也可以由 Phase B 视频抽取子系统（yt-dlp 等）填充后得到。
 */
export interface Video {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: CategoryId;
  savedAt: string; // ISO 8601
  transcript?: string;
  author?: string;
  thumbnail?: string;
  url?: string;
  duration?: number; // seconds
  viewCount?: number;
}

/**
 * 用户表单直接提供的视频数据。Video 的可写子集——
 * id / category / savedAt 等字段由后端补齐。
 */
export interface VideoInput {
  title: string;
  transcript: string;
  description?: string;
  author?: string;
  tags?: string[];
  url?: string;
  duration?: number;
}

// ─────────────────────────────────────────────
// Skill 相关类型
// ─────────────────────────────────────────────

export interface SkillMetadata {
  name: string; // kebab-case 格式，如 "cooking-style-writing"
  displayName: string; // 展示名称，如 "美食写作技巧"
  description: string; // 一句话描述
  category: CategoryId; // 所属领域
  sourceVideoIds: string[]; // 来源视频 ID 列表
  createdAt: string; // 生成时间 ISO 8601
}

export interface SkillContent {
  trigger: string; // 触发词，如 "教你写美食文案"
  instructions: string; // 核心指令
  examples: SkillExample[];
  constraints: string[];
  capabilities: string[];
  useCases: string[];
}

export interface SkillExample {
  userInput: string;
  assistantOutput: string;
}

export interface Skill extends SkillMetadata, SkillContent {}

// ─────────────────────────────────────────────
// API 合同
// ─────────────────────────────────────────────

export interface GenerateSkillRequest {
  category: CategoryId;
  videos: VideoInput[];
  skillName?: string;
  skillDescription?: string;
  mode?: "default" | "advanced";
}

export interface GenerateSkillResponse {
  success: boolean;
  skillPath?: string;
  skillName?: string;
  skillContent?: string;
  skill?: Skill;
  usageExample?: string;
  truncated?: boolean;
  error?: string;
}

export interface SkillPreviewResponse {
  skillContent: string;
  metadata: SkillMetadata;
}

// 便捷 re-export
export type { CategoryId };
