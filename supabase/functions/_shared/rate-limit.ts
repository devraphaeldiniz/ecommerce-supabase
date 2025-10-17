const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_REQUESTS = 100;

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = identifier;

  if (!store[key] || now > store[key].resetAt) {
    store[key] = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    };
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  store[key].count++;

  if (store[key].count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_REQUESTS - store[key].count };
}

export function rateLimitResponse() {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded',
      message: `Maximum ${MAX_REQUESTS} requests per minute`
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    }
  );
}