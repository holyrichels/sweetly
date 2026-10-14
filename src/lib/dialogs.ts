import { Alert, Platform } from "react-native";

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
export function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
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
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  }
}
