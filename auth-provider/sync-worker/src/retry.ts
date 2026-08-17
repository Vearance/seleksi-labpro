export const MAX_ATTEMPTS = 5;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

/**
 * delay = min(MAX, BASE * 2^(attempt-1))
 * multiplied by a random factor in [0.5, 1.0] to spread retries.
 */
export function backoffMs(attempt: number): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}
