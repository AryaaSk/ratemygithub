import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy — only construct when env is present. If Upstash env is missing, the
// limiters short-circuit to "allow all" so local dev keeps working.
let _ipLimiter: Ratelimit | null = null;
let _loginLimiter: Ratelimit | null = null;

function redis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function ipLimiter() {
  if (_ipLimiter) return _ipLimiter;
  const r = redis();
  if (!r) return null;
  _ipLimiter = new Ratelimit({
    redis: r,
    // 5 submissions / hour / IP
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    analytics: false,
    prefix: "rmg/ip",
  });
  return _ipLimiter;
}

function loginLimiter() {
  if (_loginLimiter) return _loginLimiter;
  const r = redis();
  if (!r) return null;
  _loginLimiter = new Ratelimit({
    redis: r,
    // 1 rating per GitHub login per 24h — cost-control gate.
    limiter: Ratelimit.slidingWindow(1, "24 h"),
    analytics: false,
    prefix: "rmg/login",
  });
  return _loginLimiter;
}

export async function checkIpLimit(ip: string) {
  const l = ipLimiter();
  if (!l) return { ok: true as const, remaining: Infinity };
  const r = await l.limit(`ip:${ip}`);
  return { ok: r.success, remaining: r.remaining, reset: r.reset };
}

export async function checkLoginLimit(login: string) {
  const l = loginLimiter();
  if (!l) return { ok: true as const, remaining: Infinity };
  const r = await l.limit(`login:${login.toLowerCase()}`);
  return { ok: r.success, remaining: r.remaining, reset: r.reset };
}
