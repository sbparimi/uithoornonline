'use client';

import { MessageCircle, ArrowRight } from 'lucide-react';

const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '31616270233').replace(/\D/g, '');

export function WhatsAppPlanButton({ plan, price }: { plan: 'Pro' | 'Pro+'; price: string }) {
  const message = encodeURIComponent(`Hallo Uithoorn.online, ik wil het ${plan}-plan (€${price}/maand) activeren voor mijn bedrijf. Kunnen jullie mij de betaalgegevens sturen?`);
  const href = `https://wa.me/${whatsappNumber}?text=${message}`;
  return <a className="pricing-button whatsapp-pricing-button" href={href} target="_blank" rel="noreferrer"><MessageCircle /> Betalen via WhatsApp <ArrowRight /></a>;
}
