"use client";

import type { BatchItem } from "@/lib/batch/types";

interface Props {
  items: BatchItem[];
}

const STATUS_LABEL: Record<BatchItem["status"], string> = {
  pending: "待处理",
  extracting: "抓取中",
  done: "完成",
  failed: "失败",
};

const STATUS_CLASS: Record<BatchItem["status"], string> = {
  pending: "bg-[#F0F5F8] text-[#94A7B2]",
  extracting: "bg-[#FFF7D6] text-[#8B6A00]",
  done: "bg-[#E1F5E1] text-[#2D7A2D]",
  failed: "bg-[#FFE1E1] text-[#B65252]",
};

export default function BatchExtractionProgress({ items }: Props) {
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <h3 className="mb-3 text-base font-semibold text-[#1A1A1A]">抓取进度</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[item.status]}`}
            >
              {STATUS_LABEL[item.status]}
            </span>
            <span className="flex-1 truncate text-[#5F6F7A]">{item.url}</span>
            {item.error ? (
              <span
                className="text-xs text-[#B65252]"
                title={item.error.message}
              >
                {item.error.code}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
