import { imageProvider } from "../config";
import type { PosterResult } from "../types";
import { generatePoster as generateFalPoster } from "./fal";
import { createPlaceholderImage } from "./placeholder";
import { sourcePosterImage } from "./unsplash";

export async function createCampaignVisual(input: {
  brief: string;
  visualStyle: string;
  format: string;
}): Promise<PosterResult> {
  const provider = imageProvider();

  if (provider === "fal") {
    return generateFalPoster(input);
  }

  if (provider === "placeholder") {
    return createPlaceholderImage(input);
  }

  return sourcePosterImage(input);
}
