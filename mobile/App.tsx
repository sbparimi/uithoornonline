import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, AveriaSerifLibre_400Regular, AveriaSerifLibre_700Bold } from '@expo-google-fonts/averia-serif-libre';
import { LangProvider } from './src/i18n';
import { AuthProvider, useAuth } from './src/auth';
import { MetaProvider } from './src/meta';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { ready } = useAuth();
  const [fontsLoaded, fontError] = useFonts({ AveriaSerifLibre_400Regular, AveriaSerifLibre_700Bold });
  const show = ready && (fontsLoaded || !!fontError);
  useEffect(() => { if (show) SplashScreen.hideAsync().catch(() => undefined); }, [show]);
  if (!show) return <View style={{ flex: 1, backgroundColor: colors.primary }} />;
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <MetaProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <Gate />
          </AuthProvider>
        </MetaProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
