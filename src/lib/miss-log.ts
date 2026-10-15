import { supabase } from "@/lib/supabase";

// Запоминаем нажатие «Скучаю» за сегодня, чтобы показать статистику по дням
export async function logMiss(coupleId: string, userId: string) {
  const now = new Date();

  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  await supabase.from("couple_miss_log").insert({
    couple_id: coupleId,
    user_id: userId,
    day,
  });
}
