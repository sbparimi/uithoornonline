import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Badge, Card, Empty, s as ui } from '../components/ui';
import { formatDate } from '../util';

export default function MessagesScreen() {
  const { me, refresh } = useAuth();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const nav = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refresh(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const list = me?.conversations ?? [];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={colors.primary} />}>
        <Text style={[ui.title, { marginBottom: 16 }]}>{t.tabs.messages}</Text>
        {list.length === 0 ? <Empty body={t.provider.messagesEmpty} /> : list.map((c) => (
          <Card key={c.id} onPress={() => nav.navigate('Conversation', { id: c.id })}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy, flex: 1 }} numberOfLines={1}>{label(meta.requestCategories.find((x) => x.value === c.category), c.category)}</Text>
              <Badge tone={c.status === 'active' ? 'primary' : 'neutral'} label={t.status[c.status] ?? c.status} />
            </View>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{formatDate(c.updated_at, lang)}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
