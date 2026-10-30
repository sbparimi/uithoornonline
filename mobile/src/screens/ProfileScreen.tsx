import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, OwnBusiness } from '../api';
import { useAuth } from '../auth';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Badge, Button, Card, ErrorNote, Field, Select, s as ui } from '../components/ui';

export default function ProfileScreen() {
  const { me, refresh } = useAuth();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const b = me?.business;
  const otherValue = meta.businessCategories.find((c) => c.other)?.value ?? 'Overig';
  const known = (v: string) => meta.businessCategories.some((c) => c.value === v && !c.other);
  const [f, setF] = useState({ name: '', category: '', otherCategory: '', description: '', phone: '', website: '', postcode: '', address: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!b) return;
    setF({ name: b.name, category: known(b.category) ? b.category : otherValue, otherCategory: known(b.category) ? '' : b.category, description: b.description ?? '', phone: b.phone ?? '', website: b.website ?? '', postcode: b.postcode ?? '', address: b.address ?? '' });
  }, [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const up = (k: keyof typeof f) => (v: string) => { setSaved(false); setF((p) => ({ ...p, [k]: v })); };
  const options = [...meta.businessCategories.filter((c) => !c.other)].sort((a, x) => label(a).localeCompare(label(x), lang)).concat(meta.businessCategories.filter((c) => c.other)).map((c) => ({ value: c.value, label: label(c) }));

  async function save() {
    setError(null); setBusy(true);
    try {
      const category = f.category === otherValue ? f.otherCategory.trim() : f.category;
      if (category.length < 2) throw new ApiError('invalid_business', 400);
      await api<{ business: OwnBusiness }>('/api/provider/profile', { method: 'PATCH', body: { name: f.name.trim(), category, description: f.description.trim(), phone: f.phone.trim(), website: f.website.trim(), postcode: f.postcode.trim(), address: f.address.trim() } });
      await refresh();
      setSaved(true);
    } catch (e) { setError(errorText(t, e instanceof ApiError ? e.code : undefined)); } finally { setBusy(false); }
  }

  if (!b) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}><Text style={ui.title}>{t.provider.profileTitle}</Text></SafeAreaView>;
  const live = b.moderation_status === 'approved' && b.active;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={ui.title}>{t.provider.profileTitle}</Text>
          <Card style={{ marginTop: 14 }}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: colors.muted }}>{t.provider.status}</Text>
              <Badge tone={live ? 'success' : 'warning'} label={t.status[b.moderation_status] ?? b.moderation_status} />
            </View>
            <Text style={{ marginTop: 8, color: live ? colors.success : '#B5600F', fontWeight: '600' }}>{live ? `● ${t.provider.live}` : `○ ${t.provider.notLive}`}</Text>
          </Card>
          <Field label={t.auth.businessName} value={f.name} onChangeText={up('name')} />
          <Select label={t.auth.category} value={f.category} onChange={up('category')} options={options} placeholder={t.common.choose} />
          {f.category === otherValue && <Field label={t.auth.otherCategory} value={f.otherCategory} onChangeText={up('otherCategory')} placeholder={t.auth.otherHint} />}
          <Field label={t.auth.descriptionBiz} value={f.description} onChangeText={up('description')} multiline maxLength={3000} />
          <Field label={t.auth.phone} value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" />
          <Field label={t.auth.website} value={f.website} onChangeText={up('website')} autoCapitalize="none" keyboardType="url" />
          <Field label={t.auth.postcode} value={f.postcode} onChangeText={up('postcode')} autoCapitalize="characters" maxLength={7} />
          <Field label={t.provider.address} value={f.address} onChangeText={up('address')} />
          <ErrorNote text={error} />
          <Button title={saved ? `✓ ${t.common.saved}` : t.common.save} onPress={save} loading={busy} variant={saved ? 'secondary' : 'primary'} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
