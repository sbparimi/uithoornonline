/* eslint-disable prettier/prettier */
import { Link, useLocation } from "@tanstack/react-router";
import { Home, MapPin, Plane, Store } from "lucide-react";
import { featureFlags } from "@/config/featureFlags";

const baseTabs = [{ to: "/", label: "Start", Icon: Home }, { to: "/check", label: "Adres", Icon: MapPin }] as const;
export function BottomNav() {
  const { pathname } = useLocation();
  const tabs = featureFlags.flightNoiseHubV1 ? [...baseTabs, { to: "/flight-noise", label: "Vliegtuig", Icon: Plane }, ...(featureFlags.localServicesV1 ? [{ to: "/services", label: "Diensten", Icon: Store }] : [])] : [...baseTabs, { to: "/log", label: "Melding", Icon: Plane }, { to: "/map", label: "Kaart", Icon: MapPin }];
  return <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-border/80 bg-white/95 shadow-[0_-10px_30px_rgba(13,31,60,0.08)] backdrop-blur-xl lg:hidden" aria-label="Mobiele navigatie"><ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">{tabs.map(({to,label,Icon})=>{const active=pathname===to||(to==="/flight-noise"&&pathname.startsWith("/flight-noise"));return <li key={to}><Link to={to} className="flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition active:scale-95"><span className={active?"grid h-8 w-8 place-items-center rounded-xl bg-navy text-white shadow-sm":"grid h-8 w-8 place-items-center rounded-xl text-navy/50"}><Icon size={16}/></span><span className={active?"text-navy":"text-navy/55"}>{label}</span></Link></li>})}</ul></nav>;
}
