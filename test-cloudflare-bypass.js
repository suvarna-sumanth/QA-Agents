#!/usr/bin/env node
/**
 * Test script to verify Cloudflare bypass functionality
 */
import fetch from 'node-fetch';

const API_URL = 'http://localhost:9003/api/jobs';

async function testBypass() {
  console.log('Starting Cloudflare bypass test...\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mission: {
          site: 'https://thebrakereport.com/',
          articleUrls: ['https://thebrakereport.com/'],
        }
      }),
    });

    console.log(`API Response Status: ${response.status}\n`);
    
    if (response.status === 202) {
      console.log('✓ Job submitted successfully');
      const result = await response.json();
      console.log('Job ID:', result.jobId);
    } else {
      console.log('✗ Unexpected response status');
      const text = await response.text();
      console.log('Response:', text);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBypass().catch(console.error);
