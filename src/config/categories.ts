/**
 * 分类体系——产品的核心设计而非 mock 数据。
 * 单一数据源：所有引用分类的模块都从本文件读取。
 */

export type CategoryId =
  | "tech"
  | "jieshuo"
  | "food"
  | "trip"
  | "renwen"
  | "game"
  | "knowledge";

export interface CategoryMeta {
  id: CategoryId;
  name: string;
  description: string;
  color: string;
  colorDark?: string;
  emoji?: string;
  icon?: string;
  topTags: string[];
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: "tech",
    name: "科技",
    description: "数码测评、科技资讯、极客玩法",
    color: "#A8D8EA",
    colorDark: "#7FC4DA",
    emoji: "💻",
    icon: "/bot/bot_tech.png",
    topTags: ["数码", "测评", "AI", "手机", "电脑"],
  },
  {
    id: "jieshuo",
    name: "解说",
    description: "电影解说、剧情分析、影视推荐",
    color: "#D4E8C2",
    colorDark: "#AECF95",
    emoji: "🎬",
    icon: "/bot/bot_film.png",
    topTags: ["电影", "解说", "剧情", "影评", "推荐"],
  },
  {
    id: "food",
    name: "美食",
    description: "美食探店、家常菜谱、烹饪技巧",
    color: "#E8D8C0",
    colorDark: "#D4B88A",
    emoji: "🍔",
    icon: "/bot/bot_food.png",
    topTags: ["探店", "菜谱", "烹饪", "甜品", "饮品"],
  },
  {
    id: "trip",
    name: "旅行",
    description: "旅行攻略、风景打卡、出行体验",
    color: "#D0E8F0",
    colorDark: "#A4CDE0",
    emoji: "✈️",
    icon: "/bot/bot_trip.png",
    topTags: ["攻略", "打卡", "酒店", "风景", "自驾"],
  },
  {
    id: "renwen",
    name: "人文",
    description: "茶文化、地理科普、行业趋势、商业财经",
    color: "#E0D4F0",
    colorDark: "#C4A8E0",
    emoji: "📚",
    icon: "/bot/bot_renwen.png",
    topTags: ["茶叶知识", "地理", "大宗商品", "十五五规划", "拼豆"],
  },
  {
    id: "game",
    name: "游戏",
    description: "游戏攻略、实况解说、电竞赛事",
    color: "#B8E0D2",
    colorDark: "#8ECFBA",
    emoji: "🎮",
    icon: "/bot/bot_game.png",
    topTags: ["攻略", "实况", "电竞", "手游", "主机"],
  },
  {
    id: "knowledge",
    name: "知识",
    description: "百科知识、行业解读、趋势分析",
    color: "#E0D4F0",
    colorDark: "#C4A8E0",
    emoji: "📚",
    icon: "/bot/bot_tech.png",
    topTags: ["茶叶知识", "地理", "大宗商品", "十五五规划", "拼豆"],
  },
] as const;

// 中文分类名 → id 的映射（兼容用户/后端用中文时）
export const CATEGORY_NAME_MAP: Record<string, CategoryId> = {
  科技: "tech",
  美食: "food",
  解说: "jieshuo",
  旅行: "trip",
  人文: "renwen",
  游戏: "game",
  知识: "knowledge",
  商业财经: "knowledge",
};

export function getCategories(): readonly CategoryMeta[] {
  return CATEGORIES;
}

/** 中文名或 id → CategoryId */
export function findCategoryId(nameOrId: string): CategoryId | undefined {
  if (nameOrId in CATEGORY_NAME_MAP) {
    return CATEGORY_NAME_MAP[nameOrId];
  }
  return CATEGORIES.find((c) => c.id === nameOrId)?.id;
}
