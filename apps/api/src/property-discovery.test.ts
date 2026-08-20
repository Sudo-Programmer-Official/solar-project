import assert from "node:assert/strict";
import test from "node:test";
import { OverpassPropertyDiscoveryProvider, PropertyDiscoveryTimeoutError } from "./property-discovery";

test("Overpass discovery aborts and reports provider timeouts", async () => {
  let signal: AbortSignal | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
    });
  };
  const provider = new OverpassPropertyDiscoveryProvider(fetchImpl, 5);

  await assert.rejects(
    provider.discover({ latitude: 40.5071, longitude: -78.3942, radiusMiles: 1 }),
    (error: unknown) => error instanceof PropertyDiscoveryTimeoutError,
  );
  assert.equal(signal?.aborted, true);
});
