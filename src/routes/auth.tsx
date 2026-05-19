import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Inloggen — uithoorn.online" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Ingelogd");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Bevestig je email om in te loggen");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Er ging iets mis");
    } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { toast.error("Google sign-in mislukt"); setBusy(false); return; }
    if (res.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <h1 className="text-2xl font-serif">{mode === "login" ? "Inloggen" : "Account aanmaken"}</h1>
        <p className="mt-1 text-sm text-white/70">
          Om je meldingen en claims te bewaren.
        </p>
      </section>

      <section className="px-5 -mt-5">
        <div className="rounded-xl bg-white border border-border p-5">
          <button onClick={google} disabled={busy}
            className="w-full rounded-xl border border-border py-3 text-navy font-medium hover:bg-cream">
            Doorgaan met Google
          </button>
          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> of <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-cream px-3 py-2.5 outline-none" />
            <input type="password" required minLength={6} placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-cream px-3 py-2.5 outline-none" />
            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-50">
              {mode === "login" ? "Inloggen" : "Registreren"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-4 w-full text-xs text-muted-foreground"
          >
            {mode === "login" ? "Nog geen account? Registreer" : "Al een account? Log in"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
