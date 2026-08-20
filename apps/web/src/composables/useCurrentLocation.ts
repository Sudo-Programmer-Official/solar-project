import { ref } from "vue";

export function useCurrentLocation() {
  const latitude = ref<number | null>(null);
  const longitude = ref<number | null>(null);
  const label = ref("");
  const loading = ref(false);
  const error = ref<string | null>(null);

  const refresh = async () => {
    loading.value = true;
    error.value = null;

    if (!navigator.geolocation) {
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
          loading.value = false;
          resolve();
        },
        (message) => {
          error.value = message.code === 1 ? "Permission denied for current location" : "Geolocation unavailable";
          loading.value = false;
          resolve();
        },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    });
  };

  return { latitude, longitude, label, loading, error, refresh };
}
