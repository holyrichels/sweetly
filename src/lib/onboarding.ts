import type { ImperativeRouter } from "expo-router";

import { getPendingInvite } from "@/lib/invite-link";
import { supabase } from "@/lib/supabase";

// Куда идти после входа или регистрации: без пары — выбрать дату, с парой — на главную
export async function routeAfterAuth(
  router: Pick<ImperativeRouter, "replace">,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const { data: member } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (getPendingInvite()) {
    router.replace("/invite");

    return;
  }

  router.replace(member ? "/" : "/start-date");
}
