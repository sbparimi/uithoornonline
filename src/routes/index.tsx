import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { chatTurn } from "@/lib/chat.functions";
import { Send, Sparkles, Loader2 } from "lucide-react";

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
type Msg = { role: "user" | "assistant"; content: string; quickReplies?: QuickReply[] };
type Slots = Partial<Record<"name" | "address" | "postcode" | "email" | "phone", string>>;

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hallo 👋 Ik ben de **Uithoorn-assistent**. Ik help je met Schiphol-geluidsoverlast, het checken van je adres en het indienen van een compensatieclaim.\n\nWaar kan ik je mee helpen?",
  quickReplies: [
    { label: "Check mijn adres", action: "ask:Ik wil mijn adres checken" },
    { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt de compensatie?" },
    { label: "Geluid melden", action: "ask:Ik wil geluidsoverlast melden" },
    { label: "Geluidskaart bekijken", action: "route:/map" },
  ],
};

function ChatHome() {
  const navigate = useNavigate();
  const callChat = useServerFn(chatTurn);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [slots, setSlots] = useState<Slots>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleAction = (action: string) => {
    if (action.startsWith("route:")) {
      navigate({ to: action.slice(6) as any });
      return;
    }
    if (action.startsWith("ask:")) {
      send(action.slice(4));
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
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
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.message, quickReplies: res.quickReplies },
      ]);
      if (res.collectedSlots && Object.keys(res.collectedSlots).length) {
        setSlots((p) => ({ ...p, ...res.collectedSlots }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, er ging iets mis. Probeer het nog eens.",
          quickReplies: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col" style={{ height: "calc(100dvh - 56px - 80px)" }}>
        {/* Hero strip */}
        <div className="bg-navy text-navy-foreground px-5 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red grid place-items-center shadow-lg shadow-red/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-lg">Uithoorn-assistent</div>
            <div className="text-[11px] text-white/60">Schiphol-overlast · live online</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            actief
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[85%] space-y-2">
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-red text-red-foreground px-4 py-2.5 text-[15px] leading-snug shadow-sm"
                      : "rounded-2xl rounded-bl-md bg-white border border-border px-4 py-2.5 text-[15px] leading-snug text-navy shadow-sm prose prose-sm max-w-none prose-p:my-1 prose-strong:text-navy"
                  }
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "assistant" && m.quickReplies && m.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.quickReplies.map((q, j) => {
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
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white border border-border px-4 py-3 flex items-center gap-2 text-navy/50 text-sm">
                <Loader2 size={14} className="animate-spin" />
                aan het typen…
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-border bg-cream px-3 py-3"
        >
          <div className="flex items-center gap-2 rounded-full bg-white border border-border pl-4 pr-1.5 py-1.5 shadow-sm focus-within:border-navy">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Typ je vraag…"
              disabled={loading}
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
