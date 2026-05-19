import { Link, useLocation } from "@tanstack/react-router";
import { Home, MapPin, Plane, Map as MapIcon, Euro } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/check", label: "Check", Icon: MapPin },
  { to: "/log", label: "Log", Icon: Plane },
  { to: "/map", label: "Kaart", Icon: MapIcon },
  { to: "/claim", label: "Claim", Icon: Euro },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] border-t border-border bg-white/95 backdrop-blur z-40">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]"
              >
                <Icon
                  size={20}
                  className={active ? "text-red" : "text-navy/60"}
                />
                <span className={active ? "text-red font-medium" : "text-navy/60"}>
                  {label}
                </span>
                {active && (
                  <span className="absolute -mt-1 mt-7 h-1 w-1 rounded-full bg-red" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
