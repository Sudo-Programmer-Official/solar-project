import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenStreetMapTileUrl, fetchOpenStreetMapTile, validateTileCoordinates } from "./map-tiles";

test("map tiles validate the Web Mercator tile range", () => {
  assert.equal(validateTileCoordinates(0, 0, 0), true);
  assert.equal(validateTileCoordinates(15, 17600, 10750), true);
  assert.equal(validateTileCoordinates(15, -1, 0), false);
  assert.equal(validateTileCoordinates(15, 32768, 0), false);
  assert.equal(validateTileCoordinates(20, 0, 0), false);
});

test("map tile proxy identifies itself to OpenStreetMap", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    requests.push({ input: args[0], init: args[1] });
    return new Response(Uint8Array.from([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };

  const tile = await fetchOpenStreetMapTile(12, 1200, 1500, fetchImpl);
  const headers = requests[0]?.init?.headers as Record<string, string>;

  assert.equal(buildOpenStreetMapTileUrl(12, 1200, 1500), "https://tile.openstreetmap.org/12/1200/1500.png");
  assert.equal(String(requests[0]?.input), "https://tile.openstreetmap.org/12/1200/1500.png");
  assert.equal(headers.referer, "https://solar-web-zeta-one.vercel.app/");
  assert.match(headers["user-agent"], /BlackOps Field/);
  assert.equal(tile.contentType, "image/png");
  assert.deepEqual([...tile.body], [1, 2, 3]);
});
