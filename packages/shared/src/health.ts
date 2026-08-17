/** Result of a single dependency probe. Deliberately contains no internals. */
export interface ComponentHealth {
  ok: boolean;
  latencyMs: number;
}

/**
 * Runs a readiness probe with a timeout so a dead dependency (DB, broker)
 * cannot hang the health endpoint. Resolves `{ ok: false }` on any failure.
 */
export async function pingComponent(
  probe: PromiseLike<unknown>,
  timeoutMs = 3_000,
): Promise<ComponentHealth> {
  const started = Date.now();
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("health check timed out")), timeoutMs);
      Promise.resolve(probe).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}
