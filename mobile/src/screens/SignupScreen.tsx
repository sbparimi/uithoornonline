import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Body, Button, Chip, ErrorNote, Field, Select, s as ui } from '../components/ui';

export default function SignupScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const { signup } = useAuth();
  const startedAt = useRef(Date.now());
  const [role, setRole] = useState<'customer' | 'provider'>(route.params?.role ?? 'customer');
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', business: '', category: '', otherCategory: '', description: '', website: '', postcode: '', publicEmail: '' });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const otherValue = meta.businessCategories.find((c) => c.other)?.value ?? 'Overig';
  const categoryOptions = [...meta.businessCategories.filter((c) => !c.other)].sort((a, b) => label(a).localeCompare(label(b), lang)).concat(meta.businessCategories.filter((c) => c.other)).map((c) => ({ value: c.value, label: label(c) }));
  const businessCategory = f.category === otherValue ? f.otherCategory.trim() : f.category;

  async function submit() {
    setError(null);
    if (role === 'provider' && businessCategory.length < 2) return setError(t.errors.invalid_business);
    if (role === 'provider' && f.description.trim().length < 20) return setError(t.errors.invalid_description);
    if (!accept) return setError(t.errors.terms_required);
    setBusy(true);
    try {
      const me = await signup({
        form_started_at: startedAt.current, company_website: '',
        email: f.email.trim(), password: f.password, fullName: f.name.trim(), phone: f.phone.trim(), role,
        businessName: f.business.trim(), businessCategory, businessDescription: f.description.trim(), website: f.website.trim(), publicEmail: role === 'provider' ? f.publicEmail.trim() : '', postcode: f.postcode.trim().toUpperCase(),
        acceptTerms: accept, lang,
      });
      if (!me) throw new ApiError('error', 0);
      nav.goBack();
    } catch (e) {
      setError(errorText(t, e instanceof ApiError ? e.code : undefined));
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>{t.auth.signup}</Text>
        <Body muted style={{ marginTop: 6, marginBottom: 18 }}>{t.auth.signupIntro}</Body>
        <Text style={ui.label}>{t.auth.iAm}</Text>
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          <Chip label={`🏠  ${t.auth.resident}`} active={role === 'customer'} onPress={() => setRole('customer')} />
          <Chip label={`🧰  ${t.auth.business}`} active={role === 'provider'} onPress={() => setRole('provider')} />
        </View>
        <Field label={t.auth.name} value={f.name} onChangeText={up('name')} autoComplete="name" textContentType="name" />
        <Field label={t.auth.email} value={f.email} onChangeText={up('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label={t.auth.password} hint={t.auth.passwordHint} value={f.password} onChangeText={up('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Field label={role === 'provider' ? t.auth.phone : t.auth.phoneOpt} value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" placeholder="06 12345678" autoComplete="tel" />
        {role === 'provider' && (
          <View>
            <Field label={t.auth.businessName} value={f.business} onChangeText={up('business')} autoComplete="organization" />
            <Select label={t.auth.category} value={f.category} onChange={up('category')} options={categoryOptions} placeholder={t.common.choose} />
            {f.category === otherValue && <Field label={t.auth.otherCategory} value={f.otherCategory} onChangeText={up('otherCategory')} placeholder={t.auth.otherHint} maxLength={80} />}
            <Field label={t.auth.descriptionBiz} hint={t.auth.descriptionBizHint} value={f.description} onChangeText={up('description')} multiline maxLength={3000} />
            <Field label={t.auth.website} value={f.website} onChangeText={up('website')} autoCapitalize="none" keyboardType="url" placeholder="www.jouwbedrijf.nl" />
            <Field label={t.auth.publicEmail} hint={t.auth.publicEmailHint} value={f.publicEmail} onChangeText={up('publicEmail')} keyboardType="email-address" autoCapitalize="none" placeholder="info@jouwbedrijf.nl" />
            <Field label={t.auth.postcode} value={f.postcode} onChangeText={up('postcode')} autoCapitalize="characters" placeholder="1421 AB" maxLength={7} />
          </View>
        )}
        <Pressable onPress={() => setAccept(!accept)} style={[ui.row, { marginVertical: 10, gap: 12 }]} accessibilityRole="checkbox" accessibilityState={{ checked: accept }}>
          <Switch value={accept} onValueChange={setAccept} trackColor={{ true: colors.primary, false: colors.line }} thumbColor="#fff" />
          <Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>{t.auth.accept}</Text>
        </Pressable>
        <View style={[ui.row, { gap: 18, marginBottom: 16 }]}>
          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => Linking.openURL(meta.links.terms?.[lang] ?? 'https://uithoorn.online/voorwaarden')}>{t.auth.terms} ↗</Text>
          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => Linking.openURL(meta.links.privacy?.[lang] ?? 'https://uithoorn.online/privacy')}>{t.auth.privacy} ↗</Text>
        </View>
        <ErrorNote text={error} />
        <Button title={t.auth.signup} onPress={submit} loading={busy} disabled={!f.email || !f.password || !f.name} />
        <View style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: colors.muted }}>{t.auth.haveAccount}</Text>
          <Button title={t.auth.login} variant="ghost" onPress={() => nav.replace('Login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
