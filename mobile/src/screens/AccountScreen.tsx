import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { Body, Button, Card, Chip, H2, s as ui } from '../components/ui';
import { ensureNotificationPermission, notificationsGranted } from '../notifications';
import { SITE_URL, SUPPORT_EMAIL } from '../config';

function Row({ label, onPress, value }: { label: string; onPress?: () => void; value?: string }) {
  return (
    <Text onPress={onPress} style={{ paddingVertical: 13, fontSize: 16, color: onPress ? colors.primary : colors.ink, borderTopWidth: 1, borderTopColor: colors.line }}>
      {label}{value ? <Text style={{ color: colors.muted }}>{`  ${value}`}</Text> : null}{onPress ? '  ›' : ''}
    </Text>
  );
}

export default function AccountScreen() {
  const nav = useNavigation<any>();
  const { me, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const meta = useMeta();
  const [notif, setNotif] = useState(false);
  useEffect(() => { notificationsGranted().then(setNotif).catch(() => undefined); }, []);
  const email = meta.contactEmail || SUPPORT_EMAIL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={ui.title}>{t.account.title}</Text>
        <Card style={{ marginTop: 18 }}>
          {me ? (
            <View>
              <Text style={{ color: colors.muted }}>{t.account.signedInAs}</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy, marginTop: 4 }}>{me.user.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>{me.user.email} · {me.user.role === 'provider' ? t.auth.business : t.auth.resident}</Text>
              <Button title={t.auth.logout} variant="secondary" onPress={logout} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <View>
              <Body muted>{t.account.notSignedIn}</Body>
              <Button title={t.auth.login} onPress={() => nav.navigate('Login')} style={{ marginTop: 14 }} />
              <Button title={t.auth.signup} variant="secondary" onPress={() => nav.navigate('Signup')} style={{ marginTop: 10 }} />
            </View>
          )}
        </Card>

        <Card>
          <H2>{t.account.language}</H2>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Chip label="🇳🇱  Nederlands" active={lang === 'nl'} onPress={() => setLang('nl')} />
            <Chip label="🇬🇧  English" active={lang === 'en'} onPress={() => setLang('en')} />
          </View>
        </Card>

        <Card>
          <H2>{t.account.notifications}</H2>
          <Button title={notif ? `✓ ${t.account.notificationsOn}` : t.account.notificationsOff} variant={notif ? 'secondary' : 'primary'} disabled={notif}
            onPress={async () => setNotif(await ensureNotificationPermission())} style={{ marginTop: 12 }} />
        </Card>

        {(!me || me.user.role !== 'provider') && (
          <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
            <Text style={[ui.h2, { color: '#fff' }]}>{t.account.forBusinesses}</Text>
            <Text style={[ui.body, { color: '#D7DEF0', marginTop: 6, marginBottom: 14 }]}>{t.account.forBusinessesBody}</Text>
            <Button title={t.account.registerBusiness} onPress={() => nav.navigate('Signup', { role: 'provider' })} />
          </Card>
        )}

        <Card>
          <H2 style={{ marginBottom: 8 }}>{t.account.help}</H2>
          <Row label={t.account.contact} value={email} onPress={() => Linking.openURL(`mailto:${email}`)} />
          <Row label={t.account.website} value="uithoorn.online" onPress={() => Linking.openURL(lang === 'en' ? `${SITE_URL}/en` : SITE_URL)} />
          <Row label={t.account.privacy} onPress={() => Linking.openURL(meta.links.privacy?.[lang] ?? `${SITE_URL}/privacy`)} />
          <Row label={t.account.terms} onPress={() => Linking.openURL(meta.links.terms?.[lang] ?? `${SITE_URL}/voorwaarden`)} />
          {me ? <Row label={t.account.deleteAccount} onPress={() => Linking.openURL(`${SITE_URL}${lang === 'en' ? '/en' : ''}/account/settings`)} /> : null}
          {me ? <Text style={[ui.hint, { marginTop: 4 }]}>{t.account.deleteBody} {email}.</Text> : null}
          <Row label={t.account.version} value={`${Constants.expoConfig?.version ?? '1.0.0'}`} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
