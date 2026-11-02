import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { ArtCircle } from './ArtCircle';
import { Icon, IconName } from './Icon';
import { colors, MIN_TOUCH } from '../theme';
import { formatDuration } from '../utils/format';
import type { Track } from '../types';

export function trackSubtitle(track: Track) {
  if (!track.available) return 'This song is no longer on the phone';
  const source = [track.artist, track.album].filter(Boolean).join(' · ');
  const duration = track.durationMs > 0 ? formatDuration(track.durationMs) : '';
  return [source, duration].filter(Boolean).join(' · ');
}

export function RowIconButton({
  icon,
  label,
  disabled,
  color = colors.sage,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, { opacity: disabled ? 0.3 : 1 }]}>
      <Icon name={icon} size={30} color={color} />
    </Pressable>
  );
}

export function TrackRow({
  track,
  seed,
  onPress,
  selected,
  children,
}: {
  track: Track;
  seed: number;
  onPress?: () => void;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
        accessibilityState={
          selected === undefined ? undefined : { checked: selected }
        }
        style={styles.main}>
        <ArtCircle size={50} seed={seed} uri={track.artworkUri} />
        <View style={styles.text}>
          <AppText
            variant="cardTitle"
            numberOfLines={2}
            color={track.available ? colors.ink : colors.muted}>
            {track.title}
          </AppText>
          <AppText variant="secondary" numberOfLines={2}>
            {trackSubtitle(track)}
          </AppText>
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  text: { flex: 1, marginLeft: 14, marginRight: 4 },
  iconButton: {
    width: MIN_TOUCH - 8,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
