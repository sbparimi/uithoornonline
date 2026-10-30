import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Body, Button, Card, ErrorNote, Field, H2, Select, s as ui } from '../components/ui';
import LoginPrompt from '../components/LoginPrompt';
import { formatPostcode, validPostcode } from '../util';

export default function RequestScreen() {
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const { me, refresh } = useAuth();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const startedAt = useRef(Date.now());
  const [category, setCategory] = useState(meta.requestCategories[0]?.value ?? '');
  const [description, setDescription] = useState('');
  const [postcode, setPostcode] = useState('');
  const [timing, setTiming] = useState('');
  const [urgency, setUrgency] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ matched: number } | null>(null);

  useEffect(() => { if (route.params?.category) { setCategory(route.params.category); setDone(null); } }, [route.params?.category]);

  const opts = (list: { value: string; nl: string; en: string }[]) => list.map((o) => ({ value: o.value, label: label(o) }));

  async function submit() {
    setError(null);
    const desc = description.trim();
    if (desc.length < 15) return setError(t.request.errDesc);
    if (!validPostcode(postcode)) return setError(t.request.errPostcode);
    if (!timing || !urgency) return setError(t.request.errTiming);
    const min = budgetMin ? Number(budgetMin.replace(',', '.')) : null;
    const max = budgetMax ? Number(budgetMax.replace(',', '.')) : null;
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && max < min)) return setError(t.request.errBudget);
    setBusy(true);
    try {
      const res = await api<{ matched: number }>('/api/requests', { method: 'POST', body: { category, description: desc, postcode: formatPostcode(postcode), preferredTiming: timing, urgency, budgetMin: min, budgetMax: max, lang, form_started_at: startedAt.current, company_website: '' } });
      setDone({ matched: res.matched ?? 0 });
      setDescription(''); setPostcode(''); setTiming(''); setUrgency(''); setBudgetMin(''); setBudgetMax('');
      startedAt.current = Date.now();
      refresh();
    } catch (e) {
      setError(errorText(t, e instanceof ApiError ? e.code : undefined));
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Text style={ui.title}>{t.request.title}</Text>
          <Body muted style={{ marginTop: 6, marginBottom: 18 }}>{t.request.intro}</Body>
          {!me ? <LoginPrompt text={t.request.loginFirst} /> : me.user.role === 'provider' ? (
            <Card><Body>{t.request.providerNote}</Body></Card>
          ) : done ? (
            <Card>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <H2 style={{ marginTop: 8 }}>{t.request.done}</H2>
              <Body style={{ marginTop: 8, marginBottom: 16 }}>{done.matched > 0 ? t.request.doneMatched(done.matched) : t.request.doneOpen}</Body>
              <Button title={t.tabs.mine} onPress={() => { setDone(null); nav.navigate('Mine'); }} />
              <View style={{ height: 10 }} />
              <Button title={t.mine.newRequest} variant="secondary" onPress={() => setDone(null)} />
            </Card>
          ) : (
            <View>
              <Select label={t.request.category} value={category} onChange={setCategory} options={opts(meta.requestCategories)} placeholder={t.common.choose} />
              <Field label={t.request.description} value={description} onChangeText={setDescription} multiline placeholder={t.request.descPlaceholder} maxLength={3000} />
              <Field label={t.request.postcode} value={postcode} onChangeText={setPostcode} placeholder="1421 AB" autoCapitalize="characters" maxLength={7} />
              <Select label={t.request.timing} value={timing} onChange={setTiming} options={opts(meta.timing)} placeholder={t.common.choose} />
              <Select label={t.request.urgency} value={urgency} onChange={setUrgency} options={opts(meta.urgency)} placeholder={t.common.choose} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Field style={{ flex: 1 }} label={`${t.request.budgetMin}`} hint={t.request.optional} value={budgetMin} onChangeText={setBudgetMin} keyboardType="numeric" />
                <Field style={{ flex: 1 }} label={`${t.request.budgetMax}`} hint={t.request.optional} value={budgetMax} onChangeText={setBudgetMax} keyboardType="numeric" />
              </View>
              <ErrorNote text={error} />
              <Button title={busy ? t.request.sending : t.request.submit} onPress={submit} loading={busy} />
              <Text style={[ui.hint, { marginTop: 12, textAlign: 'center' }]}>{t.request.note}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
