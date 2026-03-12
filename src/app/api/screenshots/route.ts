/**
 * GET /api/screenshots?key=<s3Key>
 * Returns a redirect to a signed S3 URL for the screenshot
 */

import { getStorage } from '@/lib/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const s3Key = searchParams.get('key');

  if (!s3Key) {
    return Response.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const storage = getStorage();
    const signedUrl = await storage.getSignedUrl(s3Key, 3600);
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error('[API] Screenshot fetch error:', error);
    return Response.json(
      { error: 'Failed to generate screenshot URL' },
      { status: 500 }
    );
  }
}
