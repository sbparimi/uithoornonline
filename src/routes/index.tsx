import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import { Send, Sparkles, ExternalLink } from "lucide-react";

type QuickReply = { label: string; action: string };
type Source = { title: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; quickReplies?: QuickReply[]; sources?: Source[] };
type Slots = Partial<Record<"name" | "address" | "postcode" | "email" | "phone", string>>;
type Lang = "nl" | "en";

export const Route = createFileRoute("/")({
  component: ChatHome,
  head: () => ({ meta: [
    { title: "uithoorn.online — Schiphol-overlast assistent" },
    { name: "description", content: "Informatie en dossierondersteuning rond Schiphol-geluidsoverlast in Uithoorn." },
  ] }),
});

const GREETINGS: Record<Lang, Msg> = {
  nl: { role: "assistant", content: "Hallo. Ik ben de **Uithoorn-assistent**. Ik help je officiële informatie over Schiphol-geluidsoverlast te vinden, je adresgegevens te controleren en informatie voor je dossier te ordenen. Ik bepaal niet of je recht hebt op compensatie en neem geen officiële beslissing namens een instantie.", quickReplies: [
    { label: "Check mijn adres", action: "ask:Ik wil mijn adres checken" },
    { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt compensatie?" },
    { label: "Geluid melden", action: "route:/log" },
    { label: "Geluidskaart bekijken", action: "route:/map" },
  ] },
  en: { role: "assistant", content: "Hello. I'm the **Uithoorn assistant**. I help you find official information about Schiphol aircraft noise, check address information and organise information for your dossier. I do not determine entitlement to compensation or make official decisions on behalf of an authority.", quickReplies: [
    { label: "Check my address", action: "ask:I want to check my address" },
    { label: "How does compensation work?", action: "ask:How does compensation work?" },
    { label: "Report noise", action: "route:/log" },
    { label: "View noise map", action: "route:/map" },
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
  const [lang, setLang] = useState<Lang>(() => loadPersisted()?.lang ?? loadLang());
  const [messages, setMessages] = useState<Msg[]>(() => loadPersisted()?.messages ?? [GREETINGS[loadLang()]]);
  const [slots, setSlots] = useState<Slots>(() => loadPersisted()?.slots ?? {});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, slots, lang })); localStorage.setItem(LANG_KEY, lang); } catch {} }, [messages, slots, lang]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const toggleLang = () => { const next: Lang = lang === "nl" ? "en" : "nl"; setLang(next); setMessages((prev) => [...prev, { role: "assistant", content: next === "en" ? "Switched to **English**. I will continue in English." : "Overgeschakeld naar **Nederlands**. Ik ga verder in het Nederlands.", quickReplies: GREETINGS[next].quickReplies }]); };
  const handleAction = (action: string) => { if (action === "lang:toggle") return toggleLang(); if (action.startsWith("route:")) { const path = action.slice(6); if (ALLOWED_ROUTES.has(path)) navigate({ to: path as any }); return; } if (action.startsWith("ask:")) void send(action.slice(4)); };
  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 2000); if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }]; setMessages(next); setInput(""); setLoading(true);
    try { const res = await callChat({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })), slots, lang } }); setMessages((prev) => [...prev, { role: "assistant", content: res.message, quickReplies: res.quickReplies, sources: res.sources ?? [] }]); if (res.collectedSlots && Object.keys(res.collectedSlots).length) setSlots((p) => ({ ...p, ...res.collectedSlots })); }
    catch { setMessages((prev) => [...prev, { role: "assistant", content: lang === "nl" ? "Er ging iets mis. Probeer het opnieuw." : "Something went wrong. Please try again." }]); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 0); }
  };
  const reset = () => { setMessages([GREETINGS[lang]]); setSlots({}); try { localStorage.removeItem(STORAGE_KEY); } catch {} };
  const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return <AppShell>
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px - 80px)" }}>
      <div className="bg-navy text-navy-foreground px-5 py-4 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-red grid place-items-center"><Sparkles size={18} className="text-white" /></div><div className="leading-tight"><div className="font-serif text-lg">Uithoorn-assistent</div><div className="text-[11px] text-white/60">Officiële bronnen · dossierondersteuning</div></div><button onClick={reset} className="ml-auto text-[10px] text-white/70 underline">nieuw gesprek</button></div>
      <div className="bg-cream border-b border-border px-5 py-2 text-[11px] leading-snug text-navy/70"><b>AI-assistent:</b> geen overheidsinstantie, advocaat of beslissende autoriteit. Antwoorden zijn informatief en worden waar mogelijk met geraadpleegde bronnen onderbouwd. Officiële instanties bepalen rechten en formele uitkomsten.</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">{messages.map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}><div className="max-w-[85%] space-y-2"><div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-red text-red-foreground px-4 py-2.5 text-[15px] leading-snug" : "rounded-2xl rounded-bl-md bg-white border border-border px-4 py-2.5 text-[15px] leading-snug text-navy shadow-sm prose prose-sm max-w-none prose-p:my-1"}>{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}</div>{m.role === "assistant" && m.sources?.length ? <div className="pl-1"><div className="text-[10px] uppercase tracking-wide text-navy/40 font-medium">Bronnen</div>{m.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-navy/70 underline truncate"><ExternalLink size={10} /><span className="truncate">{s.title}</span></a>)}</div> : null}{i === lastAssistantIdx && !loading && <div className="flex flex-wrap gap-2"><button onClick={toggleLang} className="rounded-full bg-cream border border-navy/30 text-navy text-xs px-3 py-1.5">{lang === "nl" ? "NL · English" : "EN · Nederlands"}</button>{(m.quickReplies ?? []).map((q, j) => <button key={j} onClick={() => handleAction(q.action)} className="rounded-full bg-white border border-navy/20 text-navy text-xs px-3.5 py-1.5">{q.label}</button>)}</div>}</div></div>)}{loading && <div className="flex justify-start"><div className="rounded-2xl bg-white border border-border px-4 py-3 text-xs text-muted-foreground">Bronnen worden geraadpleegd…</div></div>}</div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="border-t border-border bg-cream px-3 py-3"><div className="flex items-center gap-2 rounded-full bg-white border border-border pl-4 pr-1.5 py-1.5"><input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "nl" ? "Typ je vraag…" : "Type your question…"} disabled={loading} maxLength={2000} className="flex-1 bg-transparent outline-none text-[15px] py-1.5" /><button type="submit" disabled={loading || !input.trim()} className="h-9 w-9 rounded-full bg-red text-red-foreground grid place-items-center disabled:opacity-40"><Send size={16} /></button></div>{Object.keys(slots).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{Object.entries(slots).map(([k, v]) => <span key={k} className="text-[10px] bg-navy/5 text-navy/70 px-2 py-0.5 rounded-full">{k}: {v}</span>)}</div>}</form>
    </div>
  </AppShell>;
}
