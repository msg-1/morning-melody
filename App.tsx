import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigation } from './src/navigation';
import { scanMusic } from './src/services/music-library';

export default function App() {
  useEffect(() => {
    // Picks up new and deleted songs. Does nothing until music access has been allowed.
    scanMusic().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}
