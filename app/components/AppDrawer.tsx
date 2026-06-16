"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { Profile } from "../lib/types";

type AppDrawerProps = {
  profile: Profile | null;
  onLogout: () => Promise<void> | void;
};

type IconName =
  | "user"
  | "grid"
  | "layers"
  | "star"
  | "chart"
  | "spark"
  | "logout";

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

export function AppDrawer({ profile, onLogout }: AppDrawerProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const publicPath = profile?.username ? `/u/${profile.username}` : "";

  const close = () => setIsOpen(false);

  const itemClass = (href: string) => `drawer-link ${pathname === href ? "is-active" : ""}`;
  const open = () => {
    toast.dismiss();
    setIsOpen(true);
  };

  return (
    <>
      <button
        className="app-menu-button"
        type="button"
        aria-label="Abrir menu"
        aria-expanded={isOpen}
        onClick={open}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {isOpen ? <button className="drawer-backdrop" type="button" aria-label="Cerrar menu" onClick={close} /> : null}

      <aside className={`app-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Football Kit Archive</p>
            <h2>{profile?.display_name || profile?.username || "Mi cuenta"}</h2>
          </div>
          <button className="drawer-close" type="button" aria-label="Cerrar menu" onClick={close}>
            x
          </button>
        </div>

        <nav className="drawer-nav" aria-label="Navegacion principal">
          <Link className={itemClass("/")} href="/" onClick={close}>
            <Icon name="layers" />
            Todas las camisetas
          </Link>
          <Link className={itemClass("/coleccion")} href="/coleccion" onClick={close}>
            <Icon name="grid" />
            Mi colección
          </Link>
          <Link className={itemClass("/wishlist")} href="/wishlist" onClick={close}>
            <Icon name="star" />
            Wishlist
          </Link>
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
