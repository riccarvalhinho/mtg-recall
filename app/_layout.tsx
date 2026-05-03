import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
  EBGaramond_700Bold,
} from '@expo-google-fonts/eb-garamond';
import { signInAnonymously } from '../services/auth';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    EBGaramond_700Bold,
  });

  useEffect(() => {
    signInAnonymously();
  }, []);

  // Aguardar fontes — se falharem, renderiza na mesma com fontes do sistema
  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tabs (écrans principais) */}
        <Stack.Screen name="(tabs)" />

        {/* Event Detail — fora do tab group, sem tab bar */}
        <Stack.Screen name="event/[id]" />

        {/* Modais — sobem desde baixo */}
        <Stack.Screen
          name="match-registration"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="add-event"
          options={{ presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
