import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { ExternalLink, Minus, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { chatTurn } from "@/lib/chat.functions";

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

const quickReplyStyles = [
  "from-[#3b82f6] via-[#4f7df5] to-[#5b5ce2]",
  "from-[#ff3b46] via-[#f43f6e] to-[#d6299b]",
  "from-[#8b5cf6] via-[#7c3aed] to-[#4f46e5]",
  "from-[#19c7b4] via-[#14b8a6] to-[#3b82f6]",
];

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
      <div className="mx-auto flex min-h-[calc(100dvh-100px)] items-center justify-center">
        <section className="relative flex h-[calc(100dvh-100px)] min-h-[640px] w-full max-w-[1100px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-[#f3f5f8]/90 shadow-[0_28px_90px_rgba(13,31,60,0.18)] backdrop-blur-xl sm:h-[820px] sm:min-h-0 lg:rounded-[34px]">
          <header className="flex shrink-0 items-center justify-between bg-navy px-5 py-4 text-white sm:px-8 sm:py-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red shadow-[0_0_0_5px_rgba(255,255,255,0.06),0_8px_24px_rgba(255,36,50,0.25)] sm:h-14 sm:w-14"><Sparkles size={23} strokeWidth={2.2} /></div>
              <div className="min-w-0"><div className="font-serif text-[23px] leading-none sm:text-[27px]">Uithoorn-assistent</div><div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55 sm:text-[11px]">uithoorn.online · AI-informatieservice</div></div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setMinimized((v) => !v)} aria-label="Minimaliseer chat" className="grid h-10 w-10 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"><Minus size={19} /></button>
              <button onClick={reset} aria-label="Nieuw gesprek" className="grid h-10 w-10 place-items-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"><X size={21} /></button>
            </div>
          </header>

          {!minimized && <>
            <div className="shrink-0 border-b border-navy/8 bg-white/85 px-5 py-4 backdrop-blur-md sm:px-8 sm:py-5">
              <div className="mx-auto flex max-w-[920px] items-start gap-3 text-[14px] leading-[1.6] text-navy/65 sm:text-[15px]"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/[0.06] text-navy shadow-sm"><ShieldCheck size={17} /></div><p><strong className="font-semibold text-navy">Je chat met een AI-assistent.</strong> De assistent gebruikt officiële bronnen waar mogelijk. Uithoorn Online is geen overheidsinstantie, advocaat of beslissende autoriteit en bepaalt geen rechten of compensatie.</p></div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.95),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(226,232,240,0.7),transparent_35%),#f1f3f5] px-4 py-7 sm:px-8 sm:py-9">
              <div className="mx-auto max-w-[920px] space-y-7">
                {messages.map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}><div className={m.role === "user" ? "max-w-[82%] sm:max-w-[70%]" : "max-w-[94%] sm:max-w-[80%]"}>
                  {m.role === "assistant" && <div className="mb-2 flex items-center gap-2.5 pl-1"><span className="grid h-9 w-9 place-items-center rounded-full bg-red text-white shadow-[0_5px_14px_rgba(255,36,50,0.2)]"><Sparkles size={16} /></span><span className="text-[14px] font-bold text-navy sm:text-[15px]">Uithoorn-assistent</span></div>}
                  <div className={m.role === "user" ? "rounded-[22px] rounded-br-[7px] bg-navy px-5 py-4 text-[17px] leading-[1.55] text-white shadow-[0_8px_24px_rgba(13,31,60,0.12)] sm:px-6 sm:py-4.5 sm:text-[18px]" : "rounded-[24px] rounded-bl-[7px] border border-white/80 bg-white/90 px-5 py-4.5 text-[17px] leading-[1.65] text-navy shadow-[0_8px_28px_rgba(13,31,60,0.07)] backdrop-blur-md prose prose-base max-w-none prose-p:my-2 prose-a:text-navy prose-a:font-semibold prose-a:underline sm:px-6 sm:py-5 sm:text-[18px]"}>{m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}</div>
                  {m.role === "assistant" && m.sources?.length ? <div className="mt-3 pl-1"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-navy/40">Bronnen</div>{m.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-navy/60 underline underline-offset-2"><ExternalLink size={10} /><span className="truncate">{s.title}</span></a>)}</div> : null}
                  {i === lastAssistantIdx && !loading && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{(m.quickReplies ?? []).map((q, j) => <button key={j} onClick={() => handleAction(q.action)} className={`group relative min-h-[76px] overflow-hidden rounded-[22px] border border-white/55 bg-gradient-to-br ${quickReplyStyles[j % quickReplyStyles.length]} px-4 py-4 text-left text-white shadow-[0_10px_28px_rgba(30,64,175,0.16)] ring-1 ring-white/25 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(30,64,175,0.22)] active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-navy/20`}><span className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-white/15 blur-xl transition group-hover:scale-125" /><span className="relative flex h-full items-center justify-between gap-3"><span className="text-[16px] font-bold leading-[1.25] sm:text-[17px]">{q.label}</span><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/45 bg-white/15 text-xl shadow-inner backdrop-blur-md transition group-hover:bg-white/25">→</span></span></button>)}</div>}
                </div></div>)}
                {loading && <div className="flex justify-start"><div><div className="mb-2 flex items-center gap-2.5 pl-1"><span className="grid h-9 w-9 place-items-center rounded-full bg-red text-white"><Sparkles size={16} /></span><span className="text-[14px] font-bold text-navy sm:text-[15px]">Uithoorn-assistent</span></div><div className="rounded-[24px] rounded-bl-[7px] border border-white/80 bg-white/90 px-5 py-4 text-[15px] text-navy/55 shadow-sm sm:text-[16px]">Officiële bronnen worden geraadpleegd…</div></div></div>}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="shrink-0 border-t border-navy/8 bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-5"><div className="mx-auto max-w-[920px]">
              <div className="flex items-center gap-2 rounded-[24px] border border-navy/15 bg-white/80 p-2 shadow-[0_8px_26px_rgba(13,31,60,0.08)] backdrop-blur-md transition focus-within:border-navy/35 focus-within:ring-4 focus-within:ring-navy/[0.04]"><input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "nl" ? "Typ je vraag…" : "Type your question…"} disabled={loading} maxLength={2000} aria-label={lang === "nl" ? "Typ je vraag" : "Type your question"} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[17px] text-navy outline-none placeholder:text-navy/35 sm:text-[18px]" /><button type="submit" disabled={loading || !input.trim()} aria-label="Verstuur vraag" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red text-white shadow-[0_7px_18px_rgba(255,36,50,0.22)] transition hover:scale-[1.03] hover:bg-red/90 disabled:opacity-25 focus:outline-none focus:ring-4 focus:ring-red/20"><Send size={19} /></button></div>
              <div className="mt-3 flex items-center justify-between gap-3 px-1"><button type="button" onClick={toggleLang} className="text-[13px] font-semibold text-navy/60 underline underline-offset-3">{lang === "nl" ? "English" : "Nederlands"}</button><div className="flex items-center gap-1.5 text-[12px] font-medium text-navy/45"><ShieldCheck size={14} /> Brononderbouwde informatie</div></div>
              {Object.keys(slots).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{Object.entries(slots).map(([k, v]) => <span key={k} className="rounded-full bg-navy/5 px-2.5 py-1 text-[10px] text-navy/60">{k}: {v}</span>)}</div>}
            </div></form>
          </>}
          {minimized && <button onClick={() => setMinimized(false)} className="flex flex-1 items-center justify-center bg-[#f1f3f5] text-[16px] font-semibold text-navy">Open Uithoorn-assistent</button>}
        </section>
      </div>
      <div className="fixed bottom-24 right-0 hidden rounded-l-xl border-y border-l border-navy/10 bg-white/85 px-2.5 py-5 shadow-sm backdrop-blur-md sm:block"><button className="[writing-mode:vertical-rl] rotate-180 text-[12px] font-bold tracking-wide text-navy/70">Geef feedback</button></div>
    </main>
  </AppShell>;
}
