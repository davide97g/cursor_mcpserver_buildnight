import type { PromoKit } from "./types";

export type EvaluationScore = {
  name: string;
  value: number;
  comment: string;
};

export type PromoKitEvaluation = {
  judge: "heuristic" | "llm";
  overallScore: number;
  verdict: "excellent" | "good" | "needs_work";
  scores: EvaluationScore[];
  strengths: string[];
  improvements: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function includesAny(text: string, terms: string[]): boolean {
  const lowered = text.toLowerCase();
  return terms.some((term) => lowered.includes(term.toLowerCase()));
}

function average(scores: EvaluationScore[]): number {
  return clampScore(
    scores.reduce((sum, score) => sum + score.value, 0) / scores.length
  );
}

function verdictFor(score: number): PromoKitEvaluation["verdict"] {
  if (score >= 0.82) return "excellent";
  if (score >= 0.62) return "good";
  return "needs_work";
}

function toneFitScore(input: {
  declaredTone: string;
  topic: string;
  audience: string;
}): number {
  const tone = input.declaredTone.toLowerCase();
  const context = `${input.topic} ${input.audience}`.toLowerCase();
  const practicalMatch = includesAny(context, [
    "developer",
    "builder",
    "build night",
    "workshop",
  ]);
  const beginnerMatch = includesAny(context, [
    "student",
    "beginner",
    "learn",
  ]);
  const urgencyMatch = includesAny(context, [
    "tournament",
    "opening",
    "launch",
    "this weekend",
  ]);

  if (includesAny(tone, ["practical", "hands-on"]) && practicalMatch) {
    return 1;
  }

  if (includesAny(tone, ["friendly", "beginner"]) && beginnerMatch) {
    return 0.94;
  }

  if (includesAny(tone, ["bold", "urgent"]) && urgencyMatch) {
    return 0.9;
  }

  return 0.72;
}

export function evaluateWithHeuristics(input: {
  promoKit: PromoKit;
  topic: string;
  audience: string;
  location: string;
}): PromoKitEvaluation {
  const { promoKit, topic, audience, location } = input;
  const combined = [
    promoKit.title,
    promoKit.positioning,
    promoKit.captions.join(" "),
    promoKit.voiceover.script,
  ].join(" ");
  const declaredTone =
    promoKit.positioning.match(/Tone:\s*([^.]*)/i)?.[1]?.trim() || "";

  const hasTopic = includesAny(combined, [topic]);
  const hasAudience = includesAny(combined, [audience]);
  const hasLocation = includesAny(combined, [location]);
  const sources = promoKit.research.sources ?? [];
  const validSources = sources.filter((source) => source.url.startsWith("http"));
  const captions = promoKit.captions ?? [];
  const hasVisual = Boolean(promoKit.poster.imageUrl);
  const hasVoiceScript = promoKit.voiceover.script.length > 20;
  const ctaTerms = ["join", "bring", "save", "reserve", "rsvp", "sign up"];

  const scores: EvaluationScore[] = [
    {
      name: "brief_fit",
      value: clampScore(
        [hasTopic, hasAudience, hasLocation].filter(Boolean).length / 3
      ),
      comment: "Checks whether the output reflects topic, audience, and location.",
    },
    {
      name: "grounding",
      value: clampScore(Math.min(validSources.length / 3, 1)),
      comment: "Rewards source-backed research that can be inspected.",
    },
    {
      name: "asset_completeness",
      value: clampScore(
        [captions.length >= 3, hasVisual, hasVoiceScript].filter(Boolean)
          .length / 3
      ),
      comment: "Checks captions, visual asset, and voice script coverage.",
    },
    {
      name: "actionability",
      value: clampScore(includesAny(combined, ctaTerms) ? 0.9 : 0.45),
      comment: "Looks for a simple next action a human could take.",
    },
    {
      name: "tone_fit",
      value: clampScore(
        toneFitScore({
          declaredTone,
          topic,
          audience,
        })
      ),
      comment:
        "Checks whether the tone matches the audience and campaign context.",
    },
    {
      name: "demo_resilience",
      value: promoKit.voiceover.status === "generated" ? 1 : 0.72,
      comment:
        "Voice generation is ideal, but an unavailable voice should not break the kit.",
    },
  ];

  const overallScore = average(scores);
  const strengths = [
    validSources.length > 0
      ? `Grounded in ${validSources.length} web source(s).`
      : "Has a clear campaign structure.",
    hasVisual
      ? `Includes a ${promoKit.poster.provider} visual asset.`
      : "Keeps visual direction explicit.",
    captions.length >= 3
      ? "Includes multiple ready-to-use captions."
      : "Captions can be expanded.",
  ];
  const improvements = [
    promoKit.voiceover.status === "generated"
      ? "Try A/B testing the voiceover script against another tone."
      : "Configure OpenAI TTS with OPENAI_API_KEY to produce audio.",
    validSources.length >= 3
      ? "Turn the best source insight into a sharper headline."
      : "Add more research sources for stronger grounding.",
  ];

  return {
    judge: "heuristic",
    overallScore,
    verdict: verdictFor(overallScore),
    scores,
    strengths,
    improvements,
  };
}

export async function evaluateWithLlm(input: {
  promoKit: PromoKit;
  topic: string;
  audience: string;
  location: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<PromoKitEvaluation> {
  const prompt = `You are an LLM-as-a-judge evaluator for a workshop demo.
Evaluate this promo kit for the requested brief.

Brief:
- Topic: ${input.topic}
- Audience: ${input.audience}
- Location: ${input.location}

Return strict JSON with:
{
  "overallScore": number from 0 to 1,
  "verdict": "excellent" | "good" | "needs_work",
  "scores": [{"name": string, "value": number from 0 to 1, "comment": string}],
  "strengths": string[],
  "improvements": string[]
}

Promo kit:
${JSON.stringify(input.promoKit, null, 2)}`;

  const endpoint = `${input.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You grade marketing outputs. Be strict but practical. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LLM judge failed (${response.status}): ${await response.text()}`
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM judge returned no content.");
  }

  const parsed = JSON.parse(content) as Omit<PromoKitEvaluation, "judge">;

  return {
    judge: "llm",
    overallScore: clampScore(parsed.overallScore),
    verdict: parsed.verdict,
    scores: parsed.scores.map((score) => ({
      ...score,
      value: clampScore(score.value),
    })),
    strengths: parsed.strengths,
    improvements: parsed.improvements,
  };
}
