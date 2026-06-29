import { requireApiKey } from "../config";
import type {
  IntroResearch,
  PosterResult,
  VoiceoverResult,
  YoutubeIntroDesign,
  YoutubeIntroShot,
} from "../types";
import { generateVoiceover } from "./elevenlabs";
import { createCampaignVisual } from "./images";

export const introStyleIds = [
  "cinematic-tech",
  "minimal-clean",
  "energetic-gaming",
  "warm-educational",
  "bold-vlog",
] as const;

export type IntroStyleId = (typeof introStyleIds)[number];

export const introStyles: Record<
  IntroStyleId,
  {
    label: string;
    mood: string;
    tempo: string;
    visualStyle: string;
    typography: string;
    palette: string[];
  }
> = {
  "cinematic-tech": {
    label: "Cinematic Tech",
    mood: "confident, premium, slightly futuristic",
    tempo: "medium build with a sharp logo hit at the end",
    visualStyle:
      "cinematic tech intro, dark gradient background, subtle particle motion, premium lens flare, logo reveal space",
    typography: "Geometric sans-serif headline, tight tracking, white on charcoal",
    palette: ["#0B0F19", "#1E293B", "#38BDF8", "#F8FAFC"],
  },
  "minimal-clean": {
    label: "Minimal Clean",
    mood: "calm, trustworthy, editorial",
    tempo: "slow and steady with one clean motion accent",
    visualStyle:
      "minimal clean YouTube intro, soft neutral background, simple shape animation, generous whitespace, modern creator aesthetic",
    typography: "Humanist sans-serif, medium weight, high contrast black and off-white",
    palette: ["#FAFAF7", "#111827", "#6B7280", "#E5E7EB"],
  },
  "energetic-gaming": {
    label: "Energetic Gaming",
    mood: "fast, loud, competitive",
    tempo: "fast cuts synced to a punchy beat drop",
    visualStyle:
      "energetic gaming channel intro, neon accents, glitch transitions, bold diagonal motion, high contrast RGB highlights",
    typography: "Condensed display font, uppercase hooks, neon accent color",
    palette: ["#090014", "#7C3AED", "#22D3EE", "#FACC15"],
  },
  "warm-educational": {
    label: "Warm Educational",
    mood: "friendly, clear, encouraging",
    tempo: "gentle rise with a welcoming logo settle",
    visualStyle:
      "warm educational YouTube intro, soft paper texture, rounded shapes, approachable color blocks, classroom-meets-creator vibe",
    typography: "Rounded sans-serif headline with readable subtitle treatment",
    palette: ["#FFF7ED", "#EA580C", "#2563EB", "#14532D"],
  },
  "bold-vlog": {
    label: "Bold Vlog",
    mood: "personal, punchy, lifestyle-forward",
    tempo: "quick montage into a signature catchphrase",
    visualStyle:
      "bold lifestyle vlog intro, handheld energy, punchy color blocks, travel and creator montage frames, dynamic typography space",
    typography: "Bold sans-serif with handwritten accent for the channel name",
    palette: ["#111111", "#FF4D4F", "#FFE066", "#FFFFFF"],
  },
};

type ExaResult = {
  title?: string;
  url?: string;
  summary?: string;
  highlights?: string[];
  text?: string;
};

type ExaSearchResponse = {
  results?: ExaResult[];
};

function compactSummary(result: ExaResult): string {
  const highlight = result.highlights?.find(Boolean);
  return (
    result.summary ||
    highlight ||
    result.text?.slice(0, 240) ||
    "Relevant YouTube intro reference returned by Exa."
  );
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

function hookLine(input: {
  channelName: string;
  niche: string;
  audience: string;
  style: IntroStyleId;
}): string {
  const style = introStyles[input.style];

  if (input.style === "energetic-gaming") {
    return `Welcome to ${input.channelName}. ${input.niche} for ${input.audience}, no filler.`;
  }

  if (input.style === "warm-educational") {
    return `Hey, I'm ${input.channelName}. Let's make ${input.niche} easier for ${input.audience}.`;
  }

  if (input.style === "bold-vlog") {
    return `${input.channelName} here. Real ${input.niche}, built for ${input.audience}.`;
  }

  if (input.style === "minimal-clean") {
    return `${input.channelName}. Clear ${input.niche} for ${input.audience}.`;
  }

  return `${input.channelName}. ${style.mood} ${input.niche} for ${input.audience}.`;
}

function tagline(input: {
  channelName: string;
  niche: string;
  style: IntroStyleId;
}): string {
  const templates: Record<IntroStyleId, string> = {
    "cinematic-tech": `${input.channelName} · Build smarter in ${input.niche}`,
    "minimal-clean": `${input.channelName} · ${input.niche}, simplified`,
    "energetic-gaming": `${input.channelName} · Play. Improve. Repeat.`,
    "warm-educational": `${input.channelName} · Learn ${input.niche} step by step`,
    "bold-vlog": `${input.channelName} · Life, ${input.niche}, and everything in between`,
  };

  return templates[input.style];
}

function buildShotList(input: {
  channelName: string;
  niche: string;
  style: IntroStyleId;
  durationSeconds: number;
  hookLine: string;
  tagline: string;
}): YoutubeIntroShot[] {
  const style = introStyles[input.style];
  const end = Math.max(5, Math.min(20, input.durationSeconds));
  const logoHit = Math.max(1, end - 2);

  const shots: YoutubeIntroShot[] = [
    {
      second: 0,
      duration: 2,
      visual: `Open on a mood-setting frame that signals ${input.niche} without showing the full logo yet.`,
      textOverlay: input.hookLine.split(".")[0],
      motion: `Slow push-in or soft parallax to establish the ${style.mood} tone.`,
    },
    {
      second: 2,
      duration: Math.max(2, logoHit - 2),
      visual: `Montage of 2-3 signature ${input.niche} moments with ${style.visualStyle}.`,
      motion: "Quick but readable cuts or shape wipes; keep text off-screen during fast motion.",
    },
    {
      second: logoHit,
      duration: 2,
      visual: `Reveal ${input.channelName} logo or wordmark on a clean hero frame.`,
      textOverlay: input.tagline,
      motion: "Logo scale-in or mask reveal synced to the tempo accent.",
    },
    {
      second: end - 1,
      duration: 1,
      visual: "Hold on logo with subtle ambient motion so editors can cut to the first video beat.",
      textOverlay: "Subscribe cue optional",
      motion: "Gentle pulse or glow on the logo mark, then hard cut to content.",
    },
  ];

  return shots;
}

export async function researchYoutubeIntroTrends(input: {
  channelName: string;
  niche: string;
  audience: string;
  style: IntroStyleId;
  maxResults: number;
}): Promise<IntroResearch> {
  const apiKey = requireApiKey("Exa");
  const style = introStyles[input.style];
  const query = [
    "YouTube channel intro design",
    input.niche,
    input.audience,
    style.label,
    "best practices examples hook subscribe animation",
  ].join(" ");

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: input.maxResults,
      contents: {
        highlights: true,
        summary: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Exa search failed (${response.status}): ${await response.text()}`
    );
  }

  const payload = (await response.json()) as ExaSearchResponse;
  const sources = (payload.results ?? []).map((result) => ({
    title: result.title || "Untitled source",
    url: result.url || "https://exa.ai",
    summary: compactSummary(result),
  }));

  return {
    channelName: input.channelName,
    niche: input.niche,
    audience: input.audience,
    style: input.style,
    angle: `${input.channelName} should open with a ${style.label.toLowerCase()} intro that makes ${input.niche} instantly recognizable to ${input.audience}.`,
    insights: [
      `Keep the intro under ${Math.min(15, Math.max(5, 8))} seconds unless the channel relies on heavy storytelling.`,
      `Use one spoken hook and one visual tagline so viewers remember ${input.channelName} after the first video.`,
      `Place the subscribe moment after the logo reveal, not before the channel name lands.`,
      `Match motion tempo to ${style.tempo} so the intro feels intentional, not generic stock animation.`,
    ],
    sources,
  };
}

export async function designYoutubeIntro(input: {
  channelName: string;
  niche: string;
  audience: string;
  style: IntroStyleId;
  durationSeconds?: number;
  tagline?: string;
}): Promise<YoutubeIntroDesign> {
  const style = introStyles[input.style];
  const durationSeconds = input.durationSeconds ?? 8;
  const research = await researchYoutubeIntroTrends({
    channelName: input.channelName,
    niche: input.niche,
    audience: input.audience,
    style: input.style,
    maxResults: 3,
  });
  const spokenHook = hookLine({
    channelName: input.channelName,
    niche: input.niche,
    audience: input.audience,
    style: input.style,
  });
  const resolvedTagline =
    input.tagline?.trim() ||
    tagline({
      channelName: input.channelName,
      niche: input.niche,
      style: input.style,
    });
  const shotList = buildShotList({
    channelName: input.channelName,
    niche: input.niche,
    style: input.style,
    durationSeconds,
    hookLine: spokenHook,
    tagline: resolvedTagline,
  });

  const thumbnailConcept: PosterResult = await createCampaignVisual({
    brief: `YouTube channel intro key frame for ${input.channelName}. Niche: ${input.niche}. Audience: ${input.audience}. ${research.angle}`,
    visualStyle: style.visualStyle,
    format: "16:9 YouTube intro hero frame",
  });

  const voiceover: VoiceoverResult = await generateVoiceover({
    script: spokenHook,
    language: "en",
  });

  return {
    title: `${input.channelName} YouTube Intro`,
    channelName: input.channelName,
    niche: input.niche,
    audience: input.audience,
    style: input.style,
    styleLabel: style.label,
    durationSeconds,
    hookLine: spokenHook,
    tagline: resolvedTagline,
    shotList,
    typography: {
      headlineFont: style.typography.split(",")[0] || style.typography,
      bodyFont: "Readable sans-serif for lower-thirds and subscribe text",
      treatment: style.typography,
    },
    colorPalette: style.palette,
    soundDirection: {
      mood: style.mood,
      tempo: style.tempo,
      sfxNotes: `Use a subtle whoosh into the logo reveal and one accent hit when ${input.channelName} appears.`,
    },
    subscribeMoment: `At ${Math.max(1, durationSeconds - 2)}s, fade in a small subscribe lower-third after the logo lands.`,
    productionNotes: [
      `Export at 1920x1080, 24 or 30 fps, and keep the final master between ${durationSeconds - 1} and ${durationSeconds + 1} seconds.`,
      `Design the logo reveal frame so it also works as a reusable end screen element.`,
      `Pair the spoken hook with on-screen text only once to avoid visual clutter.`,
      `Reference trend notes: ${formatList(research.insights.slice(0, 2))}.`,
    ],
    research,
    thumbnailConcept,
    voiceover,
  };
}
