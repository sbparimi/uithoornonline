import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import {
  ArrowRight,
  ExternalLink,
  FileCheck2,
  MapPin,
  MessageCircle,
  Plane,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type QuickReply = { label: string; action: string };
type Source = { title: string; url: string };
type Msg = { role: "user" | "assistant"; content: string; quickReplies?: QuickReply[]; sources?: Source[] };
type Slots = Partial<Record<"name" | "address" | "postcode" | "email" | "phone", string>>;
type Lang = "nl" | "en";

export const Route = createFileRoute("/")({
  component: ChatHome,
  head: () => ({
    meta: [
      { title: "uithoorn.online — inwonersservice" },
      { name: "description", content: "Praktische, brononderbouwde informatie voor inwoners van Uithoorn over Schiphol-geluidsoverlast." },
    ],
  }),
});

const GREETINGS: Record<Lang, Msg> = {
  nl: {
    role: "assistant",
    content: "Goedendag. Ik ben de **Uithoorn-assistent**. Ik help je officiële informatie over Schiphol-geluidsoverlast te vinden, je adres te controleren en informatie voor je dossier te ordenen. Ik bepaal geen recht op compensatie en neem geen officiële beslissing namens een instantie.",
    quickReplies: [
      { label: "Adres controleren", action: "route:/check" },
      { label: "Geluid melden", action: "route:/log" },
      { label: "Compensatie begrijpen", action: "ask:Hoe werkt compensatie?" },
      { label: "Geluidskaart", action: "route:/map" },
    ],
  },
  en: {
    role: "assistant",
    content: "Hello. I’m the **Uithoorn assistant**. I help you find official information about Schiphol aircraft noise, check your address and organise information for your dossier. I do not determine compensation entitlement or make official decisions for an authority.",
    quickReplies: [
      { label: "Check address", action: "route:/check" },
      { label: "Report noise", action: "route:/log" },
      { label: "Understand compensation", action: "ask:How does compensation work?" },
      { label: "Noise map", action: "route:/map" },
    ],
  },
};

const ALLOWED_ROUTES = new Set(["/check", "/claim", "/log", "/map"]);
const STORAGE_KEY = "uithoorn.chat.v1";
const LANG_KEY = "uithoorn.chat.lang";

function loadPersisted(): { messages: Msg[]; slots: Slots; lang?: Lang } | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return parsed && Array.isArray(parsed.messages) ? parsed : null;
  } catch {
    return null;
  }
}

function loadLang(): Lang {
  if (typeof window === "undefined") return "nl";
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "nl";
  } catch {
    return "nl";
  }
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, slots, lang }));
      localStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, [messages, slots, lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const toggleLang = () => {
    const next: Lang = lang === "nl" ? "en" : "nl";
    setLang(next);
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: next === "en" ? "Switched to **English**." : "Overgeschakeld naar **Nederlands**.",
      quickReplies: GREETINGS[next].quickReplies,
    }]);
  };

  const handleAction = (action: string) => {
    if (action === "lang:toggle") return toggleLang();
    if (action.startsWith("route:")) {
      const path = action.slice(6);
      if (ALLOWED_ROUTES.has(path)) navigate({ to: path as any });
      return;
    }
    if (action.startsWith("ask:")) void send(action.slice(4));
  };

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed || loading) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await callChat({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })), slots, lang } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.message, quickReplies: res.quickReplies, sources: res.sources ?? [] }]);
      if (res.collectedSlots && Object.keys(res.collectedSlots).length) setSlots((p) => ({ ...p, ...res.collectedSlots }));
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: lang === "nl" ? "Er ging iets mis. Probeer het opnieuw." : "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const reset = () => {
    setMessages([GREETINGS[lang]]);
    setSlots({});
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-84px)] bg-cream px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
          <section className="hidden rounded-2xl bg-navy p-8 text-white shadow-[0_20px_60px_rgba(13,31,60,0.12)] lg:flex lg:min-h-[720px] lg:flex-col lg:justify-between">
            <div>
              <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-red" /> Inwonerservice Uithoorn
              </div>
              <h1 className="max-w-[520px] font-serif text-5xl leading-[1.02] tracking-tight">Van vraag naar duidelijkheid.</h1>
              <p className="mt-6 max-w-[480px] text-sm leading-7 text-white/65">Praktische informatie over Schiphol-geluidsoverlast. Controleer je adres, leg een bewonersmelding vast en organiseer informatie voor je dossier.</p>
              <div className="mt-10 grid max-w-[500px] gap-3 sm:grid-cols-2">
                <InfoCard icon={<MapPin size={18} />} title="Adres controleren" text="Officiële locatiegegevens en LIB-informatie." />
                <InfoCard icon={<Plane size={18} />} title="Geluid melden" text="Leg je eigen waarneming vast." />
                <InfoCard icon={<ShieldCheck size={18} />} title="Bronnen" text="Zie waar informatie vandaan komt." />
                <InfoCard icon={<FileCheck2 size={18} />} title="Dossier" text="Orden informatie voor een vervolgstap." />
              </div>
            </div>
            <div className="border-t border-white/10 pt-5 text-[11px] leading-relaxed text-white/45">Uithoorn Online is geen overheidsinstantie, advocaat of beslissende autoriteit. Officiële instanties bepalen rechten en formele uitkomsten.</div>
          </section>

          <section className="flex min-h-[calc(100dvh-108px)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_50px_rgba(13,31,60,0.10)] lg:min-h-[720px]">
            <header className="bg-navy px-4 py-3.5 text-white sm:px-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10"><Sparkles size={19} /></div>
                <div className="min-w-0 flex-1 leading-tight"><div className="font-serif text-lg">Uithoorn-assistent</div><div className="mt-0.5 text-[10px] text-white/55">AI-assistent · Informatieservice</div></div>
                <button onClick={reset} aria-label="Nieuw gesprek" title="Nieuw gesprek" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"><RotateCcw size={15} /></button>
              </div>
            </header>

            <div className="border-b border-border bg-[#f8f7f4] px-4 py-3 sm:px-5">
              <div className="flex gap-2.5 text-[11px] leading-relaxed text-navy/70"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy/55" /><p><strong className="text-navy">Je praat met AI.</strong> Deze assistent gebruikt officiële bronnen waar mogelijk. Uithoorn Online bepaalt geen rechten, compensatie of formele uitkomsten.</p></div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-cream/45 px-4 py-5 sm:px-5">
              <div className="mx-auto max-w-[620px] space-y-5">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={m.role === "user" ? "max-w-[82%]" : "max-w-[92%]"}>
                      {m.role === "assistant" && <div className="mb-1.5 flex items-center gap-2 pl-1"><span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-white"><Sparkles size={13} /></span><span className="text-[11px] font-semibold text-navy">Uithoorn-assistent</span></div>}
                      <div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-red px-4 py-3 text-[14px] leading-relaxed text-white shadow-sm" : "rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 text-[14px] leading-relaxed text-navy shadow-[0_2px_10px_rgba(13,31,60,0.045)] prose prose-sm max-w-none prose-p:my-1 prose-a:text-navy prose-a:underline"}>
                        {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                      </div>
                      {m.role === "assistant" && m.sources?.length ? <div className="mt-2 pl-1"><div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-navy/35">Bronnen</div>{m.sources.map((s, k) => <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-navy/60 underline"><ExternalLink size={9} /><span className="truncate">{s.title}</span></a>)}</div> : null}
                      {i === lastAssistantIdx && !loading && <div className="mt-3 flex flex-wrap gap-2">{(m.quickReplies ?? []).map((q, j) => <button key={j} onClick={() => handleAction(q.action)} className="rounded-full border border-navy/15 bg-white px-3.5 py-2 text-[10px] font-semibold text-navy shadow-sm transition hover:border-navy/30 hover:bg-navy/5">{q.label}</button>)}</div>}
                    </div>
                  </div>
                ))}
                {loading && <div className="flex justify-start"><div><div className="mb-1.5 flex items-center gap-2 pl-1"><span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-white"><Sparkles size={13} /></span><span className="text-[11px] font-semibold text-navy">Uithoorn-assistent</span></div><div className="rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 text-[11px] text-navy/55">Officiële bronnen worden geraadpleegd…</div></div></div>}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="border-t border-border bg-white px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2 rounded-xl border border-navy/15 bg-[#faf9f6] p-1.5 transition focus-within:border-navy/40 focus-within:ring-2 focus-within:ring-navy/5">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "nl" ? "Typ je vraag…" : "Type your question…"} disabled={loading} maxLength={2000} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] text-navy outline-none placeholder:text-navy/35" />
                <button type="submit" disabled={loading || !input.trim()} aria-label="Verstuur vraag" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy text-white transition hover:bg-navy/90 disabled:opacity-25"><Send size={15} /></button>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3 px-1"><button type="button" onClick={toggleLang} className="text-[10px] font-medium text-navy/50 underline underline-offset-2">{lang === "nl" ? "English" : "Nederlands"}</button><div className="flex items-center gap-1.5 text-[9px] text-navy/40"><ShieldCheck size={11} /> Brononderbouwde informatie</div></div>
              {Object.keys(slots).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 px-1">{Object.entries(slots).map(([k, v]) => <span key={k} className="rounded-full bg-navy/5 px-2 py-0.5 text-[9px] text-navy/60">{k}: {v}</span>)}</div>}
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3.5"><div className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white">{icon}</div><div className="text-[13px] font-semibold">{title}</div><p className="mt-1 text-[10px] leading-relaxed text-white/50">{text}</p></div>;
}
