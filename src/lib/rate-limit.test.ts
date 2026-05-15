import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit token bucket", () => {
  it("allows up to capacity, then rejects", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(key, { capacity: 10, refillPerSecond: 0.01 }).ok).toBe(true);
    }
    expect(rateLimit(key, { capacity: 10, refillPerSecond: 0.01 }).ok).toBe(false);
  });

  it("isolates buckets by key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, { capacity: 1, refillPerSecond: 0.01 }).ok).toBe(true);
    expect(rateLimit(a, { capacity: 1, refillPerSecond: 0.01 }).ok).toBe(false);
    expect(rateLimit(b, { capacity: 1, refillPerSecond: 0.01 }).ok).toBe(true);
  });
});
