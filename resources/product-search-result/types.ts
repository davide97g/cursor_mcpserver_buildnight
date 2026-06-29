import { z } from "zod";

export const propSchema = z.object({
  title: z.string().default("Davide Youtube Promo Kit"),
  summary: z
    .string()
    .default("Research, poster generation, and voiceover tools for a workshop."),
});

export type ProductSearchResultProps = z.infer<typeof propSchema>;

export type AccordionItemProps = {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
};
