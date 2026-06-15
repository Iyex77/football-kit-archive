import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { ShirtCollectionApp } from "../../components/ShirtCollectionApp";
import type { Profile, Shirt } from "../../lib/types";

export const dynamic = "force-dynamic";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const normalizedUsername = decodeURIComponent(username).trim().toLowerCase();

  if (!normalizedUsername) {
    notFound();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_public, show_collection, show_wishlist, created_at")
    .eq("username", normalizedUsername)
    .eq("is_public", true)
    .maybeSingle();

  if (profileError || !profile) {
    notFound();
  }

  let shirtsQuery = supabase
    .from("shirts")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (!profile.show_collection && !profile.show_wishlist) {
    shirtsQuery = shirtsQuery.eq("status", "__hidden__");
  } else if (!profile.show_collection) {
    shirtsQuery = shirtsQuery.neq("status", "collection");
  } else if (!profile.show_wishlist) {
    shirtsQuery = shirtsQuery.neq("status", "wishlist");
  }

  const { data: shirts, error: shirtsError } = await shirtsQuery;

  if (shirtsError) {
    notFound();
  }

  return (
    <ShirtCollectionApp
      initialShirts={(shirts ?? []) as Shirt[]}
      publicProfile={profile as Profile}
      defaultViewMode="all"
      readOnly
    />
  );
}
