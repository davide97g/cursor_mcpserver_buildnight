import type {
  LatestNewsResult,
  NewsBroadcast,
  NewsBroadcastSlide,
  NewsStoryResearch,
  PosterResult,
} from "../types";
import { fetchLatestNews } from "./exa";
import { generateVoiceover } from "./elevenlabs";
import { createCampaignVisual } from "./images";

export const newsCategoryIds = [
  "technology",
  "world",
  "business",
  "science",
  "sports",
  "entertainment",
] as const;

export type NewsCategoryId = (typeof newsCategoryIds)[number];

export const newsCategories: Record<
  NewsCategoryId,
  { label: string; queryHint: string }
> = {
  technology: {
    label: "Technology",
    queryHint: "AI, software, gadgets, and tech industry updates",
  },
  world: {
    label: "World",
    queryHint: "International politics, conflicts, and global events",
  },
  business: {
    label: "Business",
    queryHint: "Markets, companies, finance, and economic headlines",
  },
  science: {
    label: "Science",
    queryHint: "Research breakthroughs, space, climate, and health science",
  },
  sports: {
    label: "Sports",
    queryHint: "Leagues, tournaments, transfers, and major results",
  },
  entertainment: {
    label: "Entertainment",
    queryHint: "Film, music, culture, and celebrity headlines",
  },
};

const slideVisualStyle =
  "television news broadcast slide, 16:9, bold headline lower third, professional anchor desk aesthetic, high contrast, readable typography space";

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] || text).trim();
}

function clipAnchor(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function storyAnchorLine(story: NewsStoryResearch): string {
  const lead = firstSentence(story.summary);
  return clipAnchor(`${story.headline}. ${lead}`);
}

function openingLine(input: {
  showName: string;
  category: string;
  region: string;
}): string {
  const categoryLabel =
    newsCategories[input.category as NewsCategoryId]?.label || input.category;

  return `Good evening. Welcome to ${input.showName}. Here are the latest ${categoryLabel.toLowerCase()} headlines from ${input.region}.`;
}

function closingLine(showName: string): string {
  return `That wraps today's briefing on ${showName}. Thanks for watching.`;
}

function buildFullScript(input: {
  openingLine: string;
  storyLines: string[];
  closingLine: string;
}): string {
  return [input.openingLine, ...input.storyLines, input.closingLine].join(" ");
}

async function createSlide(input: {
  brief: string;
  headline: string;
  format: string;
}): Promise<PosterResult> {
  return createCampaignVisual({
    brief: input.brief,
    visualStyle: `${slideVisualStyle}, headline text area for: ${input.headline}`,
    format: input.format,
  });
}

export async function createNewsBroadcast(input: {
  showName: string;
  category: NewsCategoryId | string;
  region: string;
  maxStories?: number;
  language?: string;
}): Promise<NewsBroadcast> {
  const maxStories = Math.max(1, Math.min(5, input.maxStories ?? 3));
  const category =
    newsCategories[input.category as NewsCategoryId]?.label || input.category;
  const news = await fetchLatestNews({
    category,
    region: input.region,
    maxResults: maxStories,
  });

  if (news.stories.length === 0) {
    throw new Error(
      `No recent ${category} headlines found for ${input.region}. Try another category or region.`
    );
  }

  const openLine = openingLine({
    showName: input.showName,
    category: input.category,
    region: input.region,
  });
  const closeLine = closingLine(input.showName);
  const storyLines = news.stories.map(storyAnchorLine);
  const fullScript = buildFullScript({
    openingLine: openLine,
    storyLines,
    closingLine: closeLine,
  });

  const slides: NewsBroadcastSlide[] = [];
  let slideNumber = 1;

  slides.push({
    slideNumber: slideNumber++,
    type: "opening",
    headline: input.showName,
    onScreenText: `${category} Briefing · ${input.region}`,
    anchorLine: openLine,
    image: await createSlide({
      brief: `Opening title card for ${input.showName}, a ${category} news program covering ${input.region}`,
      headline: input.showName,
      format: "16:9 TV news opening slide",
    }),
  });

  for (const [index, story] of news.stories.entries()) {
    slides.push({
      slideNumber: slideNumber++,
      type: "story",
      headline: story.headline,
      onScreenText: story.headline,
      anchorLine: storyLines[index] ?? storyAnchorLine(story),
      image: await createSlide({
        brief: `News slide illustrating: ${story.headline}. ${firstSentence(story.summary)}`,
        headline: story.headline,
        format: "16:9 TV news story slide with lower third",
      }),
      source: story.source,
    });
  }

  slides.push({
    slideNumber: slideNumber++,
    type: "closing",
    headline: "End of briefing",
    onScreenText: `Thanks for watching ${input.showName}`,
    anchorLine: closeLine,
    image: await createSlide({
      brief: `Closing slide for ${input.showName} news broadcast`,
      headline: input.showName,
      format: "16:9 TV news closing slide",
    }),
  });

  const voiceover = await generateVoiceover({
    script: fullScript,
    language: input.language ?? "en",
  });

  return {
    title: `${input.showName} · ${category} News Briefing`,
    showName: input.showName,
    category,
    region: input.region,
    broadcastDate: news.fetchedAt,
    openingLine: openLine,
    closingLine: closeLine,
    slides,
    fullScript,
    voiceover,
    sources: news.stories.map((story) => story.source),
    productionNotes: [
      "Use one slide per story and cut on sentence boundaries to match the anchor voiceover.",
      "Keep lower-thirds on story slides for 5-7 seconds so viewers can read the headline.",
      "Pair the opening slide with a short news sting or ticker animation before the first story.",
      "Credit source URLs in the video description; Exa summaries are starting points, not final copy.",
    ],
  };
}

export async function getLatestNews(input: {
  category: NewsCategoryId | string;
  region: string;
  maxResults?: number;
}): Promise<LatestNewsResult> {
  const category =
    newsCategories[input.category as NewsCategoryId]?.label || input.category;

  return fetchLatestNews({
    category,
    region: input.region,
    maxResults: Math.max(1, Math.min(8, input.maxResults ?? 5)),
  });
}
