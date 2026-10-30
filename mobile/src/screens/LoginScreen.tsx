import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Body, Button, ErrorNote, Field, Logo, s as ui } from '../components/ui';

export default function LoginScreen() {
  const nav = useNavigation<any>();
  const { t, lang } = useLang();
  const meta = useMeta();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null); setBusy(true);
    try {
      const me = await login(email, password, lang);
      if (!me) throw new ApiError('error', 0);
      nav.goBack();
    } catch (e) {
      setError(errorText(t, e instanceof ApiError ? e.code : undefined));
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={[ui.title, { marginTop: 26 }]}>{t.auth.welcomeBack}</Text>
        <Body muted style={{ marginTop: 6, marginBottom: 22 }}>{t.auth.loginIntro}</Body>
        <Field label={t.auth.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label={t.auth.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
        <ErrorNote text={error} />
        <Button title={t.auth.login} onPress={submit} loading={busy} disabled={!email || !password} />
        <Button title={t.auth.forgot} variant="ghost" onPress={() => Linking.openURL(meta.links.forgotPassword?.[lang] ?? 'https://uithoorn.online/forgot-password')} style={{ marginTop: 6 }} />
        <View style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: colors.muted }}>{t.auth.noAccount}</Text>
          <Button title={t.auth.signup} variant="secondary" onPress={() => nav.replace('Signup')} style={{ marginTop: 10, alignSelf: 'stretch' }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
