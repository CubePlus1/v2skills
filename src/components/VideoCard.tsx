/**
 * components/VideoCard.tsx
 *
 * 视频卡片组件
 * 用于在领域详情页展示视频并支持选择
 */

"use client";

import { MockVideo } from "@/types/index";

interface VideoCardProps {
  video: MockVideo;
  isSelected: boolean;
  onToggle: () => void;
}

export default function VideoCard({
  video,
  isSelected,
  onToggle,
}: VideoCardProps) {
  // 格式化时长（秒转为 mm:ss 格式）
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 格式化播放量
  const formatViewCount = (count: number): string => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    }
    return count.toString();
  };

  // 格式化保存时间
  const formatSavedDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden transition-all duration-200
        ${
          isSelected
            ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]"
            : "shadow-md hover:shadow-xl"
        }
        cursor-pointer bg-white
      `}
      onClick={onToggle}
    >
      {/* 选择复选框 */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`
            w-6 h-6 rounded-md flex items-center justify-center transition-all
            ${
              isSelected
                ? "bg-blue-500 text-white"
                : "bg-white/90 backdrop-blur-sm border-2 border-gray-300"
            }
          `}
        >
          {isSelected && (
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>

      {/* 缩略图 */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="w-12 h-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* 时长标签 */}
        {video.duration != null && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 text-white text-xs rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="p-4">
        {/* 标题 */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 leading-snug">
          {video.title}
        </h3>

        {/* 作者 */}
        {video.author && (
          <p className="text-xs text-gray-500 mb-3">{video.author}</p>
        )}

        {/* 描述 */}
        <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">
          {video.description}
        </p>

        {/* 标签 */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {video.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              >
                #{tag}
              </span>
            ))}
            {video.tags.length > 3 && (
              <span className="inline-block px-2 py-0.5 text-gray-400 text-xs">
                +{video.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 元信息 */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          {video.viewCount != null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
              {formatViewCount(video.viewCount)}
            </span>
          )}
          <span>收藏于 {formatSavedDate(video.savedAt)}</span>
        </div>
      </div>
    </div>
  );
}
