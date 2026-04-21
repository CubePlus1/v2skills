"use client";

import type { BatchItem } from "@/lib/batch/types";

interface Props {
  items: BatchItem[];
}

export default function BatchVideoPreview({ items }: Props) {
  const success = items.filter((i) => i.status === "done" && i.result);
  if (success.length === 0) return null;
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <h3 className="mb-3 text-base font-semibold text-[#1A1A1A]">
        已抓取 {success.length} 个视频
      </h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {success.map((item, i) => (
          <li
            key={i}
            className="rounded-2xl border border-[#D6E5EC] bg-white p-3"
          >
            <div className="truncate text-sm font-medium text-[#1A1A1A]">
              {item.result!.title}
            </div>
            <div className="mt-1 truncate text-xs text-[#94A7B2]">
              {item.result!.platform} · {item.result!.transcript.length} 字
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
