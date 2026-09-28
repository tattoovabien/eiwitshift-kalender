// Optional AI step for "Plak een link". Switched on by setting ONE secret in Supabase:
//   ANTHROPIC_API_KEY  → Claude (Anthropic API)
//   GEMINI_API_KEY     → Gemini (Google AI Studio; has a free tier)
// Optional: AI_PROVIDER ("anthropic" | "gemini") when both keys are set, AI_MODEL to pick a model.
// Without a key the page is still read, just without AI (see pageExtract.ts).
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';
import { AI_SCHEMA, AI_SYSTEM, buildAiInput, normalizeAiOutput, type PageData } from './app/lib/pageExtract.ts';
import type { PrefillResult } from './app/lib/prefill.ts';

export type Provider = 'anthropic' | 'gemini';

export interface AiConfig {
  provider: Provider;
  model: string;
  key: string;
}

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-opus-5',
  gemini: 'gemini-3.5-flash-lite',
};

export function aiConfig(): AiConfig | null {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const wanted = (Deno.env.get('AI_PROVIDER') ?? '').toLowerCase();
  let provider: Provider | null = null;
  if (wanted === 'anthropic' && anthropicKey) provider = 'anthropic';
  else if (wanted === 'gemini' && geminiKey) provider = 'gemini';
  else if (geminiKey) provider = 'gemini';
  else if (anthropicKey) provider = 'anthropic';
  if (!provider) return null;
  return {
    provider,
    model: Deno.env.get('AI_MODEL') || DEFAULT_MODEL[provider],
    key: provider === 'anthropic' ? anthropicKey : geminiKey,
  };
}

async function askClaude(cfg: AiConfig, input: string): Promise<unknown> {
  const client = new Anthropic({ apiKey: cfg.key, timeout: 45_000, maxRetries: 1 });
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: cfg.model,
    max_tokens: 16000,
    system: AI_SYSTEM,
    messages: [{ role: 'user', content: input }],
    // Structured outputs: the answer is guaranteed to match AI_SCHEMA. Low effort: a simple extraction.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA as unknown as Record<string, unknown> } },
    // If a safety check would decline, let Anthropic retry on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
  };
  // `fallbacks: "default"` is newer than this SDK's type definitions, so it is added untyped.
  const response = await client.beta.messages.create({ ...params, fallbacks: 'default' } as typeof params);
  if (response.stop_reason === 'refusal') throw new Error('Claude weigerde deze pagina te lezen');
  if (response.stop_reason === 'max_tokens') throw new Error('Antwoord van Claude was onvolledig');
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text);
}

async function askGemini(cfg: AiConfig, input: string): Promise<unknown> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AI_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: AI_SCHEMA },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini gaf geen antwoord');
  return JSON.parse(text);
}

/** Ask the configured AI to read the page. Returns only fields that passed validation. */
export async function aiExtract(cfg: AiConfig, page: PageData, today: string): Promise<Partial<PrefillResult>> {
  const input = buildAiInput(page, today);
  const raw = cfg.provider === 'anthropic' ? await askClaude(cfg, input) : await askGemini(cfg, input);
  return normalizeAiOutput(raw);
}
