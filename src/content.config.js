import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    readMinutes: z.number().int().positive().default(4),
    author: z.string().default("Image Identifier"),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
