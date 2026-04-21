"use client";

import { MAX_INTENT_LENGTH } from "@/lib/validators/videoInput";

interface IntentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function IntentField({ value, onChange, disabled }: IntentFieldProps) {
  return (
    <section className="rounded-[24px] bg-white/80 p-5 shadow-[0_20px_50px_rgba(113,151,167,0.16)] backdrop-blur md:p-6">
      <label className="block text-lg font-semibold text-[#1A1A1A]">学习意图</label>
      <p className="mt-1 text-sm text-[#5F6F7A]">
        告诉 AI 你想从这些视频里学到什么——越具体，生成的 Skill 越贴合。
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_INTENT_LENGTH))}
        disabled={disabled}
        className="mt-3 w-full min-h-[88px] rounded-2xl border border-[#D6E5EC] bg-white px-4 py-3 text-sm text-[#1A1A1A] outline-none transition placeholder:text-[#94A7B2] focus:border-[#8CB7CA] focus:ring-2 focus:ring-[#C8E6F5] disabled:cursor-not-allowed disabled:opacity-60"
        rows={3}
        placeholder="例：我已经懂神经网络，只想搞懂 attention 机制的具体计算步骤"
      />
      <div className="mt-2 text-right text-xs text-[#94A7B2]">
        {value.length} / {MAX_INTENT_LENGTH}
      </div>
    </section>
  );
}
