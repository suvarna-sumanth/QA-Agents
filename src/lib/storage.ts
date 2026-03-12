/**
 * Storage Service
 * Abstracts S3 operations for saving and retrieving reports and screenshots
 *
 * Usage:
 *   import { storage } from '@/lib/storage';
 *   const result = await storage.saveReport(agentId, jobId, reportJson);
 */

import { readFile, unlink } from 'fs/promises';
import { getS3Client } from './s3Client';
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

interface StorageResult {
  key: string;
  bucket: string;
  url: string;
}

interface Report {
  jobId: string;
  agentId: string;
  timestamp: string;
  overallStatus: string;
  [key: string]: any;
}

class StorageService {
  private bucket: string;
  private region: string;
  private prefix: string;
  private signedUrlExpiration: number;
  private initialized = false;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'qa-agents-reports-dev';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.prefix = process.env.S3_PREFIX || 'qa-agents/';
    this.signedUrlExpiration = parseInt(
      process.env.S3_SIGNED_URL_EXPIRATION || '3600',
      10
    );
  }

  /**
   * Initialize and verify S3 bucket access
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const client = getS3Client();
      const cmd = new HeadBucketCommand({ Bucket: this.bucket });
      await client.send(cmd);
      this.initialized = true;
      console.log(`[Storage] S3 bucket verified: ${this.bucket}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[Storage] Warning: Could not verify S3 bucket: ${error}`);
      console.warn(
        `[Storage] Ensure S3_BUCKET="${this.bucket}" exists and credentials are configured`
      );
    }
  }

  /**
   * Save report JSON to S3
   * @param agentId Agent identifier
   * @param jobId Job identifier
   * @param reportJson Report object
   * @returns {key, bucket, url}
   */
  async saveReport(
    agentId: string,
    jobId: string,
    reportJson: any
  ): Promise<StorageResult> {
    await this.initialize();

    const key = this.getReportKey(agentId, jobId);
    const body = JSON.stringify(reportJson, null, 2);

    try {
      const client = getS3Client();
      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        Metadata: {
          'agent-id': agentId,
          'job-id': jobId,
          'saved-at': new Date().toISOString(),
        },
      });

      await client.send(cmd);

      const url = `s3://${this.bucket}/${key}`;
      console.log(`[Storage] Report saved: ${url}`);

      return { key, bucket: this.bucket, url };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to save report to S3: ${error}`);
    }
  }

  /**
   * Save screenshot to S3
   * @param agentId Agent identifier
   * @param jobId Job identifier
   * @param filePath Local file path
   * @param stepNumber Step identifier/number
   * @returns {key, bucket, url}
   */
  async saveScreenshot(
    agentId: string,
    jobId: string,
    filePath: string,
    stepNumber: string | number
  ): Promise<StorageResult> {
    await this.initialize();

    const key = this.getScreenshotKey(agentId, jobId, stepNumber);

    try {
      const body = await readFile(filePath);

      const client = getS3Client();
      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'image/png',
        Metadata: {
          'agent-id': agentId,
          'job-id': jobId,
          'step': String(stepNumber),
          'saved-at': new Date().toISOString(),
        },
      });

      await client.send(cmd);

      const url = `s3://${this.bucket}/${key}`;
      console.log(`[Storage] Screenshot saved: ${url}`);

      // Optionally delete local file after upload
      try {
        await unlink(filePath);
      } catch (err) {
        console.warn(`[Storage] Could not delete local file: ${filePath}`);
      }

      return { key, bucket: this.bucket, url };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to save screenshot to S3: ${error}`);
    }
  }

  /**
   * Get signed URL for accessing an S3 object
   * @param s3Key S3 object key
   * @param expirationSeconds URL expiration time (default: 3600)
   * @returns Signed URL
   */
  async getSignedUrl(s3Key: string, expirationSeconds?: number): Promise<string> {
    await this.initialize();

    const expiration = expirationSeconds || this.signedUrlExpiration;

    try {
      const client = getS3Client();
      const cmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      const url = await getS3SignedUrl(client, cmd, {
        expiresIn: expiration,
      });

      return url;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }

  /**
   * Retrieve report JSON from S3
   * @param agentId Agent identifier
   * @param jobId Job identifier
   * @returns Report object
   */
  async getReport(agentId: string, jobId: string): Promise<any> {
    await this.initialize();

    const key = this.getReportKey(agentId, jobId);

    try {
      const client = getS3Client();
      const cmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await client.send(cmd);
      const chunks: Uint8Array[] = [];

      // Handle streaming response
      if (response.Body) {
        const reader = response.Body as any;
        if (reader[Symbol.asyncIterator]) {
          for await (const chunk of reader) {
            chunks.push(chunk);
          }
        }
      }

      const body = Buffer.concat(chunks).toString('utf-8');
      return JSON.parse(body);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to retrieve report from S3: ${error}`);
    }
  }

  /**
   * List reports for an agent
   * @param agentId Agent identifier
   * @param limit Number of reports to return
   * @returns Array of report metadata
   */
  async listReports(agentId: string, limit = 50): Promise<Report[]> {
    await this.initialize();

    const prefix = this.getAgentPrefix(agentId);

    try {
      const client = getS3Client();
      const cmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: limit,
        Delimiter: '/',
      });

      const response = await client.send(cmd);
      const reports: Report[] = [];

      if (!response.CommonPrefixes) {
        return reports;
      }

      // Each CommonPrefix is a jobId folder
      for (const commonPrefix of response.CommonPrefixes) {
        const jobPrefix = commonPrefix.Prefix;
        if (!jobPrefix) continue;

        // Extract jobId from prefix
        const jobId = jobPrefix.split('/').filter(Boolean).pop();
        if (!jobId) continue;

        try {
          const report = await this.getReport(agentId, jobId);
          reports.push(report);
        } catch (err) {
          console.warn(
            `[Storage] Could not load report for job ${jobId}: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      return reports;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[Storage] Failed to list reports: ${error}`);
      return [];
    }
  }

  /**
   * Get S3 key for a report
   */
  private getReportKey(agentId: string, jobId: string): string {
    return `${this.prefix}${agentId}/${jobId}/report.json`;
  }

  /**
   * Get S3 key for a screenshot
   */
  private getScreenshotKey(
    agentId: string,
    jobId: string,
    stepNumber: string | number
  ): string {
    return `${this.prefix}${agentId}/${jobId}/screenshots/step-${stepNumber}.png`;
  }

  /**
   * Get S3 prefix for an agent
   */
  private getAgentPrefix(agentId: string): string {
    return `${this.prefix}${agentId}/`;
  }

  /**
   * Get bucket configuration info
   */
  getBucketInfo() {
    return {
      bucket: this.bucket,
      region: this.region,
      prefix: this.prefix,
      signedUrlExpiration: this.signedUrlExpiration,
    };
  }
}

// Singleton instance
let storageInstance: StorageService | null = null;

/**
 * Get the storage service instance
 */
export function getStorage(): StorageService {
  if (!storageInstance) {
    storageInstance = new StorageService();
  }
  return storageInstance;
}

// Export convenient named export
export const storage = getStorage();

export default storage;
