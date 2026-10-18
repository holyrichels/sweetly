import { refreshAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

// Создаёт пару с датой начала. Возвращает текст ошибки или null, если всё прошло.
export async function createCoupleWithDate(date: string): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return "Сессия не найдена, войдите заново";

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // Id задаём сами: строку пары не читаем обратно, пока пользователь не стал участником
  const coupleId = crypto.randomUUID();

  const { error: coupleError } = await supabase.from("couples").insert({
    id: coupleId,
    invite_code: code,
    relationship_status: "влюбленные",
    relationship_date: date,
  });

  if (coupleError) return coupleError.message;

  const { error: memberError } = await supabase
    .from("couple_members")
    .insert({ couple_id: coupleId, user_id: session.user.id });

  if (memberError) return memberError.message;

  await supabase.from("couple_miss_counts").insert({
    couple_id: coupleId,
    user_one_id: session.user.id,
    user_one_count: 0,
    user_two_count: 0,
  });

  await refreshAppData();

  return null;
}
