import { MCPServer, object } from "mcp-use/server";
import { z } from "zod";
import {
  evaluateWithHeuristics,
  evaluateWithOpenAI,
} from "./src/evaluation";
import { imageProvider } from "./src/config";
import { generateVoiceover as createVoiceover } from "./src/providers/elevenlabs";
import { researchMarket as searchMarket } from "./src/providers/exa";
import { createCampaignVisual } from "./src/providers/images";
import { sendEvaluationToLangfuse } from "./src/providers/langfuse";
import type { PromoKit } from "./src/types";

try {
  process.loadEnvFile?.(".env");
} catch {
  // .env is optional. direnv or the parent shell can provide variables instead.
}

const server = new MCPServer({
  name: "promo-kit-mcp-finished",
  title: "Davide Youtube Promo Kit",
  version: "1.0.0",
  description:
    "Davide Youtube Promo Kit — generate and benchmark research-backed promo kits with Exa, Unsplash or fal.ai, ElevenLabs, and Langfuse.",
  instructions:
    "Use create_and_evaluate_promo_kit for the best workshop demo. Use create_promo_kit for generation only, evaluate_promo_kit for judging an existing kit, and individual tools for research-only, poster-only, or voiceover-only requests.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://manufact.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  summary: z.string(),
});

const researchSchema = z.object({
  topic: z.string(),
  audience: z.string(),
  location: z.string(),
  angle: z.string(),
  insights: z.array(z.string()),
  sources: z.array(sourceSchema),
});

const posterSchema = z.object({
  provider: z.enum(["fal", "unsplash", "placeholder"]),
  prompt: z.string(),
  imageUrl: z.string(),
  visualStyle: z.string(),
  format: z.string(),
  sourceUrl: z.string().optional(),
  photographerName: z.string().optional(),
  photographerUrl: z.string().optional(),
  attribution: z.string().optional(),
});

const voiceoverSchema = z.object({
  status: z.enum(["generated", "unavailable"]),
  script: z.string(),
  audioUrl: z.string(),
  voiceId: z.string(),
  language: z.string(),
  error: z.string().optional(),
});

const promoKitSchema = z.object({
  title: z.string(),
  positioning: z.string(),
  captions: z.array(z.string()),
  research: researchSchema,
  poster: posterSchema,
  voiceover: voiceoverSchema,
});

const evaluationScoreSchema = z.object({
  name: z.string(),
  value: z.number(),
  comment: z.string(),
});

const evaluationSchema = z.object({
  judge: z.enum(["heuristic", "openai"]),
  overallScore: z.number(),
  verdict: z.enum(["excellent", "good", "needs_work"]),
  scores: z.array(evaluationScoreSchema),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

const langfuseSchema = z.object({
  enabled: z.boolean(),
  sent: z.boolean(),
  dryRun: z.boolean(),
  traceId: z.string().optional(),
  host: z.string().optional(),
  traceName: z.string().optional(),
  scoreNames: z.array(z.string()).optional(),
  scoreCount: z.number().optional(),
  note: z.string().optional(),
  error: z.string().optional(),
});

const benchmarkSchema = z.object({
  promoKit: promoKitSchema,
  evaluation: evaluationSchema,
  langfuse: langfuseSchema,
});

const benchmarkSuiteComparisonSchema = z.object({
  rank: z.number(),
  variant: z.string(),
  tone: z.string(),
  title: z.string(),
  overallScore: z.number(),
  verdict: z.enum(["excellent", "good", "needs_work"]),
  briefFit: z.number(),
  grounding: z.number(),
  assetCompleteness: z.number(),
  actionability: z.number(),
  toneFit: z.number(),
  demoResilience: z.number(),
  visualProvider: z.enum(["fal", "unsplash", "placeholder"]),
  voiceStatus: z.enum(["generated", "unavailable"]),
  langfuseTraceId: z.string().optional(),
  recommendation: z.string(),
});

const benchmarkSuiteSchema = z.object({
  topic: z.string(),
  audience: z.string(),
  location: z.string(),
  winner: z.string(),
  comparison: z.array(benchmarkSuiteComparisonSchema),
  candidates: z.array(
    z.object({
      variant: z.string(),
      tone: z.string(),
      promoKit: promoKitSchema,
      evaluation: evaluationSchema,
      langfuse: langfuseSchema,
    })
  ),
});

const setupProviderSchema = z.object({
  name: z.string(),
  envVar: z.string(),
  configured: z.boolean(),
  required: z.boolean(),
  note: z.string(),
});

const setupStatusSchema = z.object({
  imageProvider: z.enum(["unsplash", "fal"]),
  judgeProvider: z.enum(["heuristic", "openai"]),
  demoReady: z.boolean(),
  missingRequired: z.array(z.string()),
  providers: z.array(setupProviderSchema),
  warnings: z.array(z.string()),
});

const workshopFlowSchema = z.object({
  title: z.string(),
  audience: z.string(),
  recommendedPath: z.array(z.string()),
  steps: z.array(
    z.object({
      step: z.number(),
      title: z.string(),
      tool: z.string(),
      why: z.string(),
      prompt: z.string(),
      expected: z.string(),
    })
  ),
  demoPresets: z.array(z.string()),
});

const presetIdSchema = z.enum([
  "cursor-build-night-padova",
  "student-ai-build-night-rome",
  "matcha-cafe-university",
  "indie-game-tournament",
]);

const presets = {
  "cursor-build-night-padova": {
    label: "Cursor Build Night Padova",
    topic: "cursor build night",
    audience: "developers",
    location: "Padova, Italy",
    tone: "energetic and practical",
  },
  "student-ai-build-night-rome": {
    label: "Student AI Build Night Rome",
    topic: "student AI build night",
    audience: "students and beginner builders",
    location: "Rome, Italy",
    tone: "friendly and practical",
  },
  "matcha-cafe-university": {
    label: "Matcha Cafe University Launch",
    topic: "matcha cafe opening",
    audience: "university students",
    location: "Milan, Italy",
    tone: "warm and social",
  },
  "indie-game-tournament": {
    label: "Indie Game Tournament",
    topic: "indie game tournament",
    audience: "local gamers and developers",
    location: "Padova, Italy",
    tone: "playful and energetic",
  },
} satisfies Record<
  z.infer<typeof presetIdSchema>,
  {
    label: string;
    topic: string;
    audience: string;
    location: string;
    tone: string;
  }
>;

function isConfigured(envVar: string): boolean {
  return Boolean(process.env[envVar]?.trim());
}

function buildSetupStatus(): z.infer<typeof setupStatusSchema> {
  const selectedImageProvider = imageProvider();
  const selectedJudgeProvider =
    process.env.JUDGE_PROVIDER?.toLowerCase() === "openai"
      ? "openai"
      : "heuristic";

  const providers = [
    {
      name: "Exa",
      envVar: "EXA_API_KEY",
      configured: isConfigured("EXA_API_KEY"),
      required: true,
      note: "Required for live market research.",
    },
    {
      name: "Unsplash",
      envVar: "UNSPLASH_ACCESS_KEY",
      configured: isConfigured("UNSPLASH_ACCESS_KEY"),
      required: selectedImageProvider === "unsplash",
      note: "Required when IMAGE_PROVIDER=unsplash.",
    },
    {
      name: "fal.ai",
      envVar: "FAL_KEY",
      configured: isConfigured("FAL_KEY"),
      required: selectedImageProvider === "fal",
      note: "Only required when IMAGE_PROVIDER=fal.",
    },
    {
      name: "ElevenLabs",
      envVar: "ELEVENLABS_API_KEY",
      configured: isConfigured("ELEVENLABS_API_KEY"),
      required: false,
      note: "Optional for workshop flow; unavailable audio keeps the script.",
    },
    {
      name: "OpenAI judge",
      envVar: "OPENAI_API_KEY",
      configured: isConfigured("OPENAI_API_KEY"),
      required: selectedJudgeProvider === "openai",
      note: "Only required when JUDGE_PROVIDER=openai.",
    },
    {
      name: "Langfuse public key",
      envVar: "LANGFUSE_PUBLIC_KEY",
      configured: isConfigured("LANGFUSE_PUBLIC_KEY"),
      required: false,
      note: "Optional observability for traces and scores.",
    },
    {
      name: "Langfuse secret key",
      envVar: "LANGFUSE_SECRET_KEY",
      configured: isConfigured("LANGFUSE_SECRET_KEY"),
      required: false,
      note: "Optional observability for traces and scores.",
    },
  ];

  const missingRequired = providers
    .filter((provider) => provider.required && !provider.configured)
    .map((provider) => provider.envVar);

  const warnings = [
    !isConfigured("ELEVENLABS_API_KEY")
      ? "ElevenLabs is not configured, so voiceover tools will return a script with status unavailable."
      : "",
    isConfigured("ELEVENLABS_API_KEY")
      ? "ElevenLabs account tier, selected voice, or remaining credits may still prevent audio generation."
      : "",
    !isConfigured("LANGFUSE_PUBLIC_KEY") || !isConfigured("LANGFUSE_SECRET_KEY")
      ? "Langfuse is optional and currently disabled; benchmark results still return locally."
      : "",
  ].filter(Boolean);

  return {
    imageProvider: selectedImageProvider,
    judgeProvider: selectedJudgeProvider,
    demoReady: missingRequired.length === 0,
    missingRequired,
    providers,
    warnings,
  };
}

function buildWorkshopFlow(): z.infer<typeof workshopFlowSchema> {
  return {
    title: "Davide Youtube Promo Kit Workshop Flow",
    audience: "Non-technical attendees, developers, and Cursor Agent users",
    recommendedPath: [
      "Call check_setup to confirm the local server and provider keys.",
      "Call list_demo_presets to show that enum inputs become dropdown-style choices.",
      "Call run_demo_preset with cursor-build-night-padova for the safest live demo.",
      "Call create_and_evaluate_promo_kit with a custom brief to show agent orchestration.",
      "Call run_benchmark_suite to compare three tone variants and send multiple judge traces to Langfuse.",
      "Open Langfuse if configured, or explain langfuse.sent=false as the local fallback path.",
    ],
    steps: [
      {
        step: 1,
        title: "Readiness check",
        tool: "check_setup",
        why: "Shows which providers are active without exposing secrets.",
        prompt: "Run check_setup.",
        expected:
          "demoReady=true when Exa and the selected image provider are configured.",
      },
      {
        step: 2,
        title: "Dropdown demo",
        tool: "list_demo_presets",
        why: "Shows attendees that MCP schemas can create easy choices, not only free-text boxes.",
        prompt: "List the demo presets.",
        expected:
          "Four ready-to-run campaign scenarios, including cursor-build-night-padova.",
      },
      {
        step: 3,
        title: "One-click showcase",
        tool: "run_demo_preset",
        why: "Runs Exa, Unsplash, ElevenLabs fallback, the judge, and Langfuse status in one call.",
        prompt: "Run the cursor-build-night-padova preset.",
        expected:
          "A complete promo kit with research, visual, voiceover status, judge score, and Langfuse status.",
      },
      {
        step: 4,
        title: "Custom brief",
        tool: "create_and_evaluate_promo_kit",
        why: "Shows how attendees can adapt the same MCP server to their own product or event.",
        prompt:
          "Create and evaluate a promo kit for a matcha cafe opening near a university.",
        expected:
          "A custom kit plus rubric scores that make output quality inspectable.",
      },
      {
        step: 5,
        title: "Benchmark suite",
        tool: "run_benchmark_suite",
        why: "Shows the LLM-as-a-judge idea as a comparison workflow, not only a single score.",
        prompt:
          "Run a benchmark suite for a Cursor build night in Padova using three tone variants.",
        expected:
          "A ranked comparison table with judge scores, a winner, and Langfuse trace IDs for each candidate.",
      },
      {
        step: 6,
        title: "Benchmarking story",
        tool: "evaluate_promo_kit",
        why: "Shows the LLM-as-a-judge idea separately from asset generation.",
        prompt:
          "Evaluate this promo kit JSON and explain the strongest and weakest rubric scores.",
        expected:
          "Traceable scores locally, and Langfuse scores when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.",
      },
    ],
    demoPresets: Object.keys(presets),
  };
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] || "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function indefiniteArticle(phrase: string): "A" | "An" {
  return /^[aeiou]/i.test(phrase.trim()) ? "An" : "A";
}

function toneQualities(tone: string): string {
  const qualities = tone
    .split(/\s*(?:,|\band\b)\s*/i)
    .map((quality) => quality.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped = qualities.filter((quality) => {
    const key = quality.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  if (!deduped.some((quality) => quality.toLowerCase() === "practical")) {
    deduped.push("practical");
  }

  return formatList(deduped);
}

function voiceScript(input: {
  topic: string;
  audience: string;
  location: string;
  tone: string;
}): string {
  return [
    `This week in ${input.location}, ${input.topic} is built for ${input.audience}.`,
    `Expect something ${toneQualities(input.tone)}, built to be easy to share.`,
    "Bring one friend, show up curious, and leave with something worth talking about.",
  ].join(" ");
}

async function buildPromoKit(input: {
  topic: string;
  audience: string;
  location: string;
  tone: string;
}): Promise<PromoKit> {
  const research = await searchMarket({
    topic: input.topic,
    audience: input.audience,
    location: input.location,
    maxResults: 3,
  });

  const positioning = `${research.angle}. Tone: ${input.tone}.`;
  const poster = await createCampaignVisual({
    brief: `${input.topic} for ${input.audience} in ${input.location}. ${research.angle}.`,
    visualStyle:
      "bold editorial poster, local city energy, confident typography space, premium but approachable",
    format: "square social post",
  });

  const script = voiceScript(input);
  const voiceover = await createVoiceover({
    script,
    language: "en",
  });

  return {
    title: `${input.topic} Promo Kit`,
    positioning,
    captions: [
      `${input.topic} lands in ${input.location}. Bring a friend and make the night count.`,
      `${indefiniteArticle(toneQualities(input.tone))} ${toneQualities(
        input.tone
      )} campaign for ${input.audience}: ${input.topic}.`,
      `Save this: ${input.topic} is your next ${input.location} move.`,
    ],
    research,
    poster,
    voiceover,
  };
}

async function judgePromoKit(input: {
  promoKit: PromoKit;
  topic: string;
  audience: string;
  location: string;
}) {
  const provider = process.env.JUDGE_PROVIDER?.toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;

  if (provider === "openai" && apiKey) {
    try {
      return await evaluateWithOpenAI({
        ...input,
        apiKey,
        model: process.env.JUDGE_MODEL || "gpt-4o-mini",
      });
    } catch {
      return evaluateWithHeuristics(input);
    }
  }

  return evaluateWithHeuristics(input);
}

function scoreValue(
  evaluation: z.infer<typeof evaluationSchema>,
  name: string
): number {
  return (
    evaluation.scores.find((score) => score.name === name)?.value ?? 0
  );
}

function recommendationFor(input: {
  rank: number;
  evaluation: z.infer<typeof evaluationSchema>;
  tone: string;
}): string {
  if (input.rank === 1) {
    return `Lead with this ${input.tone} variant; it scored highest overall.`;
  }

  const weakest = [...input.evaluation.scores].sort(
    (a, b) => a.value - b.value
  )[0];

  return `Improve ${weakest.name.replace(
    /_/g,
    " "
  )} before using this ${input.tone} variant.`;
}

server.tool(
  {
    name: "check_setup",
    description:
      "Check which workshop provider keys are configured without exposing secret values.",
    schema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    outputSchema: setupStatusSchema,
  },
  async () => object(buildSetupStatus())
);

server.tool(
  {
    name: "get_workshop_flow",
    description:
      "Return the recommended live-demo sequence for the Davide Youtube Promo Kit workshop.",
    schema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    outputSchema: workshopFlowSchema,
  },
  async () => object(buildWorkshopFlow())
);

server.tool(
  {
    name: "list_demo_presets",
    description:
      "List ready-to-run workshop scenarios for non-technical users testing the MCP server.",
    schema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    outputSchema: z.object({
      presets: z.array(
        z.object({
          id: presetIdSchema,
          label: z.string(),
          topic: z.string(),
          audience: z.string(),
          location: z.string(),
          tone: z.string(),
        })
      ),
    }),
  },
  async () => {
    return object({
      presets: Object.entries(presets).map(([id, preset]) => ({
        id,
        ...preset,
      })),
    });
  }
);

server.tool(
  {
    name: "run_demo_preset",
    description:
      "Run a complete generate-and-evaluate demo from a dropdown preset.",
    schema: z.object({
      preset: presetIdSchema.describe("Ready-to-run workshop scenario"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: benchmarkSchema,
  },
  async ({ preset }) => {
    const selected = presets[preset];
    const promoKit = await buildPromoKit(selected);
    const evaluation = await judgePromoKit({
      promoKit,
      topic: selected.topic,
      audience: selected.audience,
      location: selected.location,
    });
    const langfuse = await sendEvaluationToLangfuse({
      promoKit,
      evaluation,
      topic: selected.topic,
      audience: selected.audience,
      location: selected.location,
    });

    return object({ promoKit, evaluation, langfuse });
  }
);

server.tool(
  {
    name: "research_market",
    description:
      "Use Exa to research a campaign topic, target audience, and location.",
    schema: z.object({
      topic: z.string().describe("Campaign topic, event, or product"),
      audience: z.string().describe("Target audience"),
      location: z.string().describe("Target city or region"),
      maxResults: z.number().min(1).max(8).default(3),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: researchSchema,
  },
  async ({ topic, audience, location, maxResults }) => {
    return object(
      await searchMarket({
        topic,
        audience,
        location,
        maxResults,
      })
    );
  }
);

server.tool(
  {
    name: "generate_poster",
    description:
      "Create a campaign visual. Defaults to Unsplash stock imagery; set IMAGE_PROVIDER=fal to use fal.ai generation.",
    schema: z.object({
      brief: z.string().describe("Creative brief for the poster"),
      visualStyle: z
        .string()
        .default("bold editorial poster, energetic, local, high contrast"),
      format: z.string().default("square social post"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: posterSchema,
  },
  async ({ brief, visualStyle, format }) => {
    return object(await createCampaignVisual({ brief, visualStyle, format }));
  }
);

server.tool(
  {
    name: "generate_voiceover",
    description: "Use ElevenLabs to generate a short spoken voice ad.",
    schema: z.object({
      script: z.string().describe("Short spoken ad script"),
      voiceId: z
        .string()
        .optional()
        .describe("Optional ElevenLabs voice ID; falls back to ELEVENLABS_VOICE_ID"),
      language: z.string().default("en"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: voiceoverSchema,
  },
  async ({ script, voiceId, language }) => {
    return object(await createVoiceover({ script, voiceId, language }));
  }
);

server.tool(
  {
    name: "create_promo_kit",
    description:
      "Create a complete promo kit with Exa research, Unsplash or fal.ai campaign visuals, and ElevenLabs voiceover.",
    schema: z.object({
      topic: z.string().describe("Campaign topic, event, or product"),
      audience: z.string().describe("Target audience"),
      location: z.string().describe("Target city or region"),
      tone: z.string().default("energetic and practical"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: promoKitSchema,
  },
  async ({ topic, audience, location, tone }) => {
    return object(await buildPromoKit({ topic, audience, location, tone }));
  }
);

server.tool(
  {
    name: "evaluate_promo_kit",
    description:
      "Judge an existing promo kit with an LLM-as-a-judge style rubric and optionally send scores to Langfuse.",
    schema: z.object({
      topic: z.string().describe("Original campaign topic"),
      audience: z.string().describe("Original target audience"),
      location: z.string().describe("Original target city or region"),
      promoKitJson: z
        .string()
        .describe("JSON string returned by create_promo_kit"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: z.object({
      evaluation: evaluationSchema,
      langfuse: langfuseSchema,
    }),
  },
  async ({ topic, audience, location, promoKitJson }) => {
    const promoKit = JSON.parse(promoKitJson) as PromoKit;
    const evaluation = await judgePromoKit({
      promoKit,
      topic,
      audience,
      location,
    });
    const langfuse = await sendEvaluationToLangfuse({
      promoKit,
      evaluation,
      topic,
      audience,
      location,
    });

    return object({ evaluation, langfuse });
  }
);

server.tool(
  {
    name: "create_and_evaluate_promo_kit",
    description:
      "Create a complete promo kit, run an LLM-as-a-judge style benchmark, and optionally send the trace and scores to Langfuse.",
    schema: z.object({
      topic: z.string().describe("Campaign topic, event, or product"),
      audience: z.string().describe("Target audience"),
      location: z.string().describe("Target city or region"),
      tone: z.string().default("energetic and practical"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: benchmarkSchema,
  },
  async ({ topic, audience, location, tone }) => {
    const promoKit = await buildPromoKit({ topic, audience, location, tone });
    const evaluation = await judgePromoKit({
      promoKit,
      topic,
      audience,
      location,
    });
    const langfuse = await sendEvaluationToLangfuse({
      promoKit,
      evaluation,
      topic,
      audience,
      location,
    });

    return object({ promoKit, evaluation, langfuse });
  }
);

server.tool(
  {
    name: "run_benchmark_suite",
    description:
      "Generate 2-3 promo kit variants, judge them with the same rubric, send each result to Langfuse, and return a ranked comparison table.",
    schema: z.object({
      topic: z.string().describe("Campaign topic, event, or product"),
      audience: z.string().describe("Target audience"),
      location: z.string().describe("Target city or region"),
      tones: z
        .array(z.string())
        .min(2)
        .max(3)
        .default([
          "energetic and practical",
          "friendly and beginner-safe",
          "bold and urgent",
        ])
        .describe("Two or three tone variants to compare"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: benchmarkSuiteSchema,
  },
  async ({ topic, audience, location, tones }) => {
    const candidates = [];

    for (const [index, tone] of tones.entries()) {
      const variant = `variant_${index + 1}`;
      const promoKit = await buildPromoKit({
        topic,
        audience,
        location,
        tone,
      });
      const evaluation = await judgePromoKit({
        promoKit,
        topic,
        audience,
        location,
      });
      const langfuse = await sendEvaluationToLangfuse({
        promoKit,
        evaluation,
        topic,
        audience,
        location,
      });

      candidates.push({ variant, tone, promoKit, evaluation, langfuse });
    }

    const ranked = [...candidates].sort(
      (a, b) => b.evaluation.overallScore - a.evaluation.overallScore
    );
    const comparison = ranked.map((candidate, index) => {
      const rank = index + 1;

      return {
        rank,
        variant: candidate.variant,
        tone: candidate.tone,
        title: candidate.promoKit.title,
        overallScore: candidate.evaluation.overallScore,
        verdict: candidate.evaluation.verdict,
        briefFit: scoreValue(candidate.evaluation, "brief_fit"),
        grounding: scoreValue(candidate.evaluation, "grounding"),
        assetCompleteness: scoreValue(
          candidate.evaluation,
          "asset_completeness"
        ),
        actionability: scoreValue(candidate.evaluation, "actionability"),
        toneFit: scoreValue(candidate.evaluation, "tone_fit"),
        demoResilience: scoreValue(candidate.evaluation, "demo_resilience"),
        visualProvider: candidate.promoKit.poster.provider,
        voiceStatus: candidate.promoKit.voiceover.status,
        langfuseTraceId: candidate.langfuse.traceId,
        recommendation: recommendationFor({
          rank,
          evaluation: candidate.evaluation,
          tone: candidate.tone,
        }),
      };
    });

    return object({
      topic,
      audience,
      location,
      winner: comparison[0]?.variant ?? "",
      comparison,
      candidates,
    });
  }
);

server.listen().then(() => {
  console.log("Davide Youtube Promo Kit running");
});
