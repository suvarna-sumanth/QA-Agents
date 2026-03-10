'use server';
/**
 * @fileOverview A Genkit flow for transcribing article audio using speech-to-text.
 *
 * - autoTranscribeArticleAudio - A function that handles the audio transcription process.
 * - AutoTranscribeArticleAudioInput - The input type for the autoTranscribeArticleAudio function.
 * - AutoTranscribeArticleAudioOutput - The return type for the autoTranscribeArticleAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AutoTranscribeArticleAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The audio of an article, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AutoTranscribeArticleAudioInput = z.infer<typeof AutoTranscribeArticleAudioInputSchema>;

const AutoTranscribeArticleAudioOutputSchema = z.object({
  transcribedText: z.string().describe('The transcribed text from the audio.'),
});
export type AutoTranscribeArticleAudioOutput = z.infer<typeof AutoTranscribeArticleAudioOutputSchema>;

export async function autoTranscribeArticleAudio(input: AutoTranscribeArticleAudioInput): Promise<AutoTranscribeArticleAudioOutput> {
  return autoTranscribeArticleAudioFlow(input);
}

const autoTranscribeArticleAudioFlow = ai.defineFlow(
  {
    name: 'autoTranscribeArticleAudioFlow',
    inputSchema: AutoTranscribeArticleAudioInputSchema,
    outputSchema: AutoTranscribeArticleAudioOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: [
        { text: 'Transcribe the following audio into text:' },
        { media: { url: input.audioDataUri } },
      ],
    });

    if (!text) {
      throw new Error('Failed to transcribe audio: No text output from model.');
    }

    return { transcribedText: text };
  }
);
