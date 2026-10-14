import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = "https://lodzbjnakrweelsotnim.supabase.co";

const supabasePublishableKey = "sb_publishable_tCl2mvi0SCdq1HVYBL6lgA_YlbMIEFJ";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // В браузере читаем ссылку из письма (восстановление пароля), в приложении не нужно
    detectSessionInUrl: Platform.OS === "web",
  },
});
