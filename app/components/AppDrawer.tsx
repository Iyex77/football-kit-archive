"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { Profile } from "../lib/types";

type DrawerFilterPath = "/" | "/coleccion" | "/wishlist";

type AppDrawerProps = {
  profile: Profile | null;
  onLogout: () => Promise<void> | void;
  onSectionSelect?: () => void;
  isSuppressed?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  stats?: {
    total: number;
    collection: number;
    wishlist: number;
  };
};

type IconName =
  | "user"
  | "grid"
  | "layers"
  | "star"
  | "chart"
  | "spark"
  | "logout";

const filterSections: Array<{ href: DrawerFilterPath; label: string; icon: IconName }> = [
  { href: "/", label: "Todas las camisetas", icon: "layers" },
  { href: "/coleccion", label: "Mi colección", icon: "grid" },
  { href: "/wishlist", label: "Wishlist", icon: "star" },
];

const tabItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Inicio", icon: "layers" },
  { href: "/coleccion", label: "Colección", icon: "grid" },
  { href: "/wishlist", label: "Wishlist", icon: "star" },
  { href: "/estadisticas", label: "Stats", icon: "chart" },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    user: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm7 8a7 7 0 0 0-14 0" />,
    grid: <path d="M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z" />,
    layers: <path d="m12 3 9 5-9 5-9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
    chart: <path d="M4 19V5m0 14h17M8 16v-5m5 5V8m5 8v-9" />,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    logout: <path d="M10 17 5 12l5-5m-5 5h12m-5-8h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />,
  };

  return (
    <svg className="drawer-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

export function AppDrawer({
  profile,
  onLogout,
  onSectionSelect,
  isSuppressed = false,
  onOpenChange,
  stats,
}: AppDrawerProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const publicPath = profile?.username ? `/u/${profile.username}` : "";
  const shouldShowDrawer = isOpen && !isSuppressed;
  const displayName = profile?.display_name || profile?.username || "Mi cuenta";
  const username = profile?.username ? `@${profile.username}` : "Perfil privado";
  const initial = displayName.trim().charAt(0).toUpperCase() || "F";

  const close = () => setIsOpen(false);
  const itemClass = (href: string) => `drawer-link ${pathname === href ? "is-active" : ""}`;

  const open = () => {
    toast.dismiss();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    onOpenChange?.(shouldShowDrawer);
  }, [onOpenChange, shouldShowDrawer]);

  return (
    <>
      {!isSuppressed ? (
        <button
          className="app-menu-button"
          type="button"
          aria-label="Abrir menú"
          aria-expanded={isOpen}
          onClick={open}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      ) : null}

      {!isSuppressed ? (
        <nav className="tab-bar" aria-label="Navegación principal">
          {tabItems.map(({ href, label, icon }) => (
            <Link key={href} className={`tab-bar-item ${pathname === href ? "is-active" : ""}`} href={href}>
              <Icon name={icon} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {shouldShowDrawer ? <button className="drawer-backdrop" type="button" aria-label="Cerrar menú" onClick={close} /> : null}

      <aside className={`app-drawer ${shouldShowDrawer ? "is-open" : ""}`} aria-hidden={!shouldShowDrawer}>
        <div className="drawer-header">
          <div className="drawer-user-card">
            <div className="drawer-avatar" aria-hidden="true">
              {profile?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="drawer-user-copy">
              <p className="eyebrow">Football Kit Archive</p>
              <h2>{displayName}</h2>
              <p className="drawer-username">{username}</p>
              {stats ? (
                <div className="drawer-stats" aria-label="Resumen de camisetas">
                  <span>
                    <strong>{stats.total}</strong>
                    Total
                  </span>
                  <span>
                    <strong>{stats.collection}</strong>
                    Colección
                  </span>
                  <span>
                    <strong>{stats.wishlist}</strong>
                    Wishlist
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <button className="drawer-close" type="button" aria-label="Cerrar menú" onClick={close}>
            x
          </button>
        </div>

        <nav className="drawer-nav" aria-label="Navegación principal">
          {filterSections.map(({ href, label, icon }) => (
            <Link
              key={href}
              className={itemClass(href)}
              href={href}
              onClick={() => {
                onSectionSelect?.();
                close();
              }}
            >
              <Icon name={icon} />
              {label}
            </Link>
          ))}

          <Link className={itemClass("/estadisticas")} href="/estadisticas" onClick={close}>
            <Icon name="chart" />
            Estadísticas
          </Link>
          <Link className={itemClass("/perfil")} href="/perfil" onClick={close}>
            <Icon name="user" />
            Perfil y vitrina
          </Link>

          <hr />

          {publicPath ? (
            <Link className={itemClass(publicPath)} href={publicPath} onClick={close}>
              <Icon name="spark" />
              Mi vitrina pública
            </Link>
          ) : (
            <span className="drawer-link is-disabled">
              <Icon name="spark" />
              Mi vitrina pública
            </span>
          )}

          <hr />

          <button
            className="drawer-link drawer-logout"
            type="button"
            onClick={() => {
              close();
              onLogout();
            }}
          >
            <Icon name="logout" />
            Cerrar sesión
          </button>
        </nav>
      </aside>
    </>
  );
}
