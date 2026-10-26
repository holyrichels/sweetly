import { Alert, Platform } from "react-native";

function runBrowserAlert(title: string, message: string) {
  const browserAlert = typeof window !== "undefined" ? window.alert?.bind(window) : globalThis.alert?.bind(globalThis);

  if (browserAlert) {
    browserAlert(`${title}\n\n${message}`);
    return true;
  }

  return false;
}

function runBrowserConfirm(title: string, message: string) {
  const browserConfirm = typeof window !== "undefined" ? window.confirm?.bind(window) : globalThis.confirm?.bind(globalThis);

  if (browserConfirm) {
    return browserConfirm(`${title}\n\n${message}`);
  }

  return false;
}

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
export function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    if (!runBrowserAlert(title, message)) {
      Alert.alert(title, message);
    }
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "Подтвердить",
) {
  if (Platform.OS === "web") {
    if (runBrowserConfirm(title, message)) {
      onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  } else {
    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  }
}
