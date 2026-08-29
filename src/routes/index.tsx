import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import { ExternalLink, FileCheck2, MapPin, Plane, RotateCcw, Send, ShieldCheck, Sparkles, X, Minus } from "lucide-react";

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
  nl: { role: "assistant", content: "Goedendag. Ik ben de **Uithoorn-assistent**. Ik help je officiële informatie over Schiphol-geluidsoverlast te vinden, je adres te controleren en informatie voor je dossier te ordenen. Ik bepaal geen recht op compensatie en neem geen officiële beslissing namens een instantie.", quickReplies: [
    { label: "Adres controleren", action: "route:/check" },
    { label: "Geluid melden", action: "route:/log" },
    { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt compensatie?" },
    { label: "Geluidskaart bekijken", action: "route:/map" },
  ] },
  en: { role: "assistant", content: "Hello. I’m the **Uithoorn assistant**. I help you find official information about Schiphol aircraft noise, check your address and organise information for your dossier. I do not determine compensation entitlement or make official decisions for an authority.", quickReplies: [
    { label: "Check my address", action: "route:/check" },
    { label: "Report noise", action: "route:/log" },
    { label: "How does compensation work?", action: "ask:How does compensation work?" },
    { label: "View noise map", action: "route:/map" },
  ] },
};

const ALLOWED_ROUTES = new Set(["/check", "/claim", "/log", "/map"]);
const STORAGE_KEY = "uithoorn.chat.v3";
const LANG_KEY = "uithoorn.chat.lang";

function loadPersisted(): { messages: Msg[]; slots: Slots; lang?: Lang } | null {
  if (typeof window === "undefined") return null;
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); return parsed && Array.isArray(parsed.messages) ? parsed : null; } catch { return null; }
}
function loadLang(): Lang {
  if (typeof window === "undefined") return "nl";
  try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "nl"; } catch { return "nl"; }
}

function ChatHome() {
  const navigate = useNavigate();
  const callChat = useServerFn(chatTurn);
  const persisted = loadPersisted();
  const [lang, setLang] = useState<Lang>(() => persisted?.lang ?? loadLang());
  const [messages, setMessages] = useState<Msg[]>(() => persisted?.messages ?? [GREETINGS[loadLang()]]);
  const [slots, setSlots] = useState<Slots>(() => persisted?.slots ?? {});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, slots, lang })); localStorage.setItem(LANG_KEY, lang); } catch {} }, [messages, slots, lang]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const toggleLang = () => {
    const next: Lang = lang === "nl" ? "en" : "nl";
    setLang(next);
    setMessages((prev) => [...prev, { role: "assistant", content: next === "en" ? "Switched to **English**." : "Overgeschakeld naar **Nederlands**.", quickReplies: GREETINGS[next].quickReplies }]);
  };
  const handleAction = (action: string) => {
    if (action === "lang:toggle") return toggleLang();
    if (action.startsWith("route:")) { const path = action.slice(6); if (ALLOWED_ROUTES.has(path)) navigate({ to: path as any }); return; }
    if (action.startsWith("ask:")) void send(action.slice(4));
  };
  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 2000); if (!trimmed || loading) return;
    const next = [...messages, { role: "user" as const, content: trimmed }]; setMessages(next); setInput(""); setLoading(true);
    try {
      const res = await callChat({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })), slots, lang } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.message, quickReplies: res.quickReplies, sources: res.sources ?? [] }]);
      if (res.collectedSlots && Object.keys(res.collectedSlots).length) setSlots((p) => ({ ...p, ...res.collectedSlots }));
    } catch { setMessages((prev) => [...prev, { role: "assistant", content: lang === "nl" ? "Er ging iets mis. Probeer het opnieuw." : "Something went wrong. Please try again." }]); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 0); }
  };
  const reset = () => { setMessages([GREETINGS[lang]]); setSlots({}); setMinimized(false); try { localStorage.removeItem(STORAGE_KEY); } catch {} };
  const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return <AppShell>
    <main className="min-h-[calc(100dvh-84px)] bg-cream px-2 py-2 sm:px-5 sm:py-5 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-100px)] max-w-5xl items-center justify-center">
        <section className="relative flex h-[calc(100dvh-100px)] min-h-[620px] w-full max-w-[900px] flex-col overflow-hidden rounded-[22px] border border-navy/10 bg-[#f4f4f5] shadow-[0_24px_70px_rgba(13,31,60,0.16)] sm:h-[760px] sm:min-h-0">
          <header className="flex shrink-0 items-center justify-between bg-navy px-5 py-4 text-white sm:px-7 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red shadow-sm ring-4 ring-white/5"><Sparkles size={20} strokeWidth={2.2} /></div>
              <div className="min-w-0"><div className="font-serif text-[20px] leading-none sm:text-[22px]">Uithoorn-assistent</div><div className="mt-1 text-[10px] font-medium uppercase tracking-[0.13em] text-white/55">uithoorn.online · AI-informatieservice</div></div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized((v) => !v)} aria-label="Minimaliseer chat" className="grid h-9 w-9 place-items-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"><Minus size={18} /></button>
              <button onClick={reset} aria-label="Nieuw gesprek" className="grid h-9 w-9 place-items-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
          </header>

          {!minimized && <>
            <div className="shrink-0 border-b border-navy/8 bg-white px-5 py-4 sm:px-7">
              <div className="mx-auto flex max-w-[760px] items-start gap-3 text-[12px] leading-[1.55] text-navy/65"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/6 text-navy"><ShieldCheck size={14} /></div><p><strong className="font-semibold text-navy">Je chat met een AI-assistent.</strong> De assistent gebruikt officiële bronnen waar mogelijk. Uithoorn Online is geen overheidsinstantie, advocaat of beslissende autoriteit en bepaalt geen rechten of compensatie.</p></div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#f1f1f2] px-4 py-6 sm:px-7 sm:py-7">
              <div className="mx-auto max-w-[760px] space-y-5">
                {messages.map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={m.role === "user" ? "max-w-[76%] sm:max-w-[68%]" : "max-w-[92%] sm:max-w-[78%]"}>
                  {m.role === "assistant" && <div className="mb-1.5 flex items-center gap-2 pl-1.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-red text-white"><Sparkles size={14} /></span><span className="text-[13px] font-semibold text-navy">Uithoorn-assistent</span></div>}
                  <div className={m.role === "user" ? "rounded-[18px] rounded-br-[5px] bg-navy px-4 py-3.5 text-[14px] leading-[1.55] text-white shadow-sm" : "rounded-[18px] rounded-bl-[5px] border border-navy/7 bg-white px-4 py-3.5 text-[14px] leading-[1.6] text-navy shadow-[0_2px_9px_rgba(13,31,60,0.05)] prose prose-sm max-w-none prose-p:my-1.5 prose-a:text-navy prose-a:underline"}>{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}</div>
                  {m.role === "assistant" && m.sources?.length ? <div className="mt-2 pl-1.5"><div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-navy/35">Bronnen</div>{m.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-navy/60 underline"><ExternalLink size={9} /><span className="truncate">{s.title}</span></a>)}</div> : null}
                  {i === lastAssistantIdx && !loading && <div className="mt-3 flex flex-wrap gap-2">{(m.quickReplies ?? []).map((q, j) => <button key={j} onClick={() => handleAction(q.action)} className="rounded-[10px] border-2 border-navy/55 bg-transparent px-3.5 py-2.5 text-[11px] font-semibold text-navy transition hover:bg-navy hover:text-white focus:outline-none focus:ring-2 focus:ring-navy/20">{q.label}</button>)}</div>}
                </div></div>)}
                {loading && <div className="flex justify-start"><div><div className="mb-1.5 flex items-center gap-2 pl-1.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-red text-white"><Sparkles size={14} /></span><span className="text-[13px] font-semibold text-navy">Uithoorn-assistent</span></div><div className="rounded-[18px] rounded-bl-[5px] border border-navy/7 bg-white px-4 py-3.5 text-[12px] text-navy/55 shadow-sm">Officiële bronnen worden geraadpleegd…</div></div></div>}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="shrink-0 border-t border-navy/8 bg-white px-4 py-4 sm:px-7"><div className="mx-auto max-w-[760px]">
              <div className="flex items-center gap-2 rounded-[14px] border border-navy/20 bg-[#fafafa] p-1.5 shadow-[0_1px_3px_rgba(13,31,60,0.04)] transition focus-within:border-navy/45 focus-within:ring-2 focus-within:ring-navy/5"><input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "nl" ? "Typ je vraag…" : "Type your question…"} disabled={loading} maxLength={2000} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[14px] text-navy outline-none placeholder:text-navy/35" /><button type="submit" disabled={loading || !input.trim()} aria-label="Verstuur vraag" className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-navy text-white transition hover:bg-navy/90 disabled:opacity-25"><Send size={16} /></button></div>
              <div className="mt-2.5 flex items-center justify-between gap-3 px-1"><button type="button" onClick={toggleLang} className="text-[10px] font-medium text-navy/55 underline underline-offset-2">{lang === "nl" ? "English" : "Nederlands"}</button><div className="flex items-center gap-1.5 text-[9px] text-navy/40"><ShieldCheck size={11} /> Brononderbouwde informatie</div></div>
              {Object.keys(slots).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{Object.entries(slots).map(([k, v]) => <span key={k} className="rounded-full bg-navy/5 px-2 py-0.5 text-[9px] text-navy/60">{k}: {v}</span>)}</div>}
            </div></form>
          </>}
          {minimized && <button onClick={() => setMinimized(false)} className="flex flex-1 items-center justify-center bg-[#f1f1f2] text-sm font-medium text-navy">Open Uithoorn-assistent</button>}
        </section>
      </div>
      <div className="fixed bottom-24 right-0 hidden rounded-l-md border-y border-l border-navy/10 bg-white px-2 py-5 shadow-sm sm:block"><button className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold tracking-wide text-navy/70">Geef feedback</button></div>
    </main>
  </AppShell>;
}
