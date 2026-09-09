import type { Metadata } from 'next';
import AccountSignup from '../../../components/account-signup';

export const metadata: Metadata = { title: 'Account aanmaken — Uithoorn.online', description: 'Maak een klant- of aanbiederaccount aan.' };

export default async function AccountSignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  return <AccountSignup initialRole={params.role === 'provider' ? 'provider' : 'customer'} />;
}
