import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export function createServerSupabaseClient(authHeader: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan las variables de entorno de Supabase.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export async function getAuthenticatedUser(
  authHeader: string | null,
): Promise<
  | { user: User; supabase: ReturnType<typeof createServerSupabaseClient> }
  | { user: null; supabase: null }
> {
  const supabase = createServerSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, supabase: null };
  }

  return { user: data.user, supabase };
}
