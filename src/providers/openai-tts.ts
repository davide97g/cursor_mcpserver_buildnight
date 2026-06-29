import type { VoiceoverResult } from "../types";

function openAiTtsApiKey(): string | undefined {
  return (
    process.env.OPENAI_TTS_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim()
  );
}

function openAiTtsVoice(override?: string): string {
  return override || process.env.OPENAI_TTS_VOICE?.trim() || "onyx";
}

function openAiTtsModel(): string {
  return process.env.OPENAI_TTS_MODEL?.trim() || "tts-1-hd";
}

function conciseTtsError(status: number, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const message = parsed.error?.message || errorText;
    const code = parsed.error?.code || parsed.error?.type;
    return code ? `${message} (${code})` : message;
  } catch {
    return errorText || `OpenAI TTS failed (${status})`;
  }
}

export async function generateOpenAiVoiceover(input: {
  script: string;
  voiceId?: string;
  language: string;
}): Promise<VoiceoverResult> {
  const apiKey = openAiTtsApiKey();
  const voice = openAiTtsVoice(input.voiceId);
  const model = openAiTtsModel();

  if (!apiKey) {
    return {
      status: "unavailable",
      script: input.script,
      audioUrl: "",
      voiceId: voice,
      language: input.language,
      error:
        "OPENAI_API_KEY is required for OpenAI TTS. Copy .env.example to .env and add your key.",
    };
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: input.script,
      voice,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    return {
      status: "unavailable",
      script: input.script,
      audioUrl: "",
      voiceId: voice,
      language: input.language,
      error: `OpenAI TTS unavailable: ${conciseTtsError(
        response.status,
        await response.text()
      )}`,
    };
  }

  const audio = Buffer.from(await response.arrayBuffer()).toString("base64");

  return {
    status: "generated",
    script: input.script,
    audioUrl: `data:audio/mpeg;base64,${audio}`,
    voiceId: voice,
    language: input.language,
  };
}
