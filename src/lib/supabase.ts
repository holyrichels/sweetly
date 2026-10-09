import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lodzbjnakrweelsotnim.supabase.co";

const supabasePublishableKey = "sb_publishable_tCl2mvi0SCdq1HVYBL6lgA_YlbMIEFJ";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
