import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";

import { supabase } from "@/lib/supabase";

const BOT_USERNAME = "heartbeat_couple_bot";
const SUPABASE_URL = "https://lodzbjnakrweelsotnim.supabase.co";
const SUPABASE_KEY = "sb_publishable_tCl2mvi0SCdq1HVYBL6lgA_YlbMIEFJ";

type Props = { onError?: (message: string) => void };

export default function TelegramLoginButton({ onError }: Props) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const container = containerRef.current as HTMLElement | null;
    if (!container) return;

    (window as any).onTelegramAuth = async (user: Record<string, unknown>) => {
      try {
        const widget: Record<string, string> = {};
        for (const [key, value] of Object.entries(user)) {
          if (value !== undefined && value !== null)
            widget[key] = String(value);
        }

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/telegram-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
            },
            body: JSON.stringify({ widget }),
          },
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Ошибка входа");

        const { error } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        });
        if (error) throw error;
      } catch (error) {
        onError?.((error as Error).message);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "14");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
      container.innerHTML = "";
    };
  }, [onError]);

  if (Platform.OS !== "web") return null;

  return (
    <View
      ref={containerRef}
      style={{ alignItems: "center", marginBottom: 16 }}
    />
  );
}
