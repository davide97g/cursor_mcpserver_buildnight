import type { PosterResult } from "../types";

function slug(text: string, maxLength = 48): string {
  const cleaned = text
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");

  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength - 3).trim()}...`
    : cleaned || "Campaign visual";
}

function dimensions(format: string): { width: number; height: number } {
  const normalized = format.toLowerCase();

  if (normalized.includes("square")) {
    return { width: 1080, height: 1080 };
  }

  return { width: 1920, height: 1080 };
}

export async function createPlaceholderImage(input: {
  brief: string;
  visualStyle: string;
  format: string;
}): Promise<PosterResult> {
  const { width, height } = dimensions(input.format);
  const label = slug(input.brief);
  const imageUrl = `https://placehold.co/${width}x${height}/111827/38bdf8/png?text=${encodeURIComponent(
    label
  )}`;

  return {
    provider: "placeholder",
    prompt: [input.brief, input.visualStyle, input.format].join(". "),
    imageUrl,
    visualStyle: input.visualStyle,
    format: input.format,
    attribution:
      "Placeholder image (no Unsplash or fal.ai key configured). Set FAL_KEY or IMAGE_PROVIDER=fal for AI slides.",
  };
}
