import { chatPlanMessages, type StoredSelections } from "@/services/ai/plan";
import type { AthleteContext } from "@/services/training/engine";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

const DEFAULT_GROQ_MODEL = "llama-4-scout-17b-16e-instruct";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function resolveProvider(): { key: string; baseUrl: string; defaultModel: string } | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) return { key: groqKey, baseUrl: GROQ_BASE_URL, defaultModel: DEFAULT_GROQ_MODEL };
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) return { key: openaiKey, baseUrl: OPENAI_BASE_URL, defaultModel: DEFAULT_OPENAI_MODEL };
  return null;
}

export function openAIModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  if (configured) return configured;
  const provider = resolveProvider();
  return provider?.defaultModel ?? DEFAULT_GROQ_MODEL;
}

export function openAIConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

export async function requestChatDraft(
  ctx: AthleteContext,
  selections: StoredSelections,
  exercises: Array<{ slug: string; name: string }>,
  repair: string | null = null,
): Promise<{ draft: unknown; model: string }> {
  const provider = resolveProvider();
  if (!provider) throw new Error("No AI API key configured. Set GROQ_API_KEY or OPENAI_API_KEY.");
  const model = openAIModel();
  const messages = chatPlanMessages(ctx, selections, exercises);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), repair ? 20_000 : 35_000);
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: repair ? `${messages.user}\n\nRevise the plan. ${repair}` : messages.user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(redact(payload?.error?.message || `AI API returned ${response.status}.`));
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("AI model returned no plan.");
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
  return message.replace(/(?:sk|gsk)-[A-Za-z0-9_-]+/g, "key-redacted").slice(0, 300);
}
