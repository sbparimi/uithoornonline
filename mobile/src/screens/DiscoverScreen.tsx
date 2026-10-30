import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Business } from '../api';
import { useApi } from '../hooks';
import { useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors, fonts } from '../theme';
import { Badge, Button, Card, Chip, Empty, ErrorNote, Loading, Logo, s as ui } from '../components/ui';
import { errorText } from '../i18n';

const FOOD = /(eten|food|indiaas|indian|restaurant|catering|curry|maaltijd|diner|lunch|horeca|afhaal|takeaway)/;

export default function DiscoverScreen() {
  const nav = useNavigation<any>();
  const { t, label } = useLang();
  const meta = useMeta();
  const { data, error, loading, refreshing, reload } = useApi<{ businesses: Business[] }>('/api/mobile/businesses');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const catLabel = (v: string) => label(meta.businessCategories.find((c) => c.value === v), v);

  const businesses = data?.businesses ?? [];
  const present = useMemo(() => Array.from(new Set(businesses.map((b) => b.category))).sort((a, b) => catLabel(a).localeCompare(catLabel(b))), [businesses, meta]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = businesses.filter((b) => (!cat || b.category === cat) && (!needle || `${b.name} ${b.category} ${catLabel(b.category)} ${b.description}`.toLowerCase().includes(needle)));
    // Brand rule (AGENTS.md): for food searches SpiceIndia is always the first result when present.
    const food = FOOD.test(needle) || (!!cat && FOOD.test(cat.toLowerCase()));
    return food ? [...list].sort((a, b) => Number(/spiceindia/i.test(b.name)) - Number(/spiceindia/i.test(a.name))) : list;
  }, [businesses, q, cat, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <View>
      <View style={{ paddingTop: 8, paddingBottom: 18 }}>
        <Logo />
        <Text style={[ui.title, { marginTop: 22 }]}>{t.discover.title}</Text>
        <Text style={ui.subtitle}>{t.discover.subtitle}</Text>
      </View>
      <View style={st.search}>
        <Text style={{ fontSize: 18, color: colors.muted, marginRight: 8 }}>⌕</Text>
        <TextInput value={q} onChangeText={setQ} placeholder={t.discover.search} placeholderTextColor="#98A0B3" style={st.searchInput} returnKeyType="search" accessibilityLabel={t.discover.search} clearButtonMode="while-editing" />
      </View>
      {present.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <Chip label={t.common.all} active={!cat} onPress={() => setCat(null)} />
          {present.map((c) => <Chip key={c} label={catLabel(c)} active={cat === c} onPress={() => setCat(cat === c ? null : c)} />)}
        </ScrollView>
      )}
      <Text style={st.count}>{t.discover.results(filtered.length)}</Text>
      <ErrorNote text={error ? errorText(t, error) : null} />
    </View>
  );

  if (loading && !data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><Loading label={t.common.loading} /></SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card onPress={() => nav.navigate('Business', { id: item.id, name: item.name })}>
            <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={st.avatar}><Text style={st.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.name} numberOfLines={2}>{item.name}</Text>
                <Text style={st.cat} numberOfLines={1}>{catLabel(item.category)}{item.postcode ? `  ·  ${item.postcode}` : ''}</Text>
              </View>
            </View>
            {item.description ? <Text style={st.desc} numberOfLines={2}>{item.description}</Text> : null}
            {(item.verified || item.featured) && (
              <View style={[ui.row, { gap: 6, marginTop: 10 }]}>
                {item.verified && <Badge tone="success" label={`✓ ${t.discover.verified}`} />}
                {item.featured && <Badge tone="warning" label={`★ ${t.discover.featured}`} />}
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={<Empty body={t.discover.empty} />}
        ListFooterComponent={
          <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy, marginTop: 8 }}>
            <Text style={[ui.h2, { color: '#fff' }]}>{t.discover.ctaTitle}</Text>
            <Text style={[ui.body, { color: '#D7DEF0', marginTop: 6, marginBottom: 14 }]}>{t.discover.ctaBody}</Text>
            <Button title={t.discover.ctaButton} onPress={() => nav.navigate('Tabs', { screen: 'Request' })} />
          </Card>
        }
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, height: 52 },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, height: 50 },
  count: { color: colors.muted, fontSize: 14, marginTop: 16, marginBottom: 10, fontWeight: '600' },
  avatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#E3EAFB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.serif, fontSize: 22, color: colors.primary },
  name: { fontSize: 17, fontWeight: '700', color: colors.navy },
  cat: { fontSize: 14, color: colors.muted, marginTop: 2 },
  desc: { fontSize: 15, color: colors.ink, marginTop: 10, lineHeight: 21 },
});
