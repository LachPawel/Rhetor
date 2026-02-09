export interface GeneratedTalkingPoints {
  hook: string;
  bullets: string[];
  closing: string;
  suggestedDuration: number;
}

const CLEAN_JSON_FENCES_REGEX = /```(?:json)?\s*|\s*```/gi;

const getApiKey = (): string =>
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  localStorage.getItem('rhetor_api_key') ||
  '';

const clampDuration = (seconds: number): number => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 60;
  return Math.max(30, Math.min(Math.round(seconds), 600));
};

export async function extractTalkingPointsFromText(text: string): Promise<GeneratedTalkingPoints> {
  const source = text.trim();
  if (!source) {
    throw new Error('No text provided');
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key found');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Extract 3-6 key talking points from this text. Return ONLY valid JSON with no markdown fencing:\n{"hook": "one compelling opening sentence", "bullets": ["short talking point 5-10 words each"], "closing": "one strong closing sentence", "suggestedDuration": <number in seconds>}\n\nText:\n${source}`,
          },
        ],
      },
    ],
  });

  const raw = (response as any).text ?? '';
  const cleaned = raw.replace(CLEAN_JSON_FENCES_REGEX, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<GeneratedTalkingPoints>;

  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.map((bullet) => String(bullet ?? '').trim()).filter((bullet) => bullet.length > 0)
    : [];

  return {
    hook: String(parsed.hook ?? '').trim(),
    bullets,
    closing: String(parsed.closing ?? '').trim(),
    suggestedDuration: clampDuration(Number(parsed.suggestedDuration ?? 60)),
  };
}
