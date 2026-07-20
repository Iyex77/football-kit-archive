// In-memory fixed-window rate limiter. Good enough to blunt casual abuse of a
// single warm serverless instance; it does NOT coordinate across instances, so
// it is not a hard guarantee under multi-instance scaling (e.g. Vercel). Swap
// for a shared store (e.g. Upstash Redis) if these routes need airtight
// enforcement.

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function isRateLimited(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;

  return bucket.count > limit;
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
