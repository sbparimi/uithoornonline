export type RootStackParamList = {
  Tabs: undefined;
  Business: { id: string; name?: string };
  Login: undefined;
  Signup: { role?: 'customer' | 'provider' } | undefined;
  Conversation: { id: string; title?: string };
  Lead: { id: string };
};
export type TabParamList = {
  Discover: undefined;
  Request: { category?: string } | undefined;
  Mine: undefined;
  Leads: undefined;
  Messages: undefined;
  Profile: undefined;
  Account: undefined;
};
