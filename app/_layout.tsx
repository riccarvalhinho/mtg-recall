import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { signInAnonymously } from '../services/auth';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  useEffect(() => {
    signInAnonymously();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
