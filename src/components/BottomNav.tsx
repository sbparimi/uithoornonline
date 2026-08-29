import { Link, useLocation } from "@tanstack/react-router";
import { FileCheck2, Home, Map, MapPin, Plane } from "lucide-react";

const tabs = [
  { to: "/", label: "Start", Icon: Home },
  { to: "/check", label: "Adres", Icon: MapPin },
  { to: "/log", label: "Melding", Icon: Plane },
  { to: "/map", label: "Kaart", Icon: Map },
  { to: "/claim", label: "Dossier", Icon: FileCheck2 },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-border bg-white/96 shadow-[0_-8px_24px_rgba(13,31,60,0.06)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link to={to} className="flex min-h-[64px] flex-col items-center justify-center gap-1 text-[10px] font-medium">
                <span className={active ? "grid h-7 w-7 place-items-center rounded-lg bg-navy text-white" : "grid h-7 w-7 place-items-center rounded-lg text-navy/55"}>
                  <Icon size={16} />
                </span>
                <span className={active ? "text-navy" : "text-navy/55"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
