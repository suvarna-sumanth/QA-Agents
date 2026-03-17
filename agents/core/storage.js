/**
 * Agent Storage Utility (JS version)
 * Compatible with the agent ESM ecosystem.
 */

import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  HeadBucketCommand 
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load env
const rootEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: rootEnv });

class AgentStorage {
  constructor() {
    this.bucket = process.env.S3_BUCKET || 'qa-agents-reports-dev';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.prefix = process.env.S3_PREFIX || 'qa-agents/';
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.initialized = true;
    } catch (err) {
      console.warn(`[AgentStorage] S3 Bucket ${this.bucket} not verified: ${err.message}`);
    }
  }

  async saveScreenshot(agentId, jobId, filePath, stepNumber) {
    await this.initialize();
    const key = `${this.prefix}${agentId}/${jobId}/screenshots/step-${stepNumber}.png`;

    try {
      if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
      const body = await readFile(filePath);
      
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'image/png',
        Metadata: { agentId, jobId, step: String(stepNumber) }
      }));

      console.log(`[Storage] ✓ Uploaded: s3://${this.bucket}/${key}`);
      
      try { await unlink(filePath); } catch (e) {}
      return { key };
    } catch (err) {
      console.error(`[Storage] ✗ Upload failed: ${err.message}`);
      return null;
    }
  }

  async syncReportScreenshots(agentId, jobId, report) {
    console.log(`[Storage] Syncing screenshots for job ${jobId}...`);
    let stepIndex = 0;
    const results = report.steps || report.results || [];
    const uploaded = new Map();

    for (const result of results) {
       // Case 1: result is a step with a screenshot directly
       if (result.screenshot && existsSync(result.screenshot)) {
         const localPath = result.screenshot;
         if (uploaded.has(localPath)) {
           result.s3Key = uploaded.get(localPath);
         } else {
           const res = await this.saveScreenshot(agentId, jobId, localPath, stepIndex++);
           if (res) {
             result.s3Key = res.key;
             uploaded.set(localPath, res.key);
           }
         }
       }

       // Case 2: test_player nested report (data.report.steps)
       const subSteps = result.data?.report?.steps;
       if (Array.isArray(subSteps)) {
         for (const subStep of subSteps) {
           if (subStep.screenshot && existsSync(subStep.screenshot)) {
             const localPath = subStep.screenshot;
             if (uploaded.has(localPath)) {
               subStep.s3Key = uploaded.get(localPath);
             } else {
               const res = await this.saveScreenshot(agentId, jobId, localPath, stepIndex++);
               if (res) {
                 subStep.s3Key = res.key;
                 uploaded.set(localPath, res.key);
               }
             }
           }
         }
       }

       // Case 3: detect_player nested results (data.results)
       const detectionResults = result.data?.results;
       if (Array.isArray(detectionResults)) {
         for (const det of detectionResults) {
           if (det.screenshot && existsSync(det.screenshot)) {
             const localPath = det.screenshot;
             if (uploaded.has(localPath)) {
               det.s3Key = uploaded.get(localPath);
             } else {
               const res = await this.saveScreenshot(agentId, jobId, localPath, stepIndex++);
               if (res) {
                 det.s3Key = res.key;
                 uploaded.set(localPath, res.key);
               }
             }
           }
         }
       }
    }
    return report;
  }
}

export const storage = new AgentStorage();
export default storage;
