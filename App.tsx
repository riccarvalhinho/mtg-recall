import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { signInAnonymously, testDatabaseConnection } from './services/auth';

export default function App() {
  const [status, setStatus] = useState('A ligar...');

  useEffect(() => {
    async function init() {
      const { user, error } = await signInAnonymously();
      if (error || !user) {
        setStatus(`Erro no login anónimo:\n${error?.message}`);
        return;
      }

      const connected = await testDatabaseConnection();
      setStatus(connected ? `Ligado ✓\nUser ID: ${user.id}` : 'Erro na ligação à DB');
    }

    init();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
