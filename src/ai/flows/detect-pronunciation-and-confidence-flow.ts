'use server';
/**
 * @fileOverview Detects pronunciation issues and calculates speech confidence and text similarity metrics for article audio.
 *
 * - detectPronunciationAndConfidence - A function that processes audio and canonical text to assess speech quality.
 * - DetectPronunciationAndConfidenceInput - The input type for the detectPronunciationAndConfidence function.
 * - DetectPronunciationAndConfidenceOutput - The return type for the detectPronunciationAndConfidence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema for the flow
const DetectPronunciationAndConfidenceInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The article audio, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  canonicalArticleText: z.string().describe('The canonical article text (article_body_finetuned) to compare against the audio transcription.'),
});
export type DetectPronunciationAndConfidenceInput = z.infer<typeof DetectPronunciationAndConfidenceInputSchema>;

// Output Schema for the flow
const DetectPronunciationAndConfidenceOutputSchema = z.object({
  wordErrorRate: z.number().min(0).max(1).describe('The estimated Word Error Rate (WER) between the transcribed audio and the canonical article text. A value between 0 (perfect match) and 1 (complete mismatch).'),
  semanticSimilarity: z.number().min(0).max(1).describe('A score between 0 and 1 indicating how semantically similar the transcribed text is to the canonical text. 1 means perfectly similar.'),
  speechConfidenceScore: z.number().min(0).max(1).describe('An overall confidence score for the speech quality and pronunciation, based on the comparison (0-1, 1 being high confidence).'),
  mispronouncedWords: z.array(z.string()).describe('A list of words from the transcribed text that are identified as potentially mispronounced or incorrectly spoken compared to the canonical text.'),
  transcribedText: z.string().describe('The full raw text transcribed from the audio.'),
  analysis: z.string().describe('A brief textual analysis of the audio quality based on the comparison.'),
});
export type DetectPronunciationAndConfidenceOutput = z.infer<typeof DetectPronunciationAndConfidenceOutputSchema>;

/**
 * Wrapper function to execute the pronunciation and confidence detection flow.
 * @param input - The input containing audio data and canonical article text.
 * @returns A promise that resolves to the detection results.
 */
export async function detectPronunciationAndConfidence(
  input: DetectPronunciationAndConfidenceInput
): Promise<DetectPronunciationAndConfidenceOutput> {
  return detectPronunciationAndConfidenceFlow(input);
}

// Genkit Tool for OpenAI Whisper API integration
// In a real application, this would make an actual API call to OpenAI Whisper.
const transcribeAudioTool = ai.defineTool(
  {
    name: 'transcribeAudio',
    description: 'Transcribes audio data into text using the OpenAI Whisper API.',
    inputSchema: z.object({
      audioDataUri: z
        .string()
        .describe(
          "The audio to transcribe, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
    outputSchema: z.string().describe('The transcribed text from the audio.'),
  },
  async (toolInput) => {
    // This is a placeholder for the actual OpenAI Whisper API call.
    // In a production environment, you would replace this with an API client call.
    console.log(`Simulating OpenAI Whisper transcription for audio (first 50 chars): ${toolInput.audioDataUri.substring(0, 50)}...`);
    // Example of a mocked transcription
    return "This is a simulated transcription of the audio for demonstration purposes. The speaker was clear.";
  }
);

// Genkit Prompt for comparing transcribed text with canonical text and deriving scores.
const audioTextComparisonPrompt = ai.definePrompt({
  name: 'audioTextComparisonPrompt',
  input: {
    schema: z.object({
      transcribedText: z.string().describe('The text transcribed from the audio.'),
      canonicalText: z.string().describe('The canonical, expected text for the audio.'),
    }),
  },
  output: {
    schema: DetectPronunciationAndConfidenceOutputSchema.omit({ transcribedText: true }), // Output matches schema, but without transcribedText as it's generated elsewhere.
  },
  prompt: `You are an expert audio quality analyst. Your task is to compare two texts: a transcribed audio text and a canonical reference text.\nBased on this comparison, you will assess the quality of the audio transcription and infer potential pronunciation issues and overall speech confidence.\n\nTranscribed Audio Text:\n{{{transcribedText}}}\n\nCanonical Reference Text:\n{{{canonicalText}}}\n\nPerform the following:\n1.  Calculate an estimated Word Error Rate (WER) between the two texts. This should be a numerical value between 0 (perfect match) and 1 (complete mismatch). Consider insertions, deletions, and substitutions.\n2.  Estimate the semantic similarity between the two texts on a scale of 0 to 1, where 1 means perfect semantic match.\n3.  Assign an overall speech confidence score from 0 to 1, where 1 indicates highly clear and accurately pronounced speech. This score should reflect how well the spoken content matches the canonical text in terms of clarity and correctness.\n4.  Identify and list specific words from the transcribed text that are likely mispronounced, incorrectly transcribed, or are extra/missing compared to the canonical text. Provide these as an array of strings.\n5.  Provide a brief textual analysis summarizing your findings regarding the audio quality, highlighting any significant discrepancies or strengths.\n\nReturn your analysis in the specified JSON format. Ensure all numerical scores are between 0 and 1.`,
});

/**
 * Genkit flow to detect pronunciation and confidence for given audio and canonical text.
 * It uses an external tool for speech-to-text and an LLM prompt for comparison and scoring.
 */
const detectPronunciationAndConfidenceFlow = ai.defineFlow(
  {
    name: 'detectPronunciationAndConfidenceFlow',
    inputSchema: DetectPronunciationAndConfidenceInputSchema,
    outputSchema: DetectPronunciationAndConfidenceOutputSchema,
  },
  async (input) => {
    // Step 1: Transcribe the audio using the dedicated tool.
    const transcribedText = await transcribeAudioTool({ audioDataUri: input.audioDataUri });

    // Step 2: Normalize texts for comparison.
    const normalizeText = (text: string) => {
      // Convert to lowercase, remove punctuation, collapse multiple spaces to a single space.
      return text.toLowerCase().replace(/[.,!?;:'"(){}[\\\]]/g, '').replace(/\s+/g, ' ').trim();
    };

    const normalizedTranscribedText = normalizeText(transcribedText);
    const normalizedCanonicalText = normalizeText(input.canonicalArticleText);

    // Step 3: Use LLM to compare texts and derive metrics and mispronounced words.
    const comparisonResult = await audioTextComparisonPrompt({
      transcribedText: normalizedTranscribedText,
      canonicalText: normalizedCanonicalText,
    });

    const outputFromLLM = comparisonResult.output!;

    // Return the combined results.
    return {
      wordErrorRate: outputFromLLM.wordErrorRate,
      semanticSimilarity: outputFromLLM.semanticSimilarity,
      speechConfidenceScore: outputFromLLM.speechConfidenceScore,
      mispronouncedWords: outputFromLLM.mispronouncedWords,
      transcribedText: transcribedText, // Include the raw transcribed text in the final output
      analysis: outputFromLLM.analysis,
    };
  }
);
