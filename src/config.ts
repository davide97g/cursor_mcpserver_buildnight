export type ProviderName = "Exa" | "fal.ai" | "ElevenLabs" | "Unsplash";

const envNames = {
  Exa: "EXA_API_KEY",
  "fal.ai": "FAL_KEY",
  ElevenLabs: "ELEVENLABS_API_KEY",
  Unsplash: "UNSPLASH_ACCESS_KEY",
} satisfies Record<ProviderName, string>;

export function requireApiKey(provider: ProviderName): string {
  const envName = envNames[provider];
  const value = process.env[envName];

  if (!value) {
    throw new Error(
      `${envName} is required for ${provider}. Copy .env.example to .env and add your workshop credit key.`
    );
  }

  return value;
}

export function elevenLabsVoiceId(override?: string): string {
  return (
    override ||
    process.env.ELEVENLABS_VOICE_ID ||
    "TX3LPaxmHKxFdv7VOQHJ"
  );
}

export function imageProvider(): "unsplash" | "fal" | "placeholder" {
  const provider = process.env.IMAGE_PROVIDER?.toLowerCase();

  if (provider === "fal") {
    return "fal";
  }

  if (provider === "unsplash") {
    return "unsplash";
  }

  if (provider === "placeholder") {
    return "placeholder";
  }

  if (process.env.FAL_KEY?.trim()) {
    return "fal";
  }

  if (process.env.UNSPLASH_ACCESS_KEY?.trim()) {
    return "unsplash";
  }

  return "placeholder";
}

export function judgeProvider(): "heuristic" | "llm" {
  const provider = process.env.JUDGE_PROVIDER?.toLowerCase();

  if (provider === "llm" || provider === "openai") {
    return "llm";
  }

  return "heuristic";
}

export function judgeApiKey(): string | undefined {
  return (
    process.env.JUDGE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

export function judgeBaseUrl(): string {
  return (
    process.env.JUDGE_BASE_URL?.trim() || "https://api.moonshot.ai/v1"
  );
}

export function judgeModel(): string {
  return (
    process.env.JUDGE_MODEL?.trim() || "kimi-k2.7-code-highspeed"
  );
}

export function ttsProvider(): "openai" | "elevenlabs" {
  const provider = process.env.TTS_PROVIDER?.toLowerCase();

  if (provider === "elevenlabs") {
    return "elevenlabs";
  }

  if (provider === "openai") {
    return "openai";
  }

  if (process.env.OPENAI_TTS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }

  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    return "elevenlabs";
  }

  return "openai";
}

export function openAiTtsConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_TTS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}
