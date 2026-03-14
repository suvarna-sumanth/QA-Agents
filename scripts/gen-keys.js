const crypto = require('crypto');

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const secret = 'super-secret-jwt-token-must-be-at-least-32-characters';

const anonPayload = {
  iss: 'supabase',
  ref: 'project-ref',
  role: 'anon',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (100 * 365 * 24 * 60 * 60) // 100 years
};

const servicePayload = {
  iss: 'supabase',
  ref: 'project-ref',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (100 * 365 * 24 * 60 * 60) // 100 years
};

console.log('ANON_KEY=' + generateJWT(anonPayload, secret));
console.log('SERVICE_ROLE_KEY=' + generateJWT(servicePayload, secret));
