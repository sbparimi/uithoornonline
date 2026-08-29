import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import { ArrowRight, ExternalLink, FileCheck2, MapPin, MessageCircle, Plane, RotateCcw, Send, ShieldCheck } from "lucide-react";

type QuickReply = { label: string; action: string };
type Source = { title: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; quickReplies?: QuickReply[]; sources?: Source[] };
type Slots = Partial<Record<"name" | "address" | "postcode" | "email" | "phone", string>>;
type Lang = "nl" | "en";

export const Route = createFileRoute("/")({
  component: ChatHome,
  head: () => ({ meta: [
    { title: "uithoorn.online — inwonersservice" },
    { name: "description", content: "Praktische, brononderbouwde informatie voor inwoners van Uithoorn over Schiphol-geluidsoverlast." },
  ] }),
});

const GREETINGS: Record<Lang, Msg> = {
  nl: { role: "assistant", content: "Ik help je met **informatie over Schiphol-geluidsoverlast in Uithoorn**. We kunnen je adres controleren, een bewonersmelding vastleggen of officiële informatie voor je dossier ordenen. Ik bepaal geen recht op compensatie en neem geen besluit namens een instantie.", quickReplies: [
    { label: "Mijn adres controleren", action: "route:/check" },
    { label: "Geluid melden", action: "route:/log" },
    { label: "Compensatie begrijpen", action: "ask:Hoe werkt compensatie?" },
    { label: "Geluidskaart", action: "route:/map" },
  ] },
  en: { role: "assistant", content: "I help you find **information about Schiphol aircraft noise in Uithoorn**. We can check your address, record a resident noise report or organise official information for your dossier. I do not determine compensation entitlement or make decisions for an authority.", quickReplies: [
    { label: "Check my address", action: "route:/check" },
    { label: "Report noise", action: "route:/log" },
    { label: "Understand compensation", action: "ask:How does compensation work?" },
    { label: "Noise map", action: "route:/map" },
  ] },
};

const ALLOWED_ROUTES = new Set(["/check", "/claim", "/log", "/map"]);
const STORAGE_KEY = "uithoorn.chat.v1";
const LANG_KEY = "uithoorn.chat.lang";

function loadPersisted(): { messages: Msg[]; slots: Slots; lang?: Lang } | null {
  if (typeof window === "undefined") return null;
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); return parsed && Array.isArray(parsed.messages) ? parsed : null; } catch { return null; }
}
function loadLang(): Lang { if (typeof window === "undefined") return "nl"; try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "nl"; } catch { return "nl"; } }

function ChatHome() {
  const navigate = useNavigate();
  const callChat = useServerFn(chatTurn);
  const persisted = loadPersisted();
  const [lang, setLang] = useState<Lang>(() => persisted?.lang ?? loadLang());
  const [messages, setMessages] = useState<Msg[]>(() => persisted?.messages ?? [GREETINGS[loadLang()]]);
  const [slots, setSlots] = useState<Slots>(() => persisted?.slots ?? {});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, slots, lang })); localStorage.setItem(LANG_KEY, lang); } catch {} }, [messages, slots, lang]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const toggleLang = () => { const next: Lang = lang === "nl" ? "en" : "nl"; setLang(next); setMessages(prev => [...prev, { role: "assistant", content: next === "en" ? "Switched to **English**." : "Overgeschakeld naar **Nederlands**.", quickReplies: GREETINGS[next].quickReplies }]); };
  const handleAction = (action: string) => { if (action === "lang:toggle") return toggleLang(); if (action.startsWith("route:")) { const path = action.slice(6); if (ALLOWED_ROUTES.has(path)) navigate({ to: path as any }); return; } if (action.startsWith("ask:")) void send(action.slice(4)); };
  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 2000); if (!trimmed || loading) return;
    const next = [...messages, { role: "user" as const, content: trimmed }]; setMessages(next); setInput(""); setLoading(true);
    try { const res = await callChat({ data: { messages: next.map(m => ({ role: m.role, content: m.content })), slots, lang } }); setMessages(prev => [...prev, { role: "assistant", content: res.message, quickReplies: res.quickReplies, sources: res.sources ?? [] }]); if (res.collectedSlots && Object.keys(res.collectedSlots).length) setSlots(p => ({ ...p, ...res.collectedSlots })); }
    catch { setMessages(prev => [...prev, { role: "assistant", content: lang === "nl" ? "Er ging iets mis. Probeer het opnieuw." : "Something went wrong. Please try again." }]); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 0); }
  };
  const reset = () => { setMessages([GREETINGS[lang]]); setSlots({}); try { localStorage.removeItem(STORAGE_KEY); } catch {} };
  const lastAssistantIdx = [...messages].map(m => m.role).lastIndexOf("assistant");

  return <AppShell>
    <div className="flex min-h-[calc(100dvh-84px)] flex-col">
      <section className="bg-navy px-5 pb-7 pt-7 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Inwonerservice Uithoorn</div>
            <h1 className="mt-1 font-serif text-[30px] leading-[1.05] tracking-tight">Van vraag naar<br />duidelijkheid.</h1>
          </div>
          <button onClick={reset} aria-label="Nieuw gesprek" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70"><RotateCcw size={17} /></button>
        </div>
        <p className="mt-4 max-w-[340px] text-[13px] leading-relaxed text-white/72">Praktische informatie over Schiphol-geluidsoverlast. Met bronnen, duidelijke onzekerheid en een dossier dat je zelf kunt controleren.</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] text-white/65">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"><ShieldCheck size={14} className="mb-1 text-white/80" /><span>Brononderbouwd</span></div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"><MapPin size={14} className="mb-1 text-white/80" /><span>Uithoorn lokaal</span></div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"><FileCheck2 size={14} className="mb-1 text-white/80" /><span>Zelf controleerbaar</span></div>
        </div>
      </section>

      <section className="border-b border-border bg-white px-5 py-5">
        <div className="mb-3 flex items-end justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy/45">Direct regelen</div><h2 className="mt-1 font-serif text-[21px] text-navy">Wat wil je doen?</h2></div><span className="text-[10px] text-navy/40">4 opties</span></div>
        <div className="grid grid-cols-2 gap-2.5">
          <ActionCard icon={<MapPin size={18} />} title="Adres controleren" text="Bekijk welke officiële informatie op je adres van toepassing is." onClick={() => navigate({ to: "/check" })} />
          <ActionCard icon={<Plane size={18} />} title="Geluid melden" text="Leg zelf een waarneming vast met tijd en locatie." onClick={() => navigate({ to: "/log" })} />
          <ActionCard icon={<MessageCircle size={18} />} title="Vraag stellen" text="Zoek in geraadpleegde bronnen en zie waar onzekerheid zit." onClick={() => inputRef.current?.focus()} />
          <ActionCard icon={<FileCheck2 size={18} />} title="Dossier voorbereiden" text="Orden informatie voor een eventuele officiële vervolgstap." onClick={() => navigate({ to: "/claim" })} />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col bg-[#f4f2ed]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><div><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy/45">Assistent</span><div className="text-sm font-medium text-navy">Stel je vraag</div></div><button onClick={toggleLang} className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-[10px] font-medium text-navy">{lang === "nl" ? "NL · English" : "EN · Nederlands"}</button></div>
        <div ref={scrollRef} className="min-h-[240px] flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}><div className="max-w-[88%] space-y-2"><div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-red px-4 py-3 text-[14px] leading-relaxed text-red-foreground" : "rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 text-[14px] leading-relaxed text-navy shadow-[0_2px_8px_rgba(20,35,55,0.04)] prose prose-sm max-w-none prose-p:my-1"}>{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}</div>{m.role === "assistant" && m.sources?.length ? <div className="pl-1"><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-navy/35">Bronnen</div>{m.sources.map((s,k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-[10px] text-navy/65 underline"><ExternalLink size={9} /><span className="truncate">{s.title}</span></a>)}</div> : null}{i === lastAssistantIdx && !loading && <div className="flex flex-wrap gap-1.5 pt-0.5">{(m.quickReplies ?? []).map((q,j) => <button key={j} onClick={() => handleAction(q.action)} className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-[10px] font-medium text-navy shadow-sm">{q.label}</button>)}</div>}</div></div>)}
          {loading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 text-[11px] text-navy/55">Officiële bronnen worden geraadpleegd…</div></div>}
        </div>
        <form onSubmit={e => { e.preventDefault(); void send(input); }} className="border-t border-border bg-white px-4 py-3"><div className="flex items-center gap-2 rounded-xl border border-navy/15 bg-[#faf9f6] px-3 py-1.5 focus-within:border-navy/40"><input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder={lang === "nl" ? "Bijv. hoe werkt compensatie?" : "For example: how does compensation work?"} disabled={loading} maxLength={2000} className="min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-navy/35" /><button type="submit" disabled={loading || !input.trim()} aria-label="Verstuur vraag" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy text-white disabled:opacity-25"><Send size={15} /></button></div>{Object.keys(slots).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{Object.entries(slots).map(([k,v]) => <span key={k} className="rounded-full bg-navy/5 px-2 py-0.5 text-[9px] text-navy/60">{k}: {v}</span>)}</div>}</form>
      </section>
    </div>
  </AppShell>;
}

function ActionCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="group rounded-xl border border-border bg-[#fbfaf7] p-3.5 text-left transition hover:border-navy/25 hover:bg-white"><div className="flex items-start justify-between gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy text-white">{icon}</span><ArrowRight size={14} className="mt-1 text-navy/25 transition group-hover:text-navy/60" /></div><div className="mt-3 font-medium text-[13px] text-navy">{title}</div><p className="mt-1 text-[10px] leading-relaxed text-navy/55">{text}</p></button>;
}
