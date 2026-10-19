import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Platform, View, useColorScheme } from 'react-native';
import { Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { PlayfairDisplay_700Bold, PlayfairDisplay_600SemiBold_Italic } from '@expo-google-fonts/playfair-display';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import OfflineScreen from '@/components/offline-screen';
import SkeletonScreen from '@/components/skeleton-screen';
import { clearAppData, refreshAppData, startAppRealtime } from '@/lib/app-data';
import { readInviteFromTelegram, savePendingInvite, getPendingInvite } from '@/lib/invite-link';
import { C } from '@/constants/sweetly-theme';
import { AppThemeProvider } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

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
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
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

  // Шрифты макета
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_700Bold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
  });

  const [session, setSession] = useState<any>(null);

  const [checked, setChecked] = useState(false);

  // Нет сети: показываем экран «Нет подключения»
  const [online, setOnline] = useState(true);

  const pathname = usePathname();

  const router = useRouter();

  // Экраны первого запуска показываются без панели вкладок
  const ONBOARDING = ['/welcome', '/login', '/register', '/start-date', '/connect', '/reset', '/new-password', '/invite'];

  const onboarding = ONBOARDING.includes(pathname);

  // Вход: проверяем сессию и слушаем изменения
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
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // Пришли по ссылке из письма о сбросе пароля
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/new-password' as any);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Состояние сети
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setOnline(window.navigator.onLine);

    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Открыли по ссылке-приглашению: запоминаем код и показываем приглашение
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let tries = 0;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // Telegram загружается не сразу, поэтому проверяем несколько секунд
    const check = () => {
      const code = readInviteFromTelegram();

      if (code) {
        savePendingInvite(code);

        if (pathname !== '/invite') router.replace('/invite' as any);

        return;
      }

      tries += 1;

      if (tries < 20) timer = setTimeout(check, 150);
    };

    check();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Есть непринятое приглашение (например, после регистрации): показываем его
  useEffect(() => {
    if (!checked) return;

    if (getPendingInvite() && pathname !== '/invite') {
      router.replace('/invite' as any);
    }
  }, [checked, pathname]);

  // Не вошёл — сразу на приветствие
  useEffect(() => {
    if (checked && !session && pathname === '/') {
      router.replace('/welcome' as any);
    }
  }, [checked, session, pathname]);

  // Общие данные пары: грузим после входа, очищаем при выходе
  useEffect(() => {
    if (!checked) return;

    if (!session?.user?.id) {
      clearAppData();

      return;
    }

    refreshAppData();

    return startAppRealtime(session.user.id);
  }, [checked, session?.user?.id]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppThemeProvider>
      <AnimatedSplashOverlay />

      {!online ? (
        <OfflineScreen onRetry={() => setOnline(window.navigator.onLine)} />
      ) : session && !onboarding ? (
        <AppTabs />
      ) : checked ? (
        // Экраны входа и первого запуска без вкладок: тот же отступ сверху, чтобы не закрывались кнопками Telegram
        <View style={{ flex: 1, paddingTop: onboarding ? 62 : 0, backgroundColor: C.background }}>
          <Slot />
        </View>
      ) : (
        <SkeletonScreen />
      )}
      </AppThemeProvider>
    </ThemeProvider>
  );
}
