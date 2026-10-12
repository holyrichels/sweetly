import { supabase } from "@/lib/supabase";

// Куда идти после входа или регистрации: без пары — выбрать дату, с парой — на главную
export async function routeAfterAuth(router: { replace: (path: string) => void }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const { data: member } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  router.replace(member ? "/" : "/start-date");
}
