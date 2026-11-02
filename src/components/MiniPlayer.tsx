import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { usePlayback } from '../hooks/usePlayback';
import { player } from '../services/audio';
import { colors, MIN_TOUCH, radius } from '../theme';
import type { RootStackParams } from '../navigation/types';

/** Keeps Pause and Stop one tap away from every tab while music is playing. */
export function MiniPlayer() {
  const playback = usePlayback();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  if (!playback.hasQueue) return null;
  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.info}
        accessibilityRole="button"
        accessibilityLabel={`Now playing ${playback.title ?? ''}. Open player`}
        onPress={() => navigation.navigate('NowPlaying')}>
        <AppText variant="cardTitle" color={colors.onSage} numberOfLines={1}>
          {playback.title ?? 'Your music'}
        </AppText>
        <AppText variant="secondary" color={colors.onSageSoft} numberOfLines={1}>
          {playback.playlistName ?? 'Tap to open the player'}
        </AppText>
      </Pressable>
      <Pressable
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={playback.playWhenReady ? 'Pause' : 'Play'}
        onPress={playback.playWhenReady ? player.pause : player.play}>
        <Icon
          name={playback.playWhenReady ? 'pause' : 'play'}
          size={32}
          color={colors.onSage}
        />
      </Pressable>
      <Pressable
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel="Stop"
        onPress={player.stop}>
        <Icon name="stop" size={32} color={colors.onSage} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sage,
    borderRadius: radius.button,
    marginHorizontal: 10,
    marginVertical: 8,
    paddingLeft: 16,
    minHeight: 68,
  },
  info: { flex: 1, paddingVertical: 8 },
  control: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
