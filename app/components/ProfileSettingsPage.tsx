"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase-auth";
import type { Profile, Shirt } from "../lib/types";
import { notify } from "../lib/notify";
import { AppDrawer } from "./AppDrawer";
import { TextField } from "./FormControls";

type ProfileSettingsPageProps = {
  onLogout: () => Promise<void> | void;
};

type CropImage = {
  src: string;
  width: number;
  height: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const avatarBucket = "avatars";
const avatarSize = 512;
const cropPreviewSize = 280;
const maxAvatarSize = 2 * 1024 * 1024;
const acceptedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];
const profileSelect = "id, username, display_name, avatar_url, is_public, show_collection, show_wishlist, created_at";
const publicProfileUrl = (username: string) =>
  `https://football-kit-archive.vercel.app/u/${username}`;
const exportFields = [
  "id",
  "sport",
  "category",
  "team",
  "customTeam",
  "season",
  "player",
  "number",
  "kitType",
  "size",
  "status",
  "country",
  "league",
  "notes",
  "imageUrl",
  "created_at",
  "updated_at",
] as const;

type ExportField = (typeof exportFields)[number];
type ExportRow = Record<ExportField, string>;

const getInitial = (displayName: string, username: string) =>
  (displayName || username || "?").slice(0, 1).toUpperCase();

const getAvatarPath = (userId: string) => `${userId}/avatar.webp`;

const formatDate = (value?: string) => {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getExportDate = () => new Date().toISOString().slice(0, 10);

const csvEscape = (value: string) => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const getMainImageUrl = (shirt: Shirt) => {
  const mainImage = shirt.images?.find((image) => image.id === shirt.mainImageId) || shirt.images?.[0];
  return mainImage?.url || "";
};

const toExportRow = (shirt: Shirt): ExportRow => {
  const shirtWithOptionalFields = shirt as Shirt & {
    customTeam?: string | null;
    imageUrl?: string | null;
    updated_at?: string | null;
  };

  return {
    id: shirt.id || "",
    sport: shirt.sport || "",
    category: shirt.category || "",
    team: shirt.team || "",
    customTeam: shirtWithOptionalFields.customTeam || "",
    season: shirt.season || "",
    player: shirt.player || "",
    number: shirt.number || "",
    kitType: shirt.kitType || "",
    size: shirt.size || "",
    status: shirt.status || "",
    country: shirt.country || "",
    league: shirt.league || "",
    notes: shirt.notes || "",
    imageUrl: shirtWithOptionalFields.imageUrl || getMainImageUrl(shirt),
    created_at: shirt.created_at || "",
    updated_at: shirtWithOptionalFields.updated_at || "",
  };
};

const downloadTextFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportRowsToCsv = (rows: ExportRow[]) => {
  const header = exportFields.join(",");
  const body = rows.map((row) => exportFields.map((field) => csvEscape(row[field])).join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export function ProfileSettingsPage({ onLogout }: ProfileSettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showCollection, setShowCollection] = useState(true);
  const [showWishlist, setShowWishlist] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cropImage, setCropImage] = useState<CropImage | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  const cleanUsername = username.trim().toLowerCase();
  const publicUrl = cleanUsername ? publicProfileUrl(cleanUsername) : "";
  const publicPath = cleanUsername ? `/u/${cleanUsername}` : "#";
  const accountCreatedAt = profile?.created_at || authUser?.created_at;

  const cropMetrics = useMemo(() => {
    if (!cropImage) return null;
    const baseScale = cropPreviewSize / Math.min(cropImage.width, cropImage.height);
    const scale = baseScale * cropZoom;
    const width = cropImage.width * scale;
    const height = cropImage.height * scale;
    const maxX = Math.max(0, (width - cropPreviewSize) / 2);
    const maxY = Math.max(0, (height - cropPreviewSize) / 2);

    return {
      scale,
      width,
      height,
      offsetX: clamp(cropOffset.x, -maxX, maxX),
      offsetY: clamp(cropOffset.y, -maxY, maxY),
    };
  }, [cropImage, cropOffset.x, cropOffset.y, cropZoom]);

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
        .select(profileSelect)
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setAuthUser(user);
      setUserId(user.id);
      if (!error && data) {
        const loadedProfile = data as Profile;
        setProfile(loadedProfile);
        setUsername(loadedProfile.username || "");
        setDisplayName(loadedProfile.display_name || "");
        setAvatarUrl(loadedProfile.avatar_url || "");
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

  const syncSavedProfile = (savedProfile: Profile) => {
    setProfile(savedProfile);
    setUsername(savedProfile.username);
    setDisplayName(savedProfile.display_name || "");
    setAvatarUrl(savedProfile.avatar_url || "");
    setIsPublic(savedProfile.is_public);
    setShowCollection(savedProfile.show_collection ?? true);
    setShowWishlist(savedProfile.show_wishlist ?? true);
  };

  const closeAvatarCropper = useCallback(() => {
    setCropImage(null);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setIsDraggingCrop(false);
    dragStateRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    if (!cropImage) return;

    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAvatarCropper();
      }
    };

    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [closeAvatarCropper, cropImage]);

  const handleSave = async () => {
    if (!userId) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      notify.error("El username debe tener 3-30 caracteres: letras, números o guion bajo.");
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: cleanUsername,
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl || null,
        is_public: isPublic,
        show_collection: showCollection,
        show_wishlist: showWishlist,
      })
      .select(profileSelect)
      .single();

    setIsSaving(false);

    if (error) {
      notify.error(error.message || "No se pudo guardar el perfil.");
      return;
    }

    syncSavedProfile(data as Profile);
    notify.success("Perfil guardado");
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !userId) return;

    if (!acceptedAvatarTypes.includes(file.type)) {
      notify.error("El avatar debe ser JPG, PNG o WebP.");
      return;
    }

    if (file.size > maxAvatarSize) {
      notify.error("El avatar no puede superar 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || "");
      try {
        const image = await loadImage(src);
        setCropImage({ src, width: image.naturalWidth, height: image.naturalHeight });
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
      } catch {
        notify.error("No se pudo leer la imagen.");
      }
    };
    reader.readAsDataURL(file);
  };

  const createCroppedAvatar = async () => {
    if (!cropImage || !cropMetrics) return null;

    const image = await loadImage(cropImage.src);
    const canvas = document.createElement("canvas");
    canvas.width = avatarSize;
    canvas.height = avatarSize;
    const context = canvas.getContext("2d");

    if (!context) return null;

    const displayLeft = cropPreviewSize / 2 + cropMetrics.offsetX - cropMetrics.width / 2;
    const displayTop = cropPreviewSize / 2 + cropMetrics.offsetY - cropMetrics.height / 2;
    const sourceX = (0 - displayLeft) / cropMetrics.scale;
    const sourceY = (0 - displayTop) / cropMetrics.scale;
    const sourceSize = cropPreviewSize / cropMetrics.scale;

    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      avatarSize,
      avatarSize,
    );

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.86);
    });
  };

  const handleSaveAvatar = async () => {
    if (!userId || !cropImage) return;

    setIsUploadingAvatar(true);
    const blob = await createCroppedAvatar();

    if (!blob) {
      setIsUploadingAvatar(false);
      notify.error("No se pudo preparar el avatar.");
      return;
    }

    const path = getAvatarPath(userId);
    const { error: uploadError } = await supabase.storage
      .from(avatarBucket)
      .upload(path, blob, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      setIsUploadingAvatar(false);
      notify.error(uploadError.message || "No se pudo subir el avatar.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(avatarBucket).getPublicUrl(path);

    const nextAvatarUrl = `${publicUrl}?v=${Date.now()}`;
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: nextAvatarUrl })
      .eq("id", userId)
      .select(profileSelect)
      .single();

    setIsUploadingAvatar(false);

    if (error) {
      notify.error(error.message || "Avatar subido, pero no se pudo guardar en el perfil.");
      return;
    }

    closeAvatarCropper();
    syncSavedProfile(data as Profile);
    notify.success("Avatar actualizado");
  };

  const handleRemoveAvatar = async () => {
    if (!userId) return;

    setIsRemovingAvatar(true);
    await supabase.storage.from(avatarBucket).remove([
      `${userId}/avatar.webp`,
      `${userId}/avatar.jpg`,
      `${userId}/avatar.jpeg`,
      `${userId}/avatar.png`,
    ]);

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId)
      .select(profileSelect)
      .single();

    setIsRemovingAvatar(false);

    if (error) {
      notify.error(error.message || "No se pudo quitar el avatar.");
      return;
    }

    syncSavedProfile(data as Profile);
    notify.success("Avatar eliminado");
  };

  const handleCropPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropMetrics) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropMetrics.offsetX,
      originY: cropMetrics.offsetY,
    };
    setIsDraggingCrop(true);
  };

  const handleCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !cropMetrics) return;

    const maxX = Math.max(0, (cropMetrics.width - cropPreviewSize) / 2);
    const maxY = Math.max(0, (cropMetrics.height - cropPreviewSize) / 2);
    setCropOffset({
      x: clamp(dragState.originX + event.clientX - dragState.startX, -maxX, maxX),
      y: clamp(dragState.originY + event.clientY - dragState.startY, -maxY, maxY),
    });
  };

  const handleCropPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsDraggingCrop(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      notify.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error("Las contraseñas no coinciden.");
      return;
    }

    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);

    if (error) {
      notify.error(error.message || "No se pudo cambiar la contraseña.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    notify.success("Contraseña actualizada");
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyUserId = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopiedUserId(true);
    window.setTimeout(() => setCopiedUserId(false), 1800);
  };

  const loadExportRows = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return null;
    }

    const { data, error } = await supabase
      .from("shirts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      notify.error(error.message || "No se pudieron preparar los datos.");
      return null;
    }

    return (data as Shirt[]).map(toExportRow);
  };

  const handleDownloadExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    const rows = await loadExportRows();
    setIsExporting(false);

    if (!rows) return;

    const date = getExportDate();
    if (format === "json") {
      downloadTextFile(
        JSON.stringify(rows, null, 2),
        `football-kit-archive-export-${date}.json`,
        "application/json;charset=utf-8",
      );
      notify.success("Exportación JSON descargada");
      return;
    }

    downloadTextFile(
      exportRowsToCsv(rows),
      `football-kit-archive-export-${date}.csv`,
      "text/csv;charset=utf-8",
    );
    notify.success("Exportación CSV descargada");
  };

  const handleCopyJsonExport = async () => {
    setIsExporting(true);
    const rows = await loadExportRows();
    setIsExporting(false);

    if (!rows) return;

    await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    setCopiedJson(true);
    window.setTimeout(() => setCopiedJson(false), 1800);
    notify.success("JSON copiado");
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-5 text-slate-100 sm:px-6 sm:py-7 lg:px-10">
      <AppDrawer profile={profile} onLogout={onLogout} />
      <div className="mx-auto max-w-[960px] space-y-5 sm:space-y-8">
        <header className="hero-panel profile-hero">
          <div>
            <p className="eyebrow">Cuenta y vitrina</p>
            <h1>Perfil público</h1>
            <p>Gestiona tu identidad, seguridad y visibilidad pública desde un único sitio.</p>
          </div>
        </header>

        {isLoading ? (
          <section className="profile-panel">
            <p>Cargando perfil...</p>
          </section>
        ) : (
          <>
            <section className="profile-panel">
              <div className="section-heading">
                <div>
                  <p>Perfil</p>
                  <h2>Identidad pública</h2>
                </div>
              </div>

              <div className="profile-avatar-row">
                <div className="profile-avatar-preview" aria-hidden="true">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" />
                  ) : (
                    <span>{getInitial(displayName, username)}</span>
                  )}
                </div>
                <div className="profile-avatar-copy">
                  <h3>Avatar</h3>
                  <p>Imagen de tu cuenta y vitrina pública.</p>
                  <div className="profile-actions profile-actions-left">
                    <input
                      ref={fileInputRef}
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => handleAvatarFile(event.target.files?.[0])}
                    />
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar || isRemovingAvatar || !userId}
                    >
                      {avatarUrl ? "Cambiar avatar" : "Subir avatar"}
                    </button>
                    {avatarUrl ? (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar || isRemovingAvatar}
                      >
                        {isRemovingAvatar ? "Quitando..." : "Quitar avatar"}
                      </button>
                    ) : null}
                  </div>
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
                  <span>Enlace público</span>
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
                  <h3>Vitrina pública</h3>
                  <p>
                    Estos controles afectan a tu URL pública. Si ocultas colección y wishlist, el perfil seguirá
                    visible con un aviso.
                  </p>
                </div>
                <div className="profile-toggle-stack">
                  <label className="profile-toggle">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                    />
                    <span>Perfil público</span>
                  </label>
                  <label className="profile-toggle">
                    <input
                      type="checkbox"
                      checked={showCollection}
                      onChange={(event) => setShowCollection(event.target.checked)}
                    />
                    <span>Mostrar colección</span>
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

              <div className="profile-actions">
                <button className="primary-button" type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Guardando..." : "Guardar perfil y vitrina"}
                </button>
              </div>
            </section>

            <section className="profile-panel">
              <div className="section-heading">
                <div>
                  <p>Seguridad</p>
                  <h2>Cambiar contraseña</h2>
                </div>
              </div>
              <div className="profile-form-grid">
                <label className="field">
                  <span>Nueva contraseña</span>
                  <input
                    type="password"
                    value={newPassword}
                    minLength={8}
                    autoComplete="new-password"
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Confirmar contraseña</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    minLength={8}
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              </div>
              <div className="profile-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </div>
            </section>

            <section className="profile-panel">
              <div className="section-heading">
                <div>
                  <p>Cuenta</p>
                  <h2>Datos de cuenta</h2>
                </div>
              </div>
              <div className="account-list">
                <div className="account-row">
                  <span>Email</span>
                  <strong>{authUser?.email || "No disponible"}</strong>
                </div>
                <div className="account-row">
                  <span>ID de usuario</span>
                  <button type="button" onClick={handleCopyUserId} disabled={!userId}>
                    {copiedUserId ? "Copiado" : userId || "No disponible"}
                  </button>
                </div>
                <div className="account-row">
                  <span>Creada</span>
                  <strong>{formatDate(accountCreatedAt)}</strong>
                </div>
              </div>
              <div className="profile-actions">
                <button className="ghost-button" type="button" onClick={onLogout}>
                  Cerrar sesión
                </button>
              </div>
            </section>

            <section className="profile-panel">
              <div className="section-heading">
                <div>
                  <p>Backup</p>
                  <h2>Exportar datos</h2>
                </div>
              </div>
              <div className="export-card">
                <div>
                  <h3>Colección y wishlist</h3>
                  <p>Descarga una copia local para backup o para compartir tu colección fuera de la app.</p>
                </div>
                <div className="export-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => handleDownloadExport("json")}
                    disabled={isExporting || !userId}
                  >
                    Descargar JSON
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleDownloadExport("csv")}
                    disabled={isExporting || !userId}
                  >
                    Descargar CSV
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleCopyJsonExport}
                    disabled={isExporting || !userId}
                  >
                    {copiedJson ? "JSON copiado" : "Copiar JSON"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {cropImage && cropMetrics ? (
        <div
          className="avatar-crop-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Ajustar avatar"
          onClick={closeAvatarCropper}
        >
          <div className="avatar-crop-modal" onClick={(event) => event.stopPropagation()}>
            <div className="avatar-crop-header">
              <div>
                <p className="eyebrow">Avatar</p>
                <h2>Ajustar imagen</h2>
              </div>
              <button className="avatar-crop-close" type="button" onClick={closeAvatarCropper} aria-label="Cerrar">
                x
              </button>
            </div>

            <div
              className={`avatar-crop-frame ${isDraggingCrop ? "is-dragging" : ""}`}
              style={{ width: cropPreviewSize, height: cropPreviewSize }}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropImage.src}
                alt=""
                draggable={false}
                style={{
                  width: cropMetrics.width,
                  height: cropMetrics.height,
                  transform: `translate(calc(-50% + ${cropMetrics.offsetX}px), calc(-50% + ${cropMetrics.offsetY}px))`,
                }}
              />
              <span className="avatar-crop-mask" aria-hidden="true" />
            </div>

            <label className="avatar-zoom-control">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
              />
            </label>

            <div className="avatar-crop-actions">
              <button className="ghost-button" type="button" onClick={closeAvatarCropper}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={handleSaveAvatar} disabled={isUploadingAvatar}>
                {isUploadingAvatar ? "Guardando..." : "Guardar avatar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
