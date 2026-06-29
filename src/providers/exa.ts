import { requireApiKey } from "../config";
import type {
  LatestNewsResult,
  MarketResearch,
  NewsStoryResearch,
  ResearchSource,
} from "../types";

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
    "Relevant source returned by Exa."
  );
}

export async function researchMarket(input: {
  topic: string;
  audience: string;
  location: string;
  maxResults: number;
}): Promise<MarketResearch> {
  const apiKey = requireApiKey("Exa");
  const query = [
    input.topic,
    input.audience,
    input.location,
    "event marketing audience trends examples",
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
  const sources: ResearchSource[] = (payload.results ?? []).map((result) => ({
    title: result.title || "Untitled source",
    url: result.url || "https://exa.ai",
    summary: compactSummary(result),
  }));

  return {
    topic: input.topic,
    audience: input.audience,
    location: input.location,
    angle: `${input.topic} as a timely, local, easy-to-share experience for ${input.audience} in ${input.location}`,
    insights: [
      `Lead with a specific ${input.location} hook so the campaign feels immediately relevant.`,
      `Frame ${input.topic} as a social plan, not just an announcement, for ${input.audience}.`,
      "Use one concrete CTA across poster, captions, and voiceover to reduce friction.",
    ],
    sources,
  };
}

export async function fetchLatestNews(input: {
  category: string;
  region: string;
  maxResults: number;
}): Promise<LatestNewsResult> {
  const apiKey = requireApiKey("Exa");
  const query = [
    "latest breaking news",
    input.category,
    input.region,
    "today headlines report",
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
  const stories: NewsStoryResearch[] = (payload.results ?? []).map(
    (result) => {
      const headline = result.title || "Untitled headline";
      const summary = compactSummary(result);

      return {
        headline,
        summary,
        source: {
          title: headline,
          url: result.url || "https://exa.ai",
          summary,
        },
      };
    }
  );

  return {
    category: input.category,
    region: input.region,
    fetchedAt: new Date().toISOString(),
    stories,
  };
}
