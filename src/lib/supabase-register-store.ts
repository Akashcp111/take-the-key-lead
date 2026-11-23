import { getSupabaseClient } from "@/lib/supabase";
import type { StoreData } from "@/lib/keyguard-service";

export async function loadRegisterState(userId: string): Promise<unknown | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("keyguard_registers")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.state ?? null;
}

export async function saveRegisterState(userId: string, state: StoreData): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("keyguard_registers").upsert(
    { user_id: userId, state, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export function userRegisterStorage(userId: string): Pick<Storage, "getItem" | "setItem"> {
  const key = `keyguard.register.${userId}.v1`;
  return {
    getItem: () => window.localStorage.getItem(key),
    setItem: (_storageKey, value) => window.localStorage.setItem(key, value),
  };
}
