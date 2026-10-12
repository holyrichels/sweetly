import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { supabase } from '@/lib/supabase';
import { clearAppData, refreshAppData, startAppRealtime } from '@/lib/app-data';

SplashScreen.preventAutoHideAsync();

const SUPABASE_URL = 'https://lodzbjnakrweelsotnim.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tCl2mvi0SCdq1HVYBL6lgA_YlbMIEFJ';

function loadTelegramScript(): Promise<void> {
  if ((window as any).Telegram?.WebApp) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не загрузился скрипт Telegram'));
    document.head.appendChild(script);
  });
}

// Вход через Telegram работает только для уже привязанного аккаунта.
// Если привязки нет, ничего не делаем и показываем обычный экран входа.
async function signInWithTelegramWeb(): Promise<void> {
  if (Platform.OS !== 'web') return;

  await loadTelegramScript();

  const tg = (window as any).Telegram?.WebApp;
  const initData: string | undefined = tg?.initData;

  if (!initData) return;

  tg.ready();
  tg.expand();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ initData }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? 'Ошибка входа через Telegram');
  }

  if (!result.linked) return;

  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.token_hash,
    type: 'magiclink',
  });

  if (error) throw error;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (current) {
        setSession(current);
        setChecked(true);
        return;
      }

      try {
        await signInWithTelegramWeb();
      } catch (error) {
        console.log('Telegram login error:', error);
      }

      if (active) setChecked(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Общие данные пары грузим сразу после входа, чтобы страницы открывались готовыми
  useEffect(() => {
    // Ждём, пока проверили вход, иначе экран покажет "нет пары" до загрузки
    if (!checked) return;

    if (!session?.user?.id) {
      clearAppData();

      return;
    }

    refreshAppData();

    return startAppRealtime(session.user.id);
  }, [checked, session?.user?.id]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {session ? <AppTabs /> : checked ? <Slot /> : null}
    </ThemeProvider>
  );
}
