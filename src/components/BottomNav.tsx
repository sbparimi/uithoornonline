import { Link, useLocation } from "@tanstack/react-router";
import { Home, MapPin, Plane, Map as MapIcon, FolderOpen } from "lucide-react";

const tabs = [
  { to: "/", label: "Start", Icon: Home },
  { to: "/check", label: "Adres", Icon: MapPin },
  { to: "/log", label: "Melding", Icon: Plane },
  { to: "/map", label: "Kaart", Icon: MapIcon },
  { to: "/claim", label: "Dossier", Icon: FolderOpen },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return <nav aria-label="Hoofdnavigatie" className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-white/95 backdrop-blur">
    <ul className="grid grid-cols-5">
      {tabs.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return <li key={to}><Link to={to} aria-current={active ? "page" : undefined} className={`flex min-h-[68px] flex-col items-center justify-center gap-1.5 text-[10px] ${active ? "text-red" : "text-navy/55"}`}>
          <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
          <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
          <span className={`h-1 w-1 rounded-full ${active ? "bg-red" : "bg-transparent"}`} />
        </Link></li>;
      })}
    </ul>
  </nav>;
}
