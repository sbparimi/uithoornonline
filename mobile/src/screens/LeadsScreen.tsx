import React, { useEffect, useRef } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lead } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Badge, Card, Empty, ErrorNote, Loading, s as ui } from '../components/ui';
import { formatDate } from '../util';
import { notifyLocal } from '../notifications';

export type LeadsData = { business: { id: string; name: string }; leads: Lead[]; usage: { remaining: number; includedLeads: number } };

export default function LeadsScreen() {
  const nav = useNavigation<any>();
  const { me } = useAuth();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const { data, error, loading, refreshing, reload, silent } = useApi<LeadsData>('/api/provider/leads', { refocus: true });
  const known = useRef<Set<string> | null>(null);
  const reqLabel = (v: string) => label(meta.requestCategories.find((c) => c.value === v), v);

  // Re-check every 60 s while the app is open; a new lead triggers a local notification.
  useEffect(() => { const timer = setInterval(silent, 60000); return () => clearInterval(timer); }, [silent]);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.leads.map((l) => l.id));
    if (known.current) {
      const fresh = data.leads.filter((l) => !known.current!.has(l.id));
      if (fresh.length) notifyLocal(t.notify.newLead, reqLabel(fresh[0].category), { leadId: fresh[0].id });
    }
    known.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><Loading label={t.common.loading} /></SafeAreaView>;
  const pending = me?.business && me.business.moderation_status !== 'approved';
  const tone = (s: string) => (s === 'new' ? 'primary' : s === 'accepted' || s === 'converted' ? 'success' : s === 'declined' ? 'danger' : 'neutral') as any;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={data?.leads ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={ui.title}>{t.provider.leadsTitle}</Text>
            {data?.business ? <Text style={ui.subtitle}>{data.business.name}</Text> : null}
            {pending ? <Card style={{ marginTop: 14, backgroundColor: '#FDEEDC', borderColor: '#F7D5AE' }}><Text style={{ color: '#7A420B', fontSize: 15 }}>{t.provider.pending}</Text></Card> : null}
            <View style={{ marginTop: 10 }}><ErrorNote text={error ? errorText(t, error) : null} /></View>
          </View>
        }
        ListEmptyComponent={<Empty body={t.provider.leadsEmpty} />}
        renderItem={({ item }) => (
          <Card onPress={() => nav.navigate('Lead', { id: item.id })}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy, flex: 1 }} numberOfLines={1}>{reqLabel(item.category)}</Text>
              <Badge tone={tone(item.status)} label={t.status[item.status] ?? item.status} />
            </View>
            {item.description ? <Text style={[ui.body, { marginTop: 6 }]} numberOfLines={2}>{item.description}</Text> : <Text style={{ color: colors.muted, marginTop: 6 }}>{t.provider.locked}</Text>}
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 14 }}>{item.postcode ?? ''}{item.postcode ? ' · ' : ''}{formatDate(item.created_at, lang)}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
