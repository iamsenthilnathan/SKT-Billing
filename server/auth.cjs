const crypto = require('node:crypto');

const SESSION_COOKIE_NAME = 'skt_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  const pass = process.env.APP_PASSWORD || '';
  const user = process.env.APP_USERNAME || '';
  if (pass || user) {
    return `${pass}_${user}_skt_salt_2026`;
  }
  return 'skt_dev_fallback_secret_key_2026';
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function validateCredentials(username, password) {
  const expectedUser = process.env.APP_USERNAME;
  const expectedPass = process.env.APP_PASSWORD;
  if (!expectedUser || !expectedPass) {
    return false;
  }
  return safeCompare(username, expectedUser) && safeCompare(password, expectedPass);
}

function createSessionToken(username, ttlSeconds = SESSION_MAX_AGE_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    username,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp < now) {
      return null;
    }

    const expectedUser = process.env.APP_USERNAME;
    if (expectedUser && payload.username !== expectedUser) {
      return null;
    }

    return {
      username: payload.username,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;

  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift().trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

function isRequestSecure(req) {
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto.toLowerCase().includes('https')) {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

function createSetCookieHeader(token, req, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secureFlag = isRequestSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

function createClearCookieHeader(req) {
  const secureFlag = isRequestSecure(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateCredentials,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  isRequestSecure,
  createSetCookieHeader,
  createClearCookieHeader,
  getSessionFromRequest,
};
