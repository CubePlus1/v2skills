import type { ExtractResult } from "@/lib/extractor/types";

export type BatchItemStatus = "pending" | "extracting" | "done" | "failed";

export interface BatchItem {
  url: string;
  status: BatchItemStatus;
  result?: ExtractResult;
  error?: { code: string; message: string };
}

export interface BatchResult {
  items: BatchItem[];
  successCount: number;
  failureCount: number;
}
