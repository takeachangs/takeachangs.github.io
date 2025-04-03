import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string().optional(), // Optional short description
    // Add other fields if needed, like tags: z.array(z.string()).optional()
  }),
});

export const collections = {
  'blog': blogCollection,
};