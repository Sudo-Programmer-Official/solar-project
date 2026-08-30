import { ElNotification } from "element-plus";

type NotificationType = "success" | "warning" | "info" | "error";

export function useNotifications() {
  function notify(title: string, message: string, type: NotificationType) {
    ElNotification({
      title,
      message,
      type,
      duration: 2600,
      position: "top-right",
    });
  }

  function notifyError(message: string) {
    notify("BlackOps Field", message, "error");
  }

  function notifyWarning(message: string) {
    notify("BlackOps Field", message, "warning");
  }

  function notifySuccess(message: string) {
    notify("BlackOps Field", message, "success");
  }

  return {
    notifyError,
    notifyWarning,
    notifySuccess,
  };
}
