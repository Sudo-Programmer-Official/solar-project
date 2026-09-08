import { ref } from "vue";
import { isValidCoordinate } from "../../../../packages/geospatial/src/index";

export type CurrentLocationSource = "LIVE_DEVICE" | "RECENT_DEVICE" | null;

interface StoredCurrentLocation {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

export const CURRENT_LOCATION_KEY = "solar.current.location";

export function persistCurrentLocation(latitude: number, longitude: number, capturedAt = new Date().toISOString()) {
  if (typeof window === "undefined" || !isValidCoordinate({ latitude, longitude })) return;
  try {
    const stored: StoredCurrentLocation = { latitude, longitude, capturedAt };
    window.localStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(stored));
  } catch {
    // The caller can still use the live coordinates for this page.
  }
}

export function useCurrentLocation() {
  const latitude = ref<number | null>(null);
  const longitude = ref<number | null>(null);
  const label = ref("");
  const source = ref<CurrentLocationSource>(null);
  const capturedAt = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  hydrateStoredLocation();

  const refresh = async () => {
    loading.value = true;
    error.value = null;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      loading.value = false;
      error.value = "Geolocation unavailable";
      return;
    }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          latitude.value = position.coords.latitude;
          longitude.value = position.coords.longitude;
          label.value = "Current location";
          source.value = "LIVE_DEVICE";
          capturedAt.value = new Date().toISOString();
          persistCurrentLocation(latitude.value, longitude.value, capturedAt.value ?? undefined);
          loading.value = false;
          resolve();
        },
        (message) => {
          error.value = message.code === 1 ? "Permission denied for current location" : "Geolocation unavailable";
          if (latitude.value != null && longitude.value != null) {
            source.value = "RECENT_DEVICE";
            label.value = "Recent device location";
          }
          loading.value = false;
          resolve();
        },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    });
  };

  return { latitude, longitude, label, source, capturedAt, loading, error, refresh };

  function hydrateStoredLocation() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CURRENT_LOCATION_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<StoredCurrentLocation>;
      if (!isValidCoordinate({ latitude: stored.latitude, longitude: stored.longitude }) || typeof stored.capturedAt !== "string") return;
      latitude.value = stored.latitude as number;
      longitude.value = stored.longitude as number;
      capturedAt.value = stored.capturedAt;
      source.value = "RECENT_DEVICE";
      label.value = "Recent device location";
    } catch {
      // Ignore unavailable or malformed browser storage and use live location.
    }
  }

}
