import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Plane, RefreshCw, ShieldCheck, Users, Activity, Clock3 } from "lucide-react";
import { NoiseMap } from "@/components/NoiseMap";
import { EvidenceList } from "@/components/Evidence";
import { getRecentNoiseLogs, type NoiseFeed } from "@/lib/live-data.functions";

export const Route = createFileRoute("/map")({ component: MapPage, head: () => ({ meta: [
  { title: "Geluidskaart Uithoorn — uithoorn.online" },
  { name: "description", content: "Bekijk bewonersmeldingen van vliegtuiggeluid rond Uithoorn." },
] }) });
const WINDOWS=[{label:"24 uur",hours:24},{label:"7 dagen",hours:168},{label:"30 dagen",hours:720}] as const;

function MapPage(){
  const [hours,setHours]=useState(24); const [feed,setFeed]=useState<NoiseFeed|null>(null); const [loading,setLoading]=useState(true); const [mounted,setMounted]=useState(false); const fetchFeed=useServerFn(getRecentNoiseLogs);
  useEffect(()=>setMounted(true),[]);
  const load=useMemo(()=>async(h:number)=>{setLoading(true);try{setFeed(await fetchFeed({data:{hours:h,limit:500}}));}finally{setLoading(false);}},[fetchFeed]);
  useEffect(()=>{load(hours)},[hours,load]);
  const points=useMemo(()=> (feed?.points??[]).map(p=>({lat:p.lat,lng:p.lng,intensity:p.db_level})),[feed]);
  return <AppShell>
    <section className="bg-navy px-5 pb-8 pt-7 text-navy-foreground sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-red"/> Communitykaart</div>
      <h1 className="mt-3 text-3xl sm:text-4xl">Geluidskaart Uithoorn</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Bekijk waar bewoners de afgelopen periode geluid hebben gemeld. De kaart toont geen officiële geluidsmetingen.</p>
    </div></section>

    <section className="mx-auto -mt-5 max-w-4xl px-5 sm:px-6"><div className="rounded-2xl border border-border bg-white p-4 shadow-[0_18px_50px_rgba(13,31,60,.10)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold text-navy">Periode</div><div className="mt-0.5 text-[11px] text-muted-foreground">Alleen echte bewonersmeldingen</div></div><div className="flex gap-1.5 rounded-xl bg-cream p-1">{WINDOWS.map(w=><button key={w.hours} onClick={()=>setHours(w.hours)} className={`rounded-lg px-3 py-2 text-[10px] font-semibold ${hours===w.hours?"bg-navy text-white shadow-sm":"text-navy/55 hover:bg-white"}`}>{w.label}</button>)}<button aria-label="Vernieuwen" title="Vernieuwen" onClick={()=>load(hours)} className="grid h-8 w-8 place-items-center rounded-lg text-navy/60 hover:bg-white"><RefreshCw size={13} className={loading?"animate-spin":""}/></button></div></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-cream"><div className="relative aspect-[4/3] sm:aspect-[16/9]">{mounted&&points.length>0?<NoiseMap points={points}/>:<div className="absolute inset-0 grid place-items-center px-6 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white"><Users size={20}/></div><div className="mt-3 text-sm font-medium text-navy">{loading?"Meldingen ophalen…":"Nog geen meldingen in deze periode."}</div>{!loading&&<Link to="/log" className="mt-3 inline-flex items-center gap-2 rounded-full bg-red px-4 py-2 text-xs font-semibold text-white"><Plane size={13}/> Eerste melding registreren</Link>}</div></div>}</div></div>
      {feed&&<div className="mt-4"><EvidenceList items={feed.evidence}/></div>}
    </div></section>

    <section className="mx-auto max-w-4xl px-5 py-5 sm:px-6"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat icon={<Users size={14}/>} label="Meldingen" value={String(feed?.stats.count??"—")}/><Stat icon={<Activity size={14}/>} label="Gemiddeld" value={feed?.stats.avg_db!=null?`${feed.stats.avg_db} dB`:"—"}/><Stat icon={<Activity size={14}/>} label="Piek" value={feed?.stats.peak_db!=null?`${feed.stats.peak_db} dB`:"—"}/><Stat icon={<Clock3 size={14}/>} label="Verversd" value={feed?new Date(feed.stats.generated_at).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"}):"—"}/></div></section>
    <section className="mx-auto max-w-4xl px-5 pb-12 sm:px-6"><div className="rounded-2xl border border-navy/10 bg-white p-4 text-[11px] leading-5 text-muted-foreground"><div className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy/55"/><p><strong className="text-navy">Belangrijk:</strong> dit is community-data, geen officiële geluidskaart of officiële vluchtmeting. De dB-waarden zijn bewonersinschattingen. Eventuele vluchtinformatie wordt niet door deze kaart als oorzaak vastgesteld.</p></div></div><Link to="/log" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-red py-3.5 font-semibold text-white"><Plane size={17}/> Geluid melden</Link></section>
  </AppShell>;
}
function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-xl border border-border bg-white p-3"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{icon}{label}</div><div className="mt-1 font-serif text-xl leading-tight text-navy">{value}</div></div>}
