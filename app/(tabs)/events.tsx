import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Events</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
});
