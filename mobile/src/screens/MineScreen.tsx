import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Badge, Button, Card, Empty, H2, s as ui } from '../components/ui';
import LoginPrompt from '../components/LoginPrompt';
import { formatDate } from '../util';

export default function MineScreen() {
  const { me, refresh } = useAuth();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const nav = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { if (me) refresh(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const reqLabel = (v: string) => label(meta.requestCategories.find((c) => c.value === v), v);
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} refreshControl={me ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
        <Text style={ui.title}>{t.mine.title}</Text>
        {!me ? <LoginPrompt text={t.request.loginFirst} /> : (
          <View>
            <H2 style={{ marginTop: 22, marginBottom: 10 }}>{t.mine.conversations}</H2>
            {me.conversations.length === 0 ? <Card><Text style={[ui.body, { color: colors.muted }]}>{t.mine.noConversations}</Text></Card> : me.conversations.map((c) => (
              <Card key={c.id} onPress={() => nav.navigate('Conversation', { id: c.id, title: c.business_name })}>
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.navy, flex: 1 }} numberOfLines={1}>{c.business_name}</Text>
                  <Badge tone={c.status === 'active' ? 'primary' : 'neutral'} label={t.status[c.status] ?? c.status} />
                </View>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{reqLabel(c.category)} · {formatDate(c.updated_at, lang)}</Text>
              </Card>
            ))}
            <View style={[ui.row, { justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }]}>
              <H2>{t.mine.requests}</H2>
              <Button title={`+ ${t.mine.newRequest}`} variant="ghost" onPress={() => nav.navigate('Request')} style={{ minHeight: 36, paddingHorizontal: 0 }} />
            </View>
            {me.requests.length === 0 ? <Empty body={t.mine.noRequests} action={<Button title={t.discover.ctaButton} onPress={() => nav.navigate('Request')} />} /> : me.requests.map((r) => (
              <Card key={r.id}>
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy, flex: 1 }} numberOfLines={1}>{reqLabel(r.category)}</Text>
                  <Badge tone={r.status === 'matched' ? 'success' : 'neutral'} label={t.status[r.status] ?? r.status} />
                </View>
                <Text style={[ui.body, { marginTop: 6 }]} numberOfLines={3}>{r.description}</Text>
                <Text style={{ color: colors.muted, marginTop: 8, fontSize: 14 }}>{r.postcode} · {formatDate(r.created_at, lang)} · {t.mine.matched(r.matched)} · {t.mine.replies(r.conversations)}</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
