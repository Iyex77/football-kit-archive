"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase-auth";
import type { Profile } from "../lib/types";
import { notify } from "../lib/notify";
import { AppDrawer } from "./AppDrawer";
import { TextField } from "./FormControls";

type ProfileSettingsPageProps = {
  onLogout: () => Promise<void> | void;
};

const publicProfileUrl = (username: string) =>
  `https://football-kit-archive.vercel.app/u/${username}`;

export function ProfileSettingsPage({ onLogout }: ProfileSettingsPageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showCollection, setShowCollection] = useState(true);
  const [showWishlist, setShowWishlist] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanUsername = username.trim().toLowerCase();
  const publicUrl = cleanUsername ? publicProfileUrl(cleanUsername) : "";
  const publicPath = cleanUsername ? `/u/${cleanUsername}` : "#";

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, is_public, show_collection, show_wishlist, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setUserId(user.id);
      if (!error && data) {
        const loadedProfile = data as Profile;
        setProfile(loadedProfile);
        setUsername(loadedProfile.username || "");
        setDisplayName(loadedProfile.display_name || "");
        setIsPublic(loadedProfile.is_public);
        setShowCollection(loadedProfile.show_collection ?? true);
        setShowWishlist(loadedProfile.show_wishlist ?? true);
      }
      setIsLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!userId) {
      notify.error("Sesion expirada, inicia sesion otra vez.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      notify.error("El username debe tener 3-30 caracteres: letras, numeros o guion bajo.");
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: cleanUsername,
        display_name: displayName.trim() || null,
        is_public: isPublic,
        show_collection: showCollection,
        show_wishlist: showWishlist,
      })
      .select("id, username, display_name, is_public, show_collection, show_wishlist, created_at")
      .single();

    setIsSaving(false);

    if (error) {
      notify.error(error.message || "No se pudo guardar el perfil.");
      return;
    }

    const savedProfile = data as Profile;
    setProfile(savedProfile);
    setUsername(savedProfile.username);
    setDisplayName(savedProfile.display_name || "");
    setIsPublic(savedProfile.is_public);
    setShowCollection(savedProfile.show_collection ?? true);
    setShowWishlist(savedProfile.show_wishlist ?? true);
    notify.success("Perfil guardado");
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-7 text-slate-100 sm:px-6 lg:px-10">
      <AppDrawer profile={profile} onLogout={onLogout} />
      <div className="mx-auto max-w-[960px] space-y-8">
        <header className="hero-panel profile-hero">
          <div>
            <p className="eyebrow">Perfil y vitrina</p>
            <h1>Perfil publico</h1>
            <p>Gestiona tu identidad, enlace compartible y visibilidad publica desde un unico sitio.</p>
          </div>
        </header>

        {isLoading ? (
          <section className="profile-panel">
            <p>Cargando perfil...</p>
          </section>
        ) : (
          <section className="profile-panel">
            <div className="section-heading">
              <div>
                <p>Perfil</p>
                <h2>Identidad publica</h2>
              </div>
            </div>

            <div className="profile-avatar-row">
              <div className="profile-avatar-placeholder" aria-hidden="true">
                {(displayName || username || "?").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3>Avatar</h3>
                <p>Preparado para subir una imagen de perfil mas adelante.</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <TextField
                label="Username"
                value={username}
                placeholder="sergiogil"
                onChange={setUsername}
              />
              <TextField
                label="Nombre visible"
                value={displayName}
                placeholder="Sergio Gil"
                onChange={setDisplayName}
              />
            </div>

            <div className="profile-share-card">
              <label className="field">
                <span>Enlace publico</span>
                <input value={publicUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              </label>
              <div className="profile-actions">
                <a className={`ghost-button ${publicUrl ? "" : "is-disabled"}`} href={publicPath}>
                  Abrir vitrina
                </a>
                <button className="ghost-button" type="button" onClick={handleCopy} disabled={!publicUrl}>
                  {copied ? "Copiado" : "Copiar enlace"}
                </button>
              </div>
            </div>

            <div className="profile-public-card">
              <div>
                <p className="eyebrow">Visibilidad</p>
                <h3>Vitrina publica</h3>
                <p>
                  Estos controles afectan a tu URL publica. Si ocultas coleccion y wishlist, el perfil seguira visible
                  con un aviso.
                </p>
              </div>
              <div className="profile-toggle-stack">
                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  <span>Perfil publico</span>
                </label>
                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={showCollection}
                    onChange={(event) => setShowCollection(event.target.checked)}
                  />
                  <span>Mostrar coleccion</span>
                </label>
                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={showWishlist}
                    onChange={(event) => setShowWishlist(event.target.checked)}
                  />
                  <span>Mostrar wishlist</span>
                </label>
              </div>
            </div>

            <div className="profile-future-card">
              <h3>Preferencias e informacion de cuenta</h3>
              <p>Espacio preparado para idioma, orden por defecto, campos visibles e imagenes destacadas.</p>
              <p>ID de usuario: {userId || "No disponible"}</p>
            </div>

            <div className="profile-actions">
              <button className="primary-button" type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar perfil y vitrina"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
