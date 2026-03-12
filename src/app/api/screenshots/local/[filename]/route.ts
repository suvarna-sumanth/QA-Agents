import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  
  // Resolve path to the shivani screenshots directory
  // Note: This assumes the app is running in a location where it can reach the agent folder
  const screenshotPath = path.resolve(process.cwd(), 'agents/shivani/screenshots', filename);

  if (!fs.existsSync(screenshotPath)) {
    return new NextResponse('Screenshot not found', { status: 404 });
  }

  const imageBuffer = fs.readFileSync(screenshotPath);
  
  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
