import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';

export function Title({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.title, style]} accessibilityRole="header">{children}</Text>;
}
export function Subtitle({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.subtitle, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.h2, style]} accessibilityRole="header">{children}</Text>;
}
export function Body({ children, style, muted }: { children: React.ReactNode; style?: any; muted?: boolean }) {
  return <Text style={[s.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, icon }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; style?: ViewStyle; icon?: React.ReactNode }) {
  const v = variant;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, v === 'primary' && s.btnPrimary, v === 'secondary' && s.btnSecondary, v === 'ghost' && s.btnGhost, v === 'danger' && s.btnDanger, (disabled || loading) && { opacity: 0.55 }, pressed && { opacity: 0.85 }, style]}>
      {loading ? <ActivityIndicator color={v === 'primary' || v === 'danger' ? '#fff' : colors.primary} /> : (
        <View style={s.row}>{icon}<Text style={[s.btnText, (v === 'secondary' || v === 'ghost') && { color: colors.primary }]}>{title}</Text></View>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style as any]}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#98A0B3" {...props} onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[s.input, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, focus && { borderColor: colors.primary }, error ? { borderColor: colors.danger } : null]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Select({ label, value, options, onChange, placeholder }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[s.input, { justifyContent: 'center' }]}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: current ? colors.ink : '#98A0B3', fontSize: 16, flex: 1 }} numberOfLines={1}>{current ? current.label : placeholder}</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>▾</Text>
        </View>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.sheetBackdrop}>
          <SafeAreaView edges={['bottom']} style={s.sheet}>
            <View style={[s.row, { justifyContent: 'space-between', padding: 16 }]}>
              <Text style={s.h2}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}><Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>✕</Text></Pressable>
            </View>
            <FlatList data={options} keyExtractor={(o) => o.value} renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.value); setOpen(false); }} style={({ pressed }) => [s.option, pressed && { backgroundColor: colors.soft }]}>
                <Text style={[{ fontSize: 16, color: colors.ink, flex: 1 }, item.value === value && { color: colors.primary, fontWeight: '700' }]}>{item.label}</Text>
                {item.value === value ? <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text> : null}
              </Pressable>
            )} />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: any; onPress?: () => void }) {
  if (onPress) return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, pressed && { backgroundColor: '#FAFBFD' }, style]}>{children}</Pressable>;
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const bg = { neutral: colors.soft, primary: '#E3EAFB', success: '#E2F4EA', warning: '#FDEEDC', danger: '#FBE3E5' }[tone];
  const fg = { neutral: colors.muted, primary: colors.primary, success: colors.success, warning: '#B5600F', danger: colors.danger }[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{label}</Text></View>;
}

export function Loading({ label }: { label?: string }) {
  return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" />{label ? <Text style={[s.body, { marginTop: 12, color: colors.muted }]}>{label}</Text> : null}</View>;
}

export function Empty({ title, body, action }: { title?: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      {title ? <Text style={[s.h2, { textAlign: 'center', marginBottom: 6 }]}>{title}</Text> : null}
      <Text style={[s.body, { textAlign: 'center', color: colors.muted }]}>{body}</Text>
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function ErrorNote({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <View style={s.error} accessibilityLiveRegion="polite"><Text style={{ color: colors.danger, fontSize: 15 }}>{text}</Text></View>;
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={[s.row, { gap: 10 }]}>
      <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.46, height: size * 0.5, borderTopLeftRadius: size * 0.23, borderTopRightRadius: size * 0.23, borderWidth: size * 0.09, borderBottomWidth: 0, borderColor: '#fff', marginTop: size * 0.08 }} />
      </View>
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.6, color: colors.navy }}>Uithoorn<Text style={{ color: colors.primary }}>.online</Text></Text>
    </View>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.navy, lineHeight: 36 },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 4 },
  h2: { fontFamily: fonts.serif, fontSize: 20, color: colors.navy },
  body: { fontSize: 16, color: colors.ink, lineHeight: 23 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy, marginBottom: 6 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 14, minHeight: 50, fontSize: 16, color: colors.ink },
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary },
  btnGhost: { backgroundColor: 'transparent' },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.line, justifyContent: 'center', marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.navy, fontWeight: '600' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 28 },
  error: { backgroundColor: '#FBE3E5', borderRadius: radius.sm, padding: 12, marginBottom: 14 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(16,34,74,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%' },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
