"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase-auth";
import { AuthForm } from "./AuthForm";

type AuthenticatedRouteProps = {
  children: (props: { onLogout: () => Promise<void> }) => ReactNode;
};

export function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-7 text-slate-100 sm:px-6 lg:px-10">
        <div className="mx-auto flex min-h-[60vh] max-w-[1560px] items-center justify-center text-lg font-semibold">
          Cargando sesion...
        </div>
      </main>
    );
  }

  return session ? <>{children({ onLogout: handleSignOut })}</> : <AuthForm />;
}
