import { chatPlanMessages, type StoredSelections } from "@/services/ai/plan";
import type { AthleteContext } from "@/services/training/engine";

const DEFAULT_MODEL = "gpt-4.1-mini";

export function openAIModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_MODEL;
}

export function openAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function requestChatDraft(
  ctx: AthleteContext,
  selections: StoredSelections,
  exercises: Array<{ slug: string; name: string }>,
  repair: string | null = null,
): Promise<{ draft: unknown; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = openAIModel();
  const messages = chatPlanMessages(ctx, selections, exercises);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), repair ? 20_000 : 35_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 6000,
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: repair ? `${messages.user}\n\nRevise the plan. ${repair}` : messages.user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(redact(payload?.error?.message || `ChatGPT returned ${response.status}.`));
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("ChatGPT returned no plan.");
    return { draft: readModelJson(content), model };
  } finally {
    clearTimeout(timer);
  }
}

export function readModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function redact(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-redacted").slice(0, 300);
}
