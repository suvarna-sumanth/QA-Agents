'use server';
/**
 * @fileOverview A Genkit flow for analyzing discrepancies between transcribed audio and fine-tuned article text.
 *
 * - analyzeAudioTextDiscrepancies - A function that handles the comparison process.
 * - AnalyzeAudioTextDiscrepanciesInput - The input type for the analyzeAudioTextDiscrepancies function.
 * - AnalyzeAudioTextDiscrepanciesOutput - The return type for the analyzeAudioTextDiscrepancies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeAudioTextDiscrepanciesInputSchema = z.object({
  transcribedAudioText: z.string().describe('The text transcribed from the audio.'),
  finetunedArticleText: z
    .string()
    .describe('The canonical, fine-tuned article text from the database.'),
});
export type AnalyzeAudioTextDiscrepanciesInput = z.infer<typeof AnalyzeAudioTextDiscrepanciesInputSchema>;

const AnalyzeAudioTextDiscrepanciesOutputSchema = z.object({
  summary: z.string().describe('An overall summary of the comparison results.'),
  wordErrorRateEstimate: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'An estimated Word Error Rate (WER) between 0 and 1, where 0 means no errors and 1 means completely different texts. This is a qualitative estimate by the AI, not a precise algorithmic calculation.'
    ),
  semanticSimilarityScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'A semantic similarity score between 0 and 1, where 1 means very similar meaning. This is a qualitative estimate by the AI.'
    ),
  missingContent: z
    .array(z.string())
    .describe(
      'A list of significant sentences or phrases present in the finetunedArticleText but missing from the transcribedAudioText.'
    ),
  extraContent: z
    .array(z.string())
    .describe(
      'A list of significant sentences or phrases present in the transcribedAudioText but not in the finetunedArticleText.'
    ),
  pronunciationIssues: z
    .array(z.string())
    .describe(
      'A list of potential mispronounced words or phrases based on contextual discrepancies, if detectable by comparing the two texts.'
    ),
  qualityFlags: z
    .array(z.string())
    .describe(
      'A list of identified quality issues, such as "silence segments" or "clipped audio", if such inferences can be made from textual discrepancies or if explicitly indicated.'
    ),
});
export type AnalyzeAudioTextDiscrepanciesOutput = z.infer<typeof AnalyzeAudioTextDiscrepanciesOutputSchema>;

const prompt = ai.definePrompt({
  name: 'analyzeAudioTextDiscrepanciesPrompt',
  input: { schema: AnalyzeAudioTextDiscrepanciesInputSchema },
  output: { schema: AnalyzeAudioTextDiscrepanciesOutputSchema },
  prompt: `You are an expert QA engineer specializing in audio content validation. Your task is to compare two pieces of text: a transcribed audio text and a canonical fine-tuned article text.

Carefully compare the 'transcribedAudioText' against the 'finetunedArticleText'. Your goal is to identify discrepancies and provide metrics and specific issues.

For 'wordErrorRateEstimate' and 'semanticSimilarityScore', provide a qualitative estimate between 0 and 1. 0 for WER means no errors, 1 for WER means completely different. 1 for semantic similarity means identical meaning. Justify your estimates in the 'summary' field.

Identify and list significant sentences or phrases that are present in the 'finetunedArticleText' but appear to be missing from the 'transcribedAudioText'. Populate these in the 'missingContent' array.

Identify and list significant sentences or phrases that are present in the 'transcribedAudioText' but do not appear in the 'finetunedArticleText'. Populate these in the 'extraContent' array.

Based on the textual differences, if you can infer potential mispronunciations, list them in the 'pronunciationIssues' array. For example, if a word is completely different but semantically similar, it might be a mispronunciation or transcription error.

If the textual comparison strongly suggests issues like "silence segments" (e.g., very short transcribed text for a long article) or "clipped audio" (e.g., abruptly cut sentences), include these as strings in the 'qualityFlags' array.

---
Transcribed Audio Text:
{{{transcribedAudioText}}}

---
Finetuned Article Text:
{{{finetunedArticleText}}}`,
});

const analyzeAudioTextDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'analyzeAudioTextDiscrepanciesFlow',
    inputSchema: AnalyzeAudioTextDiscrepanciesInputSchema,
    outputSchema: AnalyzeAudioTextDiscrepanciesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to get output from the prompt.');
    }
    return output;
  }
);

export async function analyzeAudioTextDiscrepancies(
  input: AnalyzeAudioTextDiscrepanciesInput
): Promise<AnalyzeAudioTextDiscrepanciesOutput> {
  return analyzeAudioTextDiscrepanciesFlow(input);
}
