import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Store } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { featureFlags } from "@/config/featureFlags";

export const Route = createFileRoute("/services/provider")({ component: ProviderPage, head: () => ({ meta: [
  { title: "Aanmelden als dienstverlener — uithoorn.online" },
  { name: "description", content: "Meld je lokale onderneming aan voor Uithoorn Online." },
] }) });

const categories = [
  ["Schoonmaak", "cleaning"], ["Klus & onderhoud", "handyman"], ["Tuin", "garden"], ["Verhuizen", "moving"], ["Computerhulp", "tech"], ["Hulp aan huis", "home-help"],
] as const;

type Provider = { id: string; business_name: string; description: string | null; categories: string[]; service_area: string; postcode: string | null; phone: string | null; email: string | null; website: string | null; whatsapp: string | null; status: "pending" | "active" | "suspended" };
const dbClient = supabase as any;

function ProviderPage() {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [businessName, setBusinessName] = useState(""); const [description, setDescription] = useState(""); const [selected, setSelected] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState("Uithoorn"); const [postcode, setPostcode] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [website, setWebsite] = useState(""); const [whatsapp, setWhatsapp] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !featureFlags.localServicesV1) return;
    dbClient.from("service_providers").select("id,business_name,description,categories,service_area,postcode,phone,email,website,whatsapp,status").eq("user_id", user.id).maybeSingle().then(({ data }: { data: Provider | null }) => {
      if (!data) return;
      setProvider(data); setBusinessName(data.business_name); setDescription(data.description ?? ""); setSelected(data.categories ?? []); setServiceArea(data.service_area); setPostcode(data.postcode ?? ""); setPhone(data.phone ?? ""); setEmail(data.email ?? ""); setWebsite(data.website ?? ""); setWhatsapp(data.whatsapp ?? "");
    });
  }, [user]);

  if (!featureFlags.localServicesV1) return <AppShell><div className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-muted-foreground">Lokale diensten worden voorbereid.</div></AppShell>;
  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const save = async () => {
    if (!user) { toast.error("Log in om je bedrijf aan te melden"); return; }
    if (!businessName.trim()) { toast.error("Vul de bedrijfsnaam in"); return; }
    if (!selected.length) { toast.error("Kies minimaal één dienst"); return; }
    setSaving(true);
    const payload = { user_id: user.id, business_name: businessName.trim(), description: description.trim() || null, categories: selected, service_area: serviceArea.trim() || "Uithoorn", postcode: postcode.trim().toUpperCase() || null, phone: phone.trim() || null, email: email.trim() || null, website: website.trim() || null, whatsapp: whatsapp.trim() || null };
    const { data, error } = provider ? await dbClient.from("service_providers").update(payload).eq("id", provider.id).select("id,business_name,description,categories,service_area,postcode,phone,email,website,whatsapp,status").single() : await dbClient.from("service_providers").insert(payload).select("id,business_name,description,categories,service_area,postcode,phone,email,website,whatsapp,status").single();
    setSaving(false); if (error) { toast.error("Bedrijfsgegevens konden niet worden opgeslagen"); return; } setProvider(data as Provider);
  };

  if (!user) return <AppShell><main className="mx-auto max-w-3xl px-5 py-14 sm:px-6"><div className="rounded-2xl border border-border bg-white p-7 text-center shadow-sm"><Store className="mx-auto text-navy" size={30}/><h1 className="mt-3 font-serif text-2xl text-navy">Aanmelden als lokale dienstverlener</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Log in of registreer eerst een account. Je bedrijfsprofiel wordt niet openbaar gemaakt voordat een afzonderlijke verificatiestap is ingericht.</p><a href="/auth" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red px-5 py-3 text-sm font-semibold text-red-foreground">Inloggen / Registreren <ArrowRight size={17}/></a></div></main></AppShell>;

  return <AppShell><section className="bg-navy px-5 pb-10 pt-8 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-red" /> Voor bedrijven</div><h1 className="mt-3 max-w-2xl text-3xl sm:text-4xl">Meld je lokale dienst aan</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Laat weten welke diensten je aanbiedt. Je gegevens blijven privé totdat Uithoorn Online een aparte verificatie- en publicatiestap heeft uitgevoerd.</p></div></section>
  <main className="mx-auto max-w-4xl px-5 py-7 pb-16 sm:px-6 lg:px-8"><section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 rounded-xl border border-navy/10 bg-cream px-4 py-3 text-xs leading-5 text-navy/70"><strong>Huidige status:</strong> {provider?.status === "active" ? "Actief" : "In afwachting van verificatie"}. Zelf aanmelden betekent niet dat je bedrijf door Uithoorn Online is gecontroleerd, aanbevolen of beschikbaar verklaard.</div>
    <label className="block text-xs font-semibold text-navy">Bedrijfsnaam *</label><input value={businessName} onChange={e=>setBusinessName(e.target.value)} maxLength={160} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none" placeholder="Bijv. Jansen Tuinservice"/>
    <label className="mt-4 block text-xs font-semibold text-navy">Diensten *</label><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map(([name,key])=><button type="button" key={key} onClick={()=>toggle(key)} className={`rounded-xl border px-3 py-3 text-left text-sm ${selected.includes(key)?"border-red bg-red/5 font-semibold text-navy":"border-border bg-white text-navy/75"}`}>{selected.includes(key)&&<CheckCircle2 size={16} className="mr-1.5 inline text-red"/>}{name}</button>)}</div>
    <label className="mt-4 block text-xs font-semibold text-navy">Korte omschrijving</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={600} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none" placeholder="Welke werkzaamheden voer je uit?"/>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="block text-xs font-semibold text-navy">Werkgebied</label><input value={serviceArea} onChange={e=>setServiceArea(e.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none"/></div><div><label className="block text-xs font-semibold text-navy">Postcode</label><input value={postcode} onChange={e=>setPostcode(e.target.value)} maxLength={7} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none" placeholder="1421 AB"/></div></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="block text-xs font-semibold text-navy">Telefoon</label><input value={phone} onChange={e=>setPhone(e.target.value)} maxLength={40} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none"/></div><div><label className="block text-xs font-semibold text-navy">E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} type="email" className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none"/></div></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="block text-xs font-semibold text-navy">Website</label><input value={website} onChange={e=>setWebsite(e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none" placeholder="https://..."/></div><div><label className="block text-xs font-semibold text-navy">WhatsApp</label><input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} maxLength={40} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none" placeholder="+31..."/></div></div>
    <button disabled={saving} onClick={save} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-4 text-sm font-semibold text-red-foreground disabled:opacity-60">{saving?"Opslaan…":provider?"Gegevens bijwerken":"Bedrijf aanmelden"} <ArrowRight size={17}/></button>
    <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Uithoorn Online bepaalt niet of een bedrijf wettelijk bevoegd is, aan kwaliteitsnormen voldoet of een bepaalde dienst kan leveren. Een eventuele openbare vermelding volgt pas na een afzonderlijk verificatieproces.</p>
  </section></main></AppShell>;
}
