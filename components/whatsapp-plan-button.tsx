'use client';

import { MessageCircle, ArrowRight } from 'lucide-react';
import { whatsappHref } from '../lib/i18n/config';
import { useDict } from './lang-context';

export function WhatsAppPlanButton({ plan, price }: { plan: string; price: string }) {
  const t = useDict().business;
  return <a className="pricing-button whatsapp-pricing-button" href={whatsappHref(t.planMessage(plan, price))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> {t.payWhatsapp} <ArrowRight aria-hidden="true" /></a>;
}
