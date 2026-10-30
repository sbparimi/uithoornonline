import React from 'react';
import { Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Business, Review } from '../api';
import { useApi } from '../hooks';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors, fonts } from '../theme';
import { Badge, Button, Card, Empty, ErrorNote, Loading, s as ui } from '../components/ui';
import { displayPhone, displayUrl, formatDate } from '../util';
import { requestCategoryFor } from '../categoryMap';
import { SITE_URL } from '../config';

type Detail = { business: Business; reviews: Review[]; rating: { average: number | null; count: number }; photos: { url: string; alt: string }[] };

export default function BusinessScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const { data, error, loading } = useApi<Detail>(`/api/mobile/businesses/${route.params.id}`);
  if (loading) return <Loading label={t.common.loading} />;
  if (!data) return <View style={{ flex: 1, padding: 20 }}><ErrorNote text={error === 'not_found' ? t.business.notFound : errorText(t, error ?? undefined)} /></View>;
  const b = data.business;
  const catLabel = label(meta.businessCategories.find((c) => c.value === b.category), b.category);
  const mapQuery = encodeURIComponent(`${b.name} ${b.postcode ?? ''} Uithoorn`);
  const actions = [
    b.phone && { key: 'call', icon: '✆', label: t.business.call, onPress: () => Linking.openURL(`tel:${b.phone!.replace(/\s/g, '')}`) },
    b.public_email && { key: 'mail', icon: '✉', label: t.business.email, onPress: () => Linking.openURL(`mailto:${b.public_email}`) },
    b.website && { key: 'web', icon: '🌐', label: t.business.website, onPress: () => Linking.openURL(b.website!) },
    { key: 'map', icon: '📍', label: t.business.map, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${mapQuery}`) },
    { key: 'share', icon: '↗', label: t.business.share, onPress: () => Share.share({ message: `${b.name} – ${SITE_URL}${lang === 'en' ? '/en' : ''}/businesses/${b.id}` }) },
  ].filter(Boolean) as { key: string; icon: string; label: string; onPress: () => void }[];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {data.photos[0] ? <Image source={{ uri: data.photos[0].url }} accessibilityLabel={data.photos[0].alt} style={st.photo} /> : null}
      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <View style={st.avatar}><Text style={st.avatarText}>{b.name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[ui.title, { fontSize: 26, lineHeight: 31 }]}>{b.name}</Text>
          <Text style={[ui.subtitle, { marginTop: 2 }]}>{catLabel}{b.postcode ? `  ·  ${b.postcode}` : ''}</Text>
        </View>
      </View>
      <View style={[ui.row, { gap: 6, marginTop: 12, flexWrap: 'wrap' }]}>
        {b.verified && <Badge tone="success" label={`✓ ${t.discover.verified}`} />}
        {b.featured && <Badge tone="warning" label={`★ ${t.discover.featured}`} />}
        {data.rating.count > 0 && <Badge tone="primary" label={`★ ${data.rating.average} (${data.rating.count})`} />}
      </View>

      <View style={st.actions}>
        {actions.map((a) => (
          <View key={a.key} style={{ flex: 1, alignItems: 'center' }}>
            <Button title={a.icon} onPress={a.onPress} variant="secondary" style={st.actionBtn} />
            <Text style={st.actionLabel}>{a.label}</Text>
          </View>
        ))}
      </View>
      {b.phone ? <Text style={st.contactLine} onPress={() => Linking.openURL(`tel:${b.phone!.replace(/\s/g, '')}`)}>✆  {displayPhone(b.phone)}</Text> : null}
      {b.public_email ? <Text style={st.contactLine} onPress={() => Linking.openURL(`mailto:${b.public_email}`)}>✉  {b.public_email}</Text> : null}
      {b.website ? <Text style={st.contactLine} onPress={() => Linking.openURL(b.website!)}>🌐  {displayUrl(b.website)}</Text> : null}

      <Card style={{ marginTop: 16 }}>
        <Text style={ui.h2}>{t.business.about}</Text>
        <Text style={[ui.body, { marginTop: 8 }]}>{b.description || '—'}</Text>
      </Card>

      <Button title={t.business.askQuote} onPress={() => nav.navigate('Tabs', { screen: 'Request', params: { category: requestCategoryFor(b.category) } })} style={{ marginVertical: 8 }} />

      <Text style={[ui.h2, { marginTop: 20, marginBottom: 10 }]}>{t.business.reviews}</Text>
      {data.reviews.length === 0 ? <Empty body={t.business.noReviews} /> : data.reviews.map((r) => (
        <Card key={r.id}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontWeight: '700', color: colors.navy }}>{r.author}</Text>
            <Text style={{ color: colors.accent }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
          </View>
          <Text style={[ui.body, { marginTop: 6 }]}>{r.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>{formatDate(r.created_at, lang)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  photo: { width: '100%', height: 190, borderRadius: 18, marginBottom: 16, backgroundColor: colors.soft },
  avatar: { width: 60, height: 60, borderRadius: 17, backgroundColor: '#E3EAFB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.serif, fontSize: 28, color: colors.primary },
  actions: { flexDirection: 'row', marginTop: 20, marginBottom: 6, gap: 8 },
  actionBtn: { width: 58, height: 58, minHeight: 58, borderRadius: 29, paddingHorizontal: 0 },
  actionLabel: { fontSize: 13, color: colors.navy, marginTop: 6, fontWeight: '600' },
  contactLine: { fontSize: 16, color: colors.primary, marginTop: 10, fontWeight: '600' },
});
