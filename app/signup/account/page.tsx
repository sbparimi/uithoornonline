import type { Metadata } from 'next';
import AccountSignup from '../../../components/account-signup';

export const metadata: Metadata = { title: 'Account aanmaken — Uithoorn.online', description: 'Maak een klant- of aanbiederaccount aan.' };

export default function AccountSignupPage() {
  return <AccountSignup />;
}
