import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLang } from '../i18n';
import { Body, Button, Card, H2 } from './ui';

export default function LoginPrompt({ text }: { text: string }) {
  const nav = useNavigation<any>();
  const { t } = useLang();
  return (
    <Card style={{ marginTop: 12 }}>
      <H2>{t.auth.login}</H2>
      <Body muted style={{ marginTop: 6, marginBottom: 16 }}>{text}</Body>
      <Button title={t.auth.login} onPress={() => nav.navigate('Login')} />
      <View style={{ height: 10 }} />
      <Button title={t.auth.signup} variant="secondary" onPress={() => nav.navigate('Signup', { role: 'customer' })} />
    </Card>
  );
}
