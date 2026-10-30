import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { useApi } from '../hooks';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Badge, Body, Button, Card, ErrorNote, Loading, s as ui } from '../components/ui';
import { formatDate } from '../util';
import type { LeadsData } from './LeadsScreen';

function Line({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return <View style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}><Text style={{ width: 110, color: colors.muted, fontSize: 15 }}>{k}</Text><Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>{v}</Text></View>;
}

export default function LeadScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const { data, loading, setData } = useApi<LeadsData>('/api/provider/leads');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (loading || !data) return <Loading label={t.common.loading} />;
  const lead = data.leads.find((l) => l.id === route.params.id);
  if (!lead) return <View style={{ padding: 20 }}><ErrorNote text={t.common.error} /></View>;
  const opt = (list: { value: string; nl: string; en: string }[], v: string | null) => (v ? label(list.find((o) => o.value === v), v) : null);
  const budget = lead.budget_min || lead.budget_max ? `€ ${lead.budget_min ? Math.round(Number(lead.budget_min)) : '…'} – ${lead.budget_max ? Math.round(Number(lead.budget_max)) : '…'}` : null;

  async function reply() {
    setBusy('reply'); setError(null);
    try {
      const res = await api<{ conversationId: string }>(`/api/provider/requests/${lead!.request_id}/accept`, { method: 'POST' });
      nav.replace('Conversation', { id: res.conversationId });
    } catch (e) { setError(errorText(t, e instanceof ApiError ? e.code : undefined)); } finally { setBusy(null); }
  }
  async function decline() {
    setBusy('decline'); setError(null);
    try {
      await api('/api/provider/leads', { method: 'PATCH', body: { leadId: lead!.id, status: 'declined' } });
      setData({ ...data!, leads: data!.leads.map((l) => (l.id === lead!.id ? { ...l, status: 'declined' } : l)) });
      nav.goBack();
    } catch (e) { setError(errorText(t, e instanceof ApiError ? e.code : undefined)); } finally { setBusy(null); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Badge label={t.status[lead.status] ?? lead.status} tone="primary" />
      <Text style={[ui.title, { fontSize: 26, marginTop: 10 }]}>{opt(meta.requestCategories, lead.category)}</Text>
      <Card style={{ marginTop: 16 }}>
        {lead.description ? <Body>{lead.description}</Body> : <Body muted>{t.provider.locked}</Body>}
        <View style={{ marginTop: 12 }}>
          <Line k={t.provider.postcode} v={lead.postcode} />
          <Line k={t.provider.timing} v={opt(meta.timing, lead.preferred_timing)} />
          <Line k={t.provider.urgency} v={opt(meta.urgency, lead.urgency)} />
          <Line k={t.provider.budget} v={budget} />
          <Line k={t.provider.received} v={formatDate(lead.created_at, lang)} />
        </View>
      </Card>
      <ErrorNote text={error} />
      {lead.conversation_id ? (
        <Button title={t.provider.openChat} onPress={() => nav.replace('Conversation', { id: lead.conversation_id })} />
      ) : lead.status !== 'declined' && lead.status !== 'locked' ? (
        <View>
          <Text style={[ui.hint, { marginBottom: 10 }]}>{t.provider.confirmReply}</Text>
          <Button title={t.provider.reply} onPress={reply} loading={busy === 'reply'} />
          <Button title={t.provider.decline} variant="ghost" onPress={decline} loading={busy === 'decline'} style={{ marginTop: 8 }} />
        </View>
      ) : null}
    </ScrollView>
  );
}
