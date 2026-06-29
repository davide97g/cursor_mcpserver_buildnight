export type ResearchSource = {
  title: string;
  url: string;
  summary: string;
};

export type MarketResearch = {
  topic: string;
  audience: string;
  location: string;
  angle: string;
  insights: string[];
  sources: ResearchSource[];
};

export type PosterResult = {
  provider: "fal" | "unsplash" | "placeholder";
  prompt: string;
  imageUrl: string;
  visualStyle: string;
  format: string;
  sourceUrl?: string;
  photographerName?: string;
  photographerUrl?: string;
  attribution?: string;
};

export type VoiceoverResult = {
  status: "generated" | "unavailable";
  script: string;
  audioUrl: string;
  voiceId: string;
  language: string;
  error?: string;
};

export type PromoKit = {
  title: string;
  positioning: string;
  captions: string[];
  research: MarketResearch;
  poster: PosterResult;
  voiceover: VoiceoverResult;
};

export type PromoKitBenchmark = {
  promoKit: PromoKit;
  evaluation: unknown;
  langfuse: unknown;
};

export type IntroResearch = {
  channelName: string;
  niche: string;
  audience: string;
  style: string;
  angle: string;
  insights: string[];
  sources: ResearchSource[];
};

export type YoutubeIntroShot = {
  second: number;
  duration: number;
  visual: string;
  textOverlay?: string;
  motion: string;
};

export type YoutubeIntroDesign = {
  title: string;
  channelName: string;
  niche: string;
  audience: string;
  style: string;
  styleLabel: string;
  durationSeconds: number;
  hookLine: string;
  tagline: string;
  shotList: YoutubeIntroShot[];
  typography: {
    headlineFont: string;
    bodyFont: string;
    treatment: string;
  };
  colorPalette: string[];
  soundDirection: {
    mood: string;
    tempo: string;
    sfxNotes: string;
  };
  subscribeMoment: string;
  productionNotes: string[];
  research: IntroResearch;
  thumbnailConcept: PosterResult;
  voiceover: VoiceoverResult;
};

export type NewsStoryResearch = {
  headline: string;
  summary: string;
  source: ResearchSource;
};

export type LatestNewsResult = {
  category: string;
  region: string;
  fetchedAt: string;
  stories: NewsStoryResearch[];
};

export type NewsBroadcastSlide = {
  slideNumber: number;
  type: "opening" | "story" | "closing";
  headline: string;
  onScreenText: string;
  anchorLine: string;
  image: PosterResult;
  source?: ResearchSource;
};

export type NewsBroadcast = {
  title: string;
  showName: string;
  category: string;
  region: string;
  broadcastDate: string;
  openingLine: string;
  closingLine: string;
  slides: NewsBroadcastSlide[];
  fullScript: string;
  voiceover: VoiceoverResult;
  sources: ResearchSource[];
  productionNotes: string[];
};
