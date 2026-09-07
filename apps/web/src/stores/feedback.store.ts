import { defineStore } from "pinia";
import { ref } from "vue";

export type FeedbackTone = "success" | "error";
export type FeedbackAction = { label: string; route: string };
export type FeedbackToast = { id: number; tone: FeedbackTone; message: string; action?: FeedbackAction };

export const useFeedbackStore = defineStore("feedback", () => {
  const toast = ref<FeedbackToast | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 0;

  function show(tone: FeedbackTone, message: string, action?: FeedbackAction): void {
    if (timer !== undefined) clearTimeout(timer);
    toast.value = { id: ++nextId, tone, message, action };
    timer = setTimeout(() => {
      toast.value = null;
      timer = undefined;
    }, 4200);
  }

  function success(message: string, action?: FeedbackAction): void {
    show("success", message, action);
  }

  function failure(message: string): void {
    show("error", message);
  }

  function dismiss(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    toast.value = null;
  }

  return { toast, success, failure, dismiss };
});
