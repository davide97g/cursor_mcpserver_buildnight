import { ttsProvider } from "../config";
import { generateVoiceover as generateElevenLabsVoiceover } from "./elevenlabs";
import { generateOpenAiVoiceover } from "./openai-tts";

export { ttsProvider } from "../config";

export async function generateVoiceover(input: {
  script: string;
  voiceId?: string;
  language: string;
}) {
  if (ttsProvider() === "elevenlabs") {
    return generateElevenLabsVoiceover(input);
  }

  return generateOpenAiVoiceover(input);
}
