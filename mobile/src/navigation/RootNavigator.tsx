import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';
import DiscoverScreen from '../screens/DiscoverScreen';
import BusinessScreen from '../screens/BusinessScreen';
import RequestScreen from '../screens/RequestScreen';
import MineScreen from '../screens/MineScreen';
import AccountScreen from '../screens/AccountScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ConversationScreen from '../screens/ConversationScreen';
import LeadsScreen from '../screens/LeadsScreen';
import LeadScreen from '../screens/LeadScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const icon = (glyph: string) => ({ color, size }: { color: string; size: number }) => <Text style={{ color, fontSize: size - 2 }}>{glyph}</Text>;

function Tabs() {
  const { me } = useAuth();
  const { t } = useLang();
  const provider = me?.user.role === 'provider';
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: '#8A93A8', tabBarStyle: { borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
      {provider ? (
        <>
          <Tab.Screen name="Leads" component={LeadsScreen} options={{ title: t.tabs.leads, tabBarIcon: icon('📥') }} />
          <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: t.tabs.messages, tabBarIcon: icon('💬') }} />
          <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t.tabs.profile, tabBarIcon: icon('🏪') }} />
        </>
      ) : (
        <>
          <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: t.tabs.discover, tabBarIcon: icon('🔎') }} />
          <Tab.Screen name="Request" component={RequestScreen} options={{ title: t.tabs.request, tabBarIcon: icon('✍️') }} />
          <Tab.Screen name="Mine" component={MineScreen} options={{ title: t.tabs.mineShort, tabBarIcon: icon('📋') }} />
        </>
      )}
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: t.tabs.account, tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg, card: '#fff', text: colors.navy, border: colors.line } };

export default function RootNavigator() {
  const { t } = useLang();
  const { me } = useAuth();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.navy, fontWeight: '700' }, headerBackTitle: t.common.back, headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} key={me?.user.role ?? 'anon'} />
        <Stack.Screen name="Business" component={BusinessScreen} options={({ route }) => ({ title: route.params.name ?? '' })} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: '' }} />
        <Stack.Screen name="Lead" component={LeadScreen} options={{ title: t.tabs.leads }} />
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: t.auth.login }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ title: t.auth.signup }} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
