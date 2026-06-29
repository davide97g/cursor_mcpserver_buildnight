import { MCPServer, object } from "mcp-use/server";
import { z } from "zod";
import {
  evaluateWithHeuristics,
  evaluateWithLlm,
} from "./src/evaluation";
import {
  imageProvider,
  judgeApiKey,
  judgeBaseUrl,
  judgeModel,
  judgeProvider,
  openAiTtsConfigured,
  ttsProvider,
} from "./src/config";
import { generateVoiceover as createVoiceover } from "./src/providers/voiceover";
import { researchMarket as searchMarket } from "./src/providers/exa";
import { createCampaignVisual } from "./src/providers/images";
import {
  createNewsBroadcast,
  getLatestNews,
  newsCategories,
  newsCategoryIds,
} from "./src/providers/news-broadcast";
import { sendEvaluationToLangfuse } from "./src/providers/langfuse";
import {
  designYoutubeIntro,
  introStyleIds,
  introStyles,
  researchYoutubeIntroTrends,
} from "./src/providers/youtube-intro";
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
    "Davide Youtube Promo Kit — generate and benchmark research-backed promo kits with Exa, fal.ai or placeholder visuals, OpenAI TTS, and Langfuse.",
  instructions:
    "Use create_news_broadcast when the user wants a TV-style news intro with latest headlines, anchor voiceover, and image slides. Use create_and_evaluate_promo_kit for the best workshop promo demo. Use design_youtube_intro when the user wants a YouTube channel intro concept with shot list, colors, hero frame, and spoken hook. Use fetch_latest_news for headlines only without slides or voice. Use create_promo_kit for generation only, evaluate_promo_kit for judging an existing kit, and individual tools for research-only, poster-only, or voiceover-only requests.",
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
  judge: z.enum(["heuristic", "llm"]),
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

const introStyleSchema = z.enum(introStyleIds);

const introResearchSchema = z.object({
  channelName: z.string(),
  niche: z.string(),
  audience: z.string(),
  style: introStyleSchema,
  angle: z.string(),
  insights: z.array(z.string()),
  sources: z.array(sourceSchema),
});

const introShotSchema = z.object({
  second: z.number(),
  duration: z.number(),
  visual: z.string(),
  textOverlay: z.string().optional(),
  motion: z.string(),
});

const youtubeIntroSchema = z.object({
  title: z.string(),
  channelName: z.string(),
  niche: z.string(),
  audience: z.string(),
  style: introStyleSchema,
  styleLabel: z.string(),
  durationSeconds: z.number(),
  hookLine: z.string(),
  tagline: z.string(),
  shotList: z.array(introShotSchema),
  typography: z.object({
    headlineFont: z.string(),
    bodyFont: z.string(),
    treatment: z.string(),
  }),
  colorPalette: z.array(z.string()),
  soundDirection: z.object({
    mood: z.string(),
    tempo: z.string(),
    sfxNotes: z.string(),
  }),
  subscribeMoment: z.string(),
  productionNotes: z.array(z.string()),
  research: introResearchSchema,
  thumbnailConcept: posterSchema,
  voiceover: voiceoverSchema,
});

const newsCategorySchema = z.enum(newsCategoryIds);

const newsStorySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  source: sourceSchema,
});

const latestNewsSchema = z.object({
  category: z.string(),
  region: z.string(),
  fetchedAt: z.string(),
  stories: z.array(newsStorySchema),
});

const newsSlideSchema = z.object({
  slideNumber: z.number(),
  type: z.enum(["opening", "story", "closing"]),
  headline: z.string(),
  onScreenText: z.string(),
  anchorLine: z.string(),
  image: posterSchema,
  source: sourceSchema.optional(),
});

const newsBroadcastSchema = z.object({
  title: z.string(),
  showName: z.string(),
  category: z.string(),
  region: z.string(),
  broadcastDate: z.string(),
  openingLine: z.string(),
  closingLine: z.string(),
  slides: z.array(newsSlideSchema),
  fullScript: z.string(),
  voiceover: voiceoverSchema,
  sources: z.array(sourceSchema),
  productionNotes: z.array(z.string()),
});

const setupProviderSchema = z.object({
  name: z.string(),
  envVar: z.string(),
  configured: z.boolean(),
  required: z.boolean(),
  note: z.string(),
});

const setupStatusSchema = z.object({
  imageProvider: z.enum(["unsplash", "fal", "placeholder"]),
  ttsProvider: z.enum(["openai", "elevenlabs"]),
  judgeProvider: z.enum(["heuristic", "llm"]),
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
  const selectedTtsProvider = ttsProvider();
  const selectedJudgeProvider = judgeProvider();

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
      note: "Only required when IMAGE_PROVIDER=unsplash.",
    },
    {
      name: "fal.ai",
      envVar: "FAL_KEY",
      configured: isConfigured("FAL_KEY"),
      required: selectedImageProvider === "fal",
      note: "Recommended alternative to Unsplash. Set IMAGE_PROVIDER=fal or leave auto when FAL_KEY is set.",
    },
    {
      name: "OpenAI TTS",
      envVar: "OPENAI_API_KEY",
      configured: openAiTtsConfigured(),
      required: selectedTtsProvider === "openai",
      note: "Default voice provider. Uses tts-1-hd and OPENAI_TTS_VOICE (default onyx). Optional OPENAI_TTS_API_KEY overrides OPENAI_API_KEY.",
    },
    {
      name: "ElevenLabs",
      envVar: "ELEVENLABS_API_KEY",
      configured: isConfigured("ELEVENLABS_API_KEY"),
      required: selectedTtsProvider === "elevenlabs",
      note: "Legacy option. Set TTS_PROVIDER=elevenlabs to use instead of OpenAI TTS.",
    },
    {
      name: "LLM judge (Kimi)",
      envVar: "JUDGE_API_KEY",
      configured: Boolean(judgeApiKey()),
      required: selectedJudgeProvider === "llm",
      note: "Only required when JUDGE_PROVIDER=llm. Uses Moonshot OpenAI-compatible API.",
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
    selectedImageProvider === "placeholder"
      ? "No image API key found. Using placeholder slides. Add FAL_KEY for AI-generated images (recommended) or UNSPLASH_ACCESS_KEY for stock photos."
      : "",
    selectedTtsProvider === "openai" && !openAiTtsConfigured()
      ? "OpenAI TTS is selected but OPENAI_API_KEY is missing, so voiceover tools will return the script with status unavailable."
      : "",
    selectedTtsProvider === "elevenlabs" && !isConfigured("ELEVENLABS_API_KEY")
      ? "ElevenLabs is selected but ELEVENLABS_API_KEY is missing, so voiceover tools will return the script with status unavailable."
      : "",
    !isConfigured("LANGFUSE_PUBLIC_KEY") || !isConfigured("LANGFUSE_SECRET_KEY")
      ? "Langfuse is optional and currently disabled; benchmark results still return locally."
      : "",
  ].filter(Boolean);

  return {
    imageProvider: selectedImageProvider,
    ttsProvider: selectedTtsProvider,
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
      "Call design_youtube_intro when the user wants a channel intro concept instead of a promo campaign.",
      "Call create_news_broadcast when the user wants a TV-style news intro with latest headlines, slides, and anchor voiceover.",
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
        title: "YouTube intro design",
        tool: "design_youtube_intro",
        why: "Shows how the same MCP stack can produce channel intros, not only event promo kits.",
        prompt:
          "Design a cinematic-tech YouTube intro for a developer tools channel aimed at Cursor users.",
        expected:
          "Shot list, color palette, hero frame, spoken hook, and optional ElevenLabs preview.",
      },
      {
        step: 7,
        title: "News broadcast intro",
        tool: "create_news_broadcast",
        why: "Shows Exa headlines, ElevenLabs anchor voice, and one image slide per story in a news-program format.",
        prompt:
          "Create a technology news broadcast for Davide Daily covering global headlines with 3 stories.",
        expected:
          "Opening slide, one slide per headline, closing slide, full anchor script, and voiceover status.",
      },
      {
        step: 8,
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
  const provider = judgeProvider();
  const apiKey = judgeApiKey();

  if (provider === "llm" && apiKey) {
    try {
      return await evaluateWithLlm({
        ...input,
        apiKey,
        baseUrl: judgeBaseUrl(),
        model: judgeModel(),
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
      "Create a campaign visual. Uses fal.ai when FAL_KEY is set, Unsplash when UNSPLASH_ACCESS_KEY is set, or placeholder slides when neither is configured.",
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
    description: "Generate a spoken voiceover with OpenAI TTS (default) or ElevenLabs when TTS_PROVIDER=elevenlabs.",
    schema: z.object({
      script: z.string().describe("Short spoken ad script"),
      voiceId: z
        .string()
        .optional()
        .describe(
          "Optional voice override. OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer. ElevenLabs voice ID when TTS_PROVIDER=elevenlabs."
        ),
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
      "Create a complete promo kit with Exa research, campaign visuals, and OpenAI TTS voiceover.",
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

server.tool(
  {
    name: "list_intro_styles",
    description:
      "List YouTube intro style presets for design_youtube_intro dropdown choices.",
    schema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    outputSchema: z.object({
      styles: z.array(
        z.object({
          id: introStyleSchema,
          label: z.string(),
          mood: z.string(),
          palette: z.array(z.string()),
        })
      ),
    }),
  },
  async () =>
    object({
      styles: introStyleIds.map((id) => ({
        id,
        label: introStyles[id].label,
        mood: introStyles[id].mood,
        palette: introStyles[id].palette,
      })),
    })
);

server.tool(
  {
    name: "design_youtube_intro",
    description:
      "Design a YouTube channel intro with Exa trend research, shot list, color palette, hero frame, and spoken hook voiceover.",
    schema: z.object({
      channelName: z.string().describe("YouTube channel or show name"),
      niche: z
        .string()
        .describe("Channel niche, e.g. developer tools, gaming, education"),
      audience: z.string().describe("Primary viewer audience"),
      style: introStyleSchema
        .default("cinematic-tech")
        .describe("Intro visual and motion style preset"),
      durationSeconds: z
        .number()
        .min(5)
        .max(20)
        .default(8)
        .describe("Target intro length in seconds"),
      tagline: z
        .string()
        .optional()
        .describe("Optional on-screen tagline; auto-generated if omitted"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: youtubeIntroSchema,
  },
  async ({ channelName, niche, audience, style, durationSeconds, tagline }) =>
    object(
      await designYoutubeIntro({
        channelName,
        niche,
        audience,
        style,
        durationSeconds,
        tagline,
      })
    )
);

server.tool(
  {
    name: "research_youtube_intro_trends",
    description:
      "Research YouTube intro design trends for a channel niche without generating assets.",
    schema: z.object({
      channelName: z.string().describe("YouTube channel or show name"),
      niche: z.string().describe("Channel niche"),
      audience: z.string().describe("Primary viewer audience"),
      style: introStyleSchema.default("cinematic-tech"),
      maxResults: z.number().min(1).max(8).default(3),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: introResearchSchema,
  },
  async ({ channelName, niche, audience, style, maxResults }) =>
    object(
      await researchYoutubeIntroTrends({
        channelName,
        niche,
        audience,
        style,
        maxResults,
      })
    )
);

server.tool(
  {
    name: "list_news_categories",
    description:
      "List news category presets for fetch_latest_news and create_news_broadcast.",
    schema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    outputSchema: z.object({
      categories: z.array(
        z.object({
          id: newsCategorySchema,
          label: z.string(),
          queryHint: z.string(),
        })
      ),
    }),
  },
  async () =>
    object({
      categories: newsCategoryIds.map((id) => ({
        id,
        ...newsCategories[id],
      })),
    })
);

server.tool(
  {
    name: "fetch_latest_news",
    description:
      "Fetch the latest headlines for a category and region using Exa. Returns stories only, no slides or voiceover.",
    schema: z.object({
      category: newsCategorySchema
        .default("technology")
        .describe("News beat or section"),
      region: z
        .string()
        .default("global")
        .describe("Geographic focus, e.g. global, Europe, United States, Italy"),
      maxResults: z.number().min(1).max(8).default(5),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: latestNewsSchema,
  },
  async ({ category, region, maxResults }) =>
    object(await getLatestNews({ category, region, maxResults }))
);

server.tool(
  {
    name: "create_news_broadcast",
    description:
      "Create a TV-style news intro: fetch latest headlines with Exa, generate one image slide per story plus opening and closing slides, and produce an anchor voiceover that reads the full bulletin.",
    schema: z.object({
      showName: z
        .string()
        .describe("News program or channel name, e.g. Davide Daily"),
      category: newsCategorySchema
        .default("technology")
        .describe("News beat or section"),
      region: z
        .string()
        .default("global")
        .describe("Geographic focus, e.g. global, Europe, United States, Italy"),
      maxStories: z
        .number()
        .min(1)
        .max(5)
        .default(3)
        .describe("Number of headline stories to include"),
      language: z
        .string()
        .default("en")
        .describe("Voiceover language code"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    outputSchema: newsBroadcastSchema,
  },
  async ({ showName, category, region, maxStories, language }) =>
    object(
      await createNewsBroadcast({
        showName,
        category,
        region,
        maxStories,
        language,
      })
    )
);

server.listen().then(() => {
  console.log("Davide Youtube Promo Kit running");
});
