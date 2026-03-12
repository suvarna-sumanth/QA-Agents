/**
 * AWS S3 Client Configuration
 * Initializes and exports a configured S3 client for use throughout the application
 */

import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

/**
 * Get or initialize the S3 client
 * Uses environment variables for configuration
 */
export function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const region = process.env.S3_REGION || 'us-east-1';

  // Configuration object
  const config: any = {
    region,
  };

  // Support LocalStack for local development
  if (process.env.LOCALSTACK_ENDPOINT) {
    config.endpoint = process.env.LOCALSTACK_ENDPOINT;
    config.forcePathStyle = true;
  }

  // AWS credentials (use environment variables or IAM role)
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  // Otherwise, credentials will come from:
  // - EC2 IAM role (auto via DefaultCredentialProvider)
  // - ECS task role
  // - Environment variables AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (standard)

  s3Client = new S3Client(config);

  console.log(
    `[S3Client] Initialized for region: ${region}${process.env.LOCALSTACK_ENDPOINT ? ' (LocalStack)' : ''}`
  );

  return s3Client;
}

/**
 * Close the S3 client (cleanup)
 */
export function closeS3Client() {
  if (s3Client) {
    s3Client.destroy();
    s3Client = null;
  }
}

export default getS3Client;
