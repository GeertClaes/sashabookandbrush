import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const books = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/books" }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    cover: z.string(),
    note: z.string().default(""),
    rating: z.number().int().min(1).max(5),
    genre: z.string(),
    bookshop: z.string(),
    amazon: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

const art = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/art" }),
  schema: z.object({
    title: z.string(),
    medium: z.string(),
    image: z.string().optional(),
    note: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

const supplies = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/supplies" }),
  schema: z.object({
    title: z.string(),
    brand: z.string(),
    category: z.string(),
    note: z.string(),
    amazon: z.string(),
    shop: z.string().optional(),
    shopLabel: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { books, art, supplies };
