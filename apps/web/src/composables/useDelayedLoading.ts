import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/**
 * Keeps short requests from causing a distracting loader flash while still
 * making slower requests obvious to people working in the field.
 */
export function useDelayedLoading(source: Ref<boolean>, delayMs = 140): Ref<boolean> {
  const visible = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  watch(source, (isLoading) => {
    clearTimer();
    if (!isLoading) {
      visible.value = false;
      return;
    }
    timer = setTimeout(() => {
      visible.value = true;
      timer = undefined;
    }, delayMs);
  }, { immediate: true });

  onBeforeUnmount(() => {
    clearTimer();
  });

  return visible;
}
