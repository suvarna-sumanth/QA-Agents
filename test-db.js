import { MemoryService } from './agents/core/memory/MemoryService.js';

async function test() {
  const memory = new MemoryService();
  const domain = 'test-domain.com';
  
  console.log('Testing updateSiteProfile...');
  await memory.updateSiteProfile(domain, {
    protection_type: 'perimeterx',
    has_instaread_player: true
  });
  
  console.log('Testing recallSiteProfile...');
  const profile = await memory.recallSiteProfile(domain);
  console.log('Recalled profile:', profile);

  console.log('Testing recordTestResult...');
  await memory.recordTestResult('job-test', `https://${domain}/article`, {
    overallStatus: 'pass',
    steps: [{ name: 'Step 1', status: 'pass' }],
    totalDuration: 5000
  });
  
  console.log('Testing getRecentResults...');
  const results = await memory.getRecentResults(domain);
  console.log('Recent results count:', results.length);
}

test();
