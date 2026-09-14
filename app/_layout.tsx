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
import { start as startSync } from '../services/outbox';
import { useEventsStore } from '../store/useEventsStore';

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
    // Ler a cópia local é instantâneo e não precisa de rede — a app abre sempre, com ou sem sinal.
    // A sincronização com o GitHub arranca a seguir e trata-se a si própria (ADR 0004).
    useEventsStore.getState().load();
    void startSync();
  }, []);

  // Aguardar fontes — se falharem, renderiza na mesma com fontes do sistema
  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tabs (écrans principais) */}
        <Stack.Screen name="(tabs)" />

        {/* Detalhe — fora do tab group, sem tab bar */}
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="deck/[id]" />
        <Stack.Screen name="opponent/[id]" />
        <Stack.Screen name="basic-lands" />

        {/* Modais — sobem desde baixo */}
        <Stack.Screen
          name="match-registration"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="add-event"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="deck-editor"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="deck-scan"
          options={{ presentation: 'modal' }}
        />
        {/*
          O contador abre por cima do registo — é a ferramenta que serve o formulário, não um écran
          irmão. `fullScreenModal` porque a mesa partilhada precisa do ecrã todo: um modal normal
          deixaria uma faixa do écran de trás por cima da metade do adversário.
        */}
        <Stack.Screen
          name="life-counter"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}
