import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import { Send, Sparkles, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ChatHome,
  head: () => ({
    meta: [
      { title: "uithoorn.online — Schiphol-overlast assistent" },
      {
        name: "description",
        content:
          "Praat met de Uithoorn-assistent over Schiphol-geluid, je adres en je compensatieclaim.",
      },
    ],
  }),
});

type QuickReply = { label: string; action: string };
type Source = { title: string; url: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  quickReplies?: QuickReply[];
  sources?: Source[];
};
type Slots = Partial<Record<"name" | "address" | "postcode" | "email" | "phone", string>>;

type Lang = "nl" | "en";

const GREETINGS: Record<Lang, Msg> = {
  nl: {
    role: "assistant",
    content:
      "Hallo 👋 Ik ben de **Uithoorn-assistent**. Ik help je met Schiphol-geluidsoverlast, het checken van je adres en het indienen van een compensatieclaim.\n\nWaar kan ik je mee helpen?",
    quickReplies: [
      { label: "Check mijn adres", action: "ask:Ik wil mijn adres checken" },
      { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt de compensatie?" },
      { label: "Geluid melden", action: "ask:Ik wil geluidsoverlast melden" },
      { label: "Geluidskaart bekijken", action: "route:/map" },
    ],
  },
  en: {
    role: "assistant",
    content:
      "Hi 👋 I'm the **Uithoorn assistant**. I help with Schiphol noise nuisance, checking your address and filing a compensation claim.\n\nHow can I help you?",
    quickReplies: [
      { label: "Check my address", action: "ask:I want to check my address" },
      { label: "How does compensation work?", action: "ask:How does compensation work?" },
      { label: "Report noise", action: "ask:I want to report noise nuisance" },
      { label: "View noise map", action: "route:/map" },
    ],
  },
};

const ALLOWED_ROUTES = new Set(["/check", "/claim", "/log", "/map"]);
const STORAGE_KEY = "uithoorn.chat.v1";
const LANG_KEY = "uithoorn.chat.lang";

function loadPersisted(): { messages: Msg[]; slots: Slots; lang?: Lang } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return { messages: parsed.messages, slots: parsed.slots ?? {}, lang: parsed.lang };
  } catch {
    return null;
  }
}

function loadLang(): Lang {
  if (typeof window === "undefined") return "nl";
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "nl") return v;
  } catch {
    /* ignore */
  }
  return "nl";
}

function ChatHome() {
  const navigate = useNavigate();
  const callChat = useServerFn(chatTurn);
  const [lang, setLang] = useState<Lang>(() => loadPersisted()?.lang ?? loadLang());
  const [messages, setMessages] = useState<Msg[]>(
    () => loadPersisted()?.messages ?? [GREETINGS[loadLang()]],
  );
  const [slots, setSlots] = useState<Slots>(() => loadPersisted()?.slots ?? {});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, slots, lang }));
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore quota / private mode */
    }
  }, [messages, slots, lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();

  const t = (nl: string, en: string) => (lang === "en" ? en : nl);

  const toggleLang = () => {
    const next: Lang = lang === "nl" ? "en" : "nl";
    setLang(next);
    // Append a system-style assistant note so the user gets immediate feedback
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          next === "en"
            ? "Switched to **English**. I'll continue in English from here."
            : "Overgeschakeld naar **Nederlands**. Ik ga verder in het Nederlands.",
        quickReplies: GREETINGS[next].quickReplies,
      },
    ]);
  };

  const handleAction = (action: string) => {
    if (action === "lang:toggle") {
      toggleLang();
      return;
    }
    if (action.startsWith("route:")) {
      const path = action.slice(6);
      if (ALLOWED_ROUTES.has(path)) navigate({ to: path as any });
      return;
    }
    if (action.startsWith("ask:")) send(action.slice(4));
  };

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await callChat({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          slots,
          lang,
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          quickReplies: res.quickReplies,
          sources: (res as { sources?: Source[] }).sources ?? [],
        },
      ]);
      if (res.collectedSlots && Object.keys(res.collectedSlots).length) {
        setSlots((p) => ({ ...p, ...res.collectedSlots }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t(
            "Sorry, er ging iets mis. Probeer het nog eens.",
            "Sorry, something went wrong. Please try again.",
          ),
          quickReplies: [],
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const resetChat = () => {
    setMessages([GREETINGS[lang]]);
    setSlots({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col" style={{ height: "calc(100dvh - 56px - 80px)" }}>
        <div className="bg-navy text-navy-foreground px-5 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red grid place-items-center shadow-lg shadow-red/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-lg">Uithoorn-assistent</div>
            <div className="text-[11px] text-white/60">Schiphol-overlast · live online</div>
          </div>
          <button
            onClick={resetChat}
            className="ml-auto text-[10px] text-white/70 hover:text-white underline-offset-2 hover:underline"
            aria-label="Nieuw gesprek"
          >
            nieuw gesprek
          </button>
        </div>

        <div className="bg-cream border-b border-border px-5 py-2 text-[11px] leading-snug text-navy/70">
          Je praat met een <b>AI-assistent</b>, geen medewerker. Antwoorden komen uitsluitend uit
          officiële bronnen en zijn geen juridisch advies.
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => {
            const showQR = i === lastAssistantIdx && !loading;
            return (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-red text-red-foreground px-4 py-2.5 text-[15px] leading-snug shadow-sm"
                        : "rounded-2xl rounded-bl-md bg-white border border-border px-4 py-2.5 text-[15px] leading-snug text-navy shadow-sm prose prose-sm max-w-none prose-p:my-1 prose-strong:text-navy"
                    }
                  >
                    {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                  </div>
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div className="flex flex-col gap-1 pl-1">
                      <div className="text-[10px] uppercase tracking-wide text-navy/40 font-medium">
                        Bronnen
                      </div>
                      {m.sources.map((s, k) => (
                        <a
                          key={k}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-navy/70 hover:text-red underline-offset-2 hover:underline truncate max-w-full"
                        >
                          <ExternalLink size={10} className="shrink-0" />
                          <span className="truncate">{s.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {showQR && (m.quickReplies?.length || i === lastAssistantIdx) && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        key="lang-toggle"
                        onClick={() => handleAction("lang:toggle")}
                        disabled={loading}
                        aria-label={t("Schakel naar Engels", "Switch to Dutch")}
                        className="rounded-full bg-cream border border-navy/30 text-navy text-xs font-semibold px-3 py-1.5 hover:border-navy hover:bg-white disabled:opacity-50 transition inline-flex items-center gap-1"
                      >
                        <span aria-hidden>🌐</span>
                        <span>{lang === "nl" ? "NL · Switch to English" : "EN · Wissel naar Nederlands"}</span>
                      </button>
                      {(m.quickReplies ?? []).map((q, j) => {
                        const isRoute = q.action.startsWith("route:");
                        return (
                          <button
                            key={j}
                            onClick={() => handleAction(q.action)}
                            disabled={loading}
                            className={
                              isRoute
                                ? "rounded-full bg-navy text-white text-xs font-medium px-3.5 py-1.5 hover:bg-navy/90 disabled:opacity-50 transition"
                                : "rounded-full bg-white border border-navy/20 text-navy text-xs font-medium px-3.5 py-1.5 hover:border-red hover:text-red disabled:opacity-50 transition"
                            }
                          >
                            {isRoute && "→ "}
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start" aria-label="Assistent is aan het typen">
              <div className="rounded-2xl rounded-bl-md bg-white border border-border px-4 py-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-navy/40 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-navy/40 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-navy/40 animate-bounce" />
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-border bg-cream px-3 py-3"
        >
          <div className="flex items-center gap-2 rounded-full bg-white border border-border pl-4 pr-1.5 py-1.5 shadow-sm focus-within:border-navy">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Typ je vraag…"
              disabled={loading}
              maxLength={2000}
              className="flex-1 bg-transparent outline-none text-[15px] py-1.5 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Verstuur"
              className="h-9 w-9 rounded-full bg-red text-red-foreground grid place-items-center disabled:opacity-40 transition"
            >
              <Send size={16} />
            </button>
          </div>
          {Object.keys(slots).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 px-1">
              {Object.entries(slots).map(([k, v]) => (
                <span
                  key={k}
                  className="text-[10px] bg-navy/5 text-navy/70 px-2 py-0.5 rounded-full"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
        </form>
      </div>
    </AppShell>
  );
}
