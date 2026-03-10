'use server';
/**
 * @fileOverview A Genkit flow for discovering latest articles from a publisher's domain.
 * 
 * - discoverArticles - Function to simulate web scraping/discovery of articles via LLM.
 * - DiscoverArticlesInput - Input schema for the flow.
 * - DiscoverArticlesOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DiscoverArticlesInputSchema = z.object({
  url: z.string().describe('The base URL or domain of the publisher site.'),
  siteName: z.string().describe('The name of the publisher site.'),
});
export type DiscoverArticlesInput = z.infer<typeof DiscoverArticlesInputSchema>;

const ArticleSchema = z.object({
  title: z.string().describe('The title of the discovered article.'),
  url: z.string().describe('The full URL of the discovered article.'),
});

const DiscoverArticlesOutputSchema = z.object({
  articles: z.array(ArticleSchema).describe('A list of discovered articles from the publisher site.'),
  discoveryLog: z.string().describe('A log of the discovery process for the agent telemetry.'),
});
export type DiscoverArticlesOutput = z.infer<typeof DiscoverArticlesOutputSchema>;

const discoverPrompt = ai.definePrompt({
  name: 'discoverArticlesPrompt',
  input: { schema: DiscoverArticlesInputSchema },
  output: { schema: DiscoverArticlesOutputSchema },
  prompt: `You are a web discovery agent for AudioPulse. Your goal is to identify the latest news articles from the publisher site: {{{siteName}}} ({{{url}}}).

Based on your knowledge of news site structures, simulate finding the top 3-4 most recent editorial articles. Provide realistic titles and URLs that match the site's domain.

Also, provide a brief "discoveryLog" entry describing how you crawled the home page and identified the article links.

Return the result in the specified JSON format.`,
});

const discoverArticlesFlow = ai.defineFlow(
  {
    name: 'discoverArticlesFlow',
    inputSchema: DiscoverArticlesInputSchema,
    outputSchema: DiscoverArticlesOutputSchema,
  },
  async (input) => {
    const { output } = await discoverPrompt(input);
    if (!output) {
      throw new Error('Failed to discover articles.');
    }
    return output;
  }
);

export async function discoverArticles(input: DiscoverArticlesInput): Promise<DiscoverArticlesOutput> {
  return discoverArticlesFlow(input);
}
