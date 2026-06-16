"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { Profile, Sport } from "../lib/types";

type DrawerSport = "all" | Sport;
type DrawerFilterPath = "/" | "/coleccion" | "/wishlist";

type AppDrawerProps = {
  profile: Profile | null;
  onLogout: () => Promise<void> | void;
  activeSport?: DrawerSport;
  onSportSelect?: (sport: DrawerSport) => void;
};

type IconName =
  | "user"
  | "grid"
  | "layers"
  | "star"
  | "chart"
  | "spark"
  | "logout";

const sportSubmenu: Array<{ label: string; value: DrawerSport }> = [
  { label: "Todo", value: "all" },
  { label: "Fútbol", value: "football" },
  { label: "Baloncesto", value: "basketball" },
];

const filterSections: Array<{ href: DrawerFilterPath; label: string; icon: IconName }> = [
  { href: "/", label: "Todas las camisetas", icon: "layers" },
  { href: "/coleccion", label: "Mi colección", icon: "grid" },
  { href: "/wishlist", label: "Wishlist", icon: "star" },
];

const sportHref = (basePath: string, sport: DrawerSport) =>
  sport === "all" ? basePath : `${basePath}?sport=${sport}`;

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

export function AppDrawer({ profile, onLogout, activeSport = "all", onSportSelect }: AppDrawerProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [openSportMenu, setOpenSportMenu] = useState<DrawerFilterPath | null>(null);
  const publicPath = profile?.username ? `/u/${profile.username}` : "";

  const close = () => {
    setOpenSportMenu(null);
    setIsOpen(false);
  };

  const itemClass = (href: string) => `drawer-link ${pathname === href ? "is-active" : ""}`;
  const filterButtonClass = (href: string) => `drawer-link drawer-filter-button ${pathname === href ? "is-active" : ""}`;
  const sportItemClass = (href: string, sport: DrawerSport) =>
    `drawer-sport-option ${pathname === href && activeSport === sport ? "is-active" : ""}`;

  const open = () => {
    toast.dismiss();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (openSportMenu) {
          setOpenSportMenu(null);
          return;
        }
        close();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-drawer-sport-menu]")) return;
      setOpenSportMenu(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, openSportMenu]);

  const renderFilterSection = ({ href, label, icon }: { href: DrawerFilterPath; label: string; icon: IconName }) => {
    const isMenuOpen = openSportMenu === href;

    return (
      <div className="drawer-filter-group" data-drawer-sport-menu>
        <button
          type="button"
          className={filterButtonClass(href)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => setOpenSportMenu((current) => (current === href ? null : href))}
        >
          <Icon name={icon} />
          <span>{label}</span>
          <span className="drawer-filter-chevron" aria-hidden="true">
            {isMenuOpen ? "▲" : "▼"}
          </span>
        </button>

        {isMenuOpen ? (
          <div className="drawer-sport-dropdown" role="menu">
            {sportSubmenu.map((item) => (
              <Link
                key={`${href}-${item.value}`}
                className={sportItemClass(href, item.value)}
                href={sportHref(href, item.value)}
                role="menuitem"
                onClick={() => {
                  onSportSelect?.(item.value);
                  close();
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
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

      {isOpen ? <button className="drawer-backdrop" type="button" aria-label="Cerrar menú" onClick={close} /> : null}

      <aside className={`app-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Football Kit Archive</p>
            <h2>{profile?.display_name || profile?.username || "Mi cuenta"}</h2>
          </div>
          <button className="drawer-close" type="button" aria-label="Cerrar menú" onClick={close}>
            x
          </button>
        </div>

        <nav className="drawer-nav" aria-label="Navegación principal">
          {filterSections.map((section) => renderFilterSection(section))}

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
