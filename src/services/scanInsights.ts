import { apiClient } from "./apiClient";

export interface ScanInsightsMealItem {
  name: string;
  whyLine?: string | null;
}

export interface ScanInsightsMealSlots {
  breakfast?: ScanInsightsMealItem[];
  lunch?: ScanInsightsMealItem[];
  dinner?: ScanInsightsMealItem[];
}

export interface ScanInsightsMessage {
  // `text` is present for the default 'prose' format; `noticed`/`mealBecause`
  // are present for the 'split' format (the pre-paywall two-beat takeaway).
  text?: string;
  noticed?: string;
  mealBecause?: string;
  cached: boolean;
  scannedAt: string | null;
}

export async function getScanInsightsMessage(
  mealSlots?: ScanInsightsMealSlots,
  format?: "prose" | "split",
): Promise<ScanInsightsMessage> {
  return apiClient<ScanInsightsMessage>("/api/profile/scan-insights/message", {
    method: "POST",
    body: JSON.stringify({ mealSlots: mealSlots ?? null, format: format ?? "prose" }),
  });
}
