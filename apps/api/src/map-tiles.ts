const OPEN_STREET_MAP_TILE_BASE_URL = "https://tile.openstreetmap.org";
const OPEN_STREET_MAP_REFERER = "https://solar-web-zeta-one.vercel.app/";
const OPEN_STREET_MAP_USER_AGENT = "BlackOps Field/1.0 (+https://solar-web-zeta-one.vercel.app/)";
const MAX_TILE_ZOOM = 19;

export class MapTileProviderError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "MapTileProviderError";
  }
}

export function validateTileCoordinates(zoom: number, x: number, y: number): boolean {
  if (!Number.isInteger(zoom) || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (zoom < 0 || zoom > MAX_TILE_ZOOM) return false;
  const worldTiles = 2 ** zoom;
  return x >= 0 && x < worldTiles && y >= 0 && y < worldTiles;
}

export function buildOpenStreetMapTileUrl(zoom: number, x: number, y: number): string {
  return `${OPEN_STREET_MAP_TILE_BASE_URL}/${zoom}/${x}/${y}.png`;
}

export async function fetchOpenStreetMapTile(
  zoom: number,
  x: number,
  y: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ body: Buffer; contentType: string }> {
  if (!validateTileCoordinates(zoom, x, y)) {
    throw new MapTileProviderError("Invalid map tile coordinates.", 400);
  }

  let response: Response;
  try {
    response = await fetchImpl(buildOpenStreetMapTileUrl(zoom, x, y), {
      headers: {
        accept: "image/png,image/*;q=0.8",
        "user-agent": OPEN_STREET_MAP_USER_AGENT,
        referer: OPEN_STREET_MAP_REFERER,
      },
    });
  } catch (error) {
    throw new MapTileProviderError(
      `OpenStreetMap tile request failed: ${error instanceof Error ? error.message : "network error"}.`,
    );
  }

  if (!response.ok) {
    throw new MapTileProviderError(
      `OpenStreetMap tile request failed with status ${response.status}.`,
      response.status === 404 ? 404 : 502,
    );
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/png",
  };
}
