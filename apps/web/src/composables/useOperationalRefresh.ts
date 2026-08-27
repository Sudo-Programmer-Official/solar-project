import { onMounted, onUnmounted } from "vue";

type RefreshCallback = () => void | Promise<void>;

/** Refresh operational data while a page is open and when the app regains focus. */
export function useOperationalRefresh(refresh: RefreshCallback, intervalMs = 20_000): void {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;

  const run = (): void => {
    if (inFlight) return;
    inFlight = true;
    Promise.resolve(refresh()).finally(() => {
      inFlight = false;
    });
  };
  const onFocus = (): void => run();
  const onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") run();
  };

  onMounted(() => {
    run();
    intervalId = setInterval(run, intervalMs);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
}
