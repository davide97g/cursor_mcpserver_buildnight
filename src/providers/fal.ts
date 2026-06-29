import { fal } from "@fal-ai/client";
import { requireApiKey } from "../config";
import type { PosterResult } from "../types";

type FalImage = {
  url?: string;
};

type FalImagePayload = {
  images?: FalImage[];
};

type FalSubscribeResult = {
  data?: FalImagePayload;
  images?: FalImage[];
};

function imageSize(format: string): "square_hd" | "landscape_16_9" | "portrait_16_9" {
  const normalized = format.toLowerCase();

  if (normalized.includes("square")) {
    return "square_hd";
  }

  if (normalized.includes("portrait")) {
    return "portrait_16_9";
  }

  return "landscape_16_9";
}

export async function generatePoster(input: {
  brief: string;
  visualStyle: string;
  format: string;
}): Promise<PosterResult> {
  const apiKey = requireApiKey("fal.ai");
  fal.config({ credentials: apiKey });

  const prompt = [
    input.brief,
    `Visual style: ${input.visualStyle}`,
    `Format: ${input.format}`,
    "Readable poster composition, strong focal point, modern typography space, no fake logos.",
  ].join(". ");

  const result = (await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: imageSize(input.format),
      num_images: 1,
    },
  })) as FalSubscribeResult;

  const imageUrl = result.data?.images?.[0]?.url || result.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error("fal.ai returned no image URL.");
  }

  return {
    provider: "fal",
    prompt,
    imageUrl,
    visualStyle: input.visualStyle,
    format: input.format,
  };
}
