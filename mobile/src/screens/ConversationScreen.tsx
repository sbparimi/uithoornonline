import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, ApiError, Conversation, Message } from '../api';
import { errorText, useLang } from '../i18n';
import { useMeta } from '../meta';
import { colors } from '../theme';
import { ErrorNote, Loading, s as ui } from '../components/ui';
import { formatDate, formatTime } from '../util';
import { notifyLocal } from '../notifications';

export default function ConversationScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { t, lang, label } = useLang();
  const meta = useMeta();
  const id: string = route.params.id;
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const lastRef = useRef<string | undefined>(undefined);

  useLayoutEffect(() => { nav.setOptions({ title: route.params.title ?? '' }); }, [nav, route.params.title]);

  useEffect(() => {
    let alive = true;
    api<{ conversation: Conversation }>(`/api/mobile/conversations/${id}`).then(({ conversation }) => {
      if (!alive) return;
      setConv(conversation); setMessages(conversation.messages);
      lastRef.current = conversation.messages.at(-1)?.created_at;
      nav.setOptions({ title: conversation.side === 'business' ? conversation.customer_name : conversation.business_name });
    }).catch((e) => alive && setError(errorText(t, e instanceof ApiError ? e.code : undefined)));
    // Poll for new messages (the website uses the same endpoint) every 5 s while open.
    const timer = setInterval(async () => {
      if (AppState.currentState !== 'active' && Platform.OS !== 'android') return;
      try {
        const q = lastRef.current ? `?since=${encodeURIComponent(lastRef.current)}` : '';
        const { messages: fresh } = await api<{ messages: Message[] }>(`/api/conversations/${id}/messages${q}`);
        if (alive && fresh.length) {
          setMessages((prev) => { const seen = new Set(prev.map((m) => m.id)); return [...prev, ...fresh.filter((m) => !seen.has(m.id))]; });
          lastRef.current = fresh.at(-1)!.created_at;
          const theirs = fresh.filter((m) => !m.mine);
          if (theirs.length && AppState.currentState !== 'active') notifyLocal(t.notify.newMessage, theirs.at(-1)!.body.slice(0, 120), { conversationId: id });
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true); setError(null);
    try {
      const res = await api<{ id: string }>(`/api/conversations/${id}/messages`, { method: 'POST', body: { body } });
      const now = new Date().toISOString();
      setMessages((prev) => [...prev, { id: res.id, sender_id: null, body, created_at: now, mine: true }]);
      lastRef.current = now;
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setError(errorText(t, e instanceof ApiError ? e.code : undefined));
    } finally { setSending(false); }
  }

  if (!conv && !error) return <Loading label={t.common.loading} />;
  const closed = conv ? !['active', 'scheduled'].includes(conv.status) : false;
  const reqLabel = conv ? label(meta.requestCategories.find((c) => c.value === conv.category), conv.category) : '';

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={conv ? (
            <View style={st.request}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.chat.request} · {reqLabel}</Text>
              <Text style={[ui.body, { marginTop: 6 }]}>{conv.description}</Text>
              <Text style={{ color: colors.muted, marginTop: 6, fontSize: 14 }}>{conv.postcode}{conv.preferred_timing ? ` · ${label(meta.timing.find((x) => x.value === conv.preferred_timing), conv.preferred_timing)}` : ''}</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 20, paddingHorizontal: 20 }}>{t.chat.empty}</Text>}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
            return (
              <View>
                {showDay ? <Text style={st.day}>{formatDate(item.created_at, lang)}</Text> : null}
                <View style={[st.bubble, item.mine ? st.mine : st.theirs]}>
                  <Text style={{ color: item.mine ? '#fff' : colors.ink, fontSize: 16, lineHeight: 22 }}>{item.body}</Text>
                  <Text style={{ color: item.mine ? '#C9D6F8' : colors.muted, fontSize: 11, marginTop: 4, alignSelf: 'flex-end' }}>{formatTime(item.created_at, lang)}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={{ paddingHorizontal: 16 }}><ErrorNote text={error} /></View>
        {closed ? <Text style={st.closed}>{t.chat.closed}</Text> : (
          <View style={st.composer}>
            <TextInput value={text} onChangeText={setText} placeholder={t.chat.placeholder} placeholderTextColor="#98A0B3" multiline maxLength={4000} style={st.input} accessibilityLabel={t.chat.placeholder} />
            <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel={t.common.send} style={[st.send, (sending || !text.trim()) && { opacity: 0.5 }]}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>↑</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  request: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  day: { textAlign: 'center', color: colors.muted, fontSize: 12, marginVertical: 10, fontWeight: '600' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginVertical: 3 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 130, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  closed: { textAlign: 'center', padding: 16, color: colors.muted, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line },
});
