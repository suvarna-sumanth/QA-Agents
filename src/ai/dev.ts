import { config } from 'dotenv';
config();

import '@/ai/flows/auto-transcribe-article-audio-flow.ts';
import '@/ai/flows/analyze-audio-text-discrepancies-flow.ts';
import '@/ai/flows/detect-pronunciation-and-confidence-flow.ts';
import '@/ai/flows/discover-articles-flow.ts';
