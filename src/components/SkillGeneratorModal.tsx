/**
 * components/SkillGeneratorModal.tsx
 *
 * Skill 生成弹窗组件
 * 用于配置和生成 Claude Code Skill
 */

"use client";

import { useState } from "react";
import { VideoCategory } from "@/types/index";

interface SkillGeneratorModalProps {
  category: VideoCategory;
  videoIds: string[];
  onClose: () => void;
}

export default function SkillGeneratorModal({
  category,
  videoIds,
  onClose,
}: SkillGeneratorModalProps) {
  const [skillName, setSkillName] = useState(
    `${category.toLowerCase().replace(/\s+/g, "-")}-skill`
  );
  const [skillDescription, setSkillDescription] = useState("");
  const [mode, setMode] = useState<"default" | "advanced">("default");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          videoIds,
          skillName,
          skillDescription,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成失败");
      }

      // 成功提示
      alert(
        `✅ Skill 生成成功！\n\n` +
          `文件路径：${data.skillPath}\n` +
          `使用方法：${data.usageExample}\n\n` +
          `请在 Claude Code 中使用该 Skill！`
      );

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  // 点击背景关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">生成 Skill</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isGenerating}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Skill 名称 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Skill 名称
          </label>
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="例如：cooking-style-writing"
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-500 mt-1">
            使用 kebab-case 格式（小写字母、数字、中文，用连字符分隔）
          </p>
        </div>

        {/* Skill 描述 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Skill 描述
            <span className="text-gray-400 font-normal ml-1">(可选)</span>
          </label>
          <textarea
            value={skillDescription}
            onChange={(e) => setSkillDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
            rows={3}
            placeholder="描述这个 Skill 的用途..."
            disabled={isGenerating}
          />
        </div>

        {/* 生成模式 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生成模式
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="default"
                checked={mode === "default"}
                onChange={() => setMode("default")}
                disabled={isGenerating}
                className="w-4 h-4 text-blue-500"
              />
              <span className="text-sm text-gray-700">默认模式</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="advanced"
                checked={mode === "advanced"}
                onChange={() => setMode("advanced")}
                disabled={isGenerating}
                className="w-4 h-4 text-blue-500"
              />
              <span className="text-sm text-gray-700">高级定制</span>
            </label>
          </div>
        </div>

        {/* 视频数量提示 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            将基于「<strong>{category}</strong>」领域的{" "}
            <strong>{videoIds.length}</strong> 个视频生成 Skill
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !skillName.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                生成中...
              </>
            ) : (
              <>
                <span>✨</span>
                生成 Skill
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
