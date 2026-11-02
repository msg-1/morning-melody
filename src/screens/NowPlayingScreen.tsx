import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppText } from '../components/AppText';
import { BigButton, LabelledIconButton } from '../components/Buttons';
import { Icon } from '../components/Icon';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { Slider } from '../components/Slider';
import { usePlayback } from '../hooks/usePlayback';
import { player } from '../services/audio';
import { colors, MIN_TOUCH, spacing } from '../theme';
import { formatDuration, greetingFor } from '../utils/format';

function Artwork({ uri }: { uri: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return (
    <View style={styles.art}>
      <View style={styles.artCircle}>
        <Icon name="music" size={72} />
      </View>
      {uri && uri !== failedUri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, styles.artImage]}
          onError={() => setFailedUri(uri)}
        />
      ) : null}
    </View>
  );
}

export function NowPlayingScreen() {
  const navigation = useNavigation();
  const playback = usePlayback();
  const [canResume, setCanResume] = useState(false);

  useFocusEffect(
    useCallback(() => {
      player.hasSavedPlayback().then(setCanResume);
    }, []),
  );

  const header = (
    <ScreenHeader
      back
      title={greetingFor(new Date().getHours())}
      subtitle="Enjoy your morning"
    />
  );

  if (!playback.hasQueue) {
    return (
      <ScrollPage bottomInset>
        {header}
        <AppText variant="section" style={styles.nothing}>
          Nothing is playing
        </AppText>
        {canResume ? (
          <BigButton
            label="Carry on where I left off"
            icon="play"
            onPress={async () => {
              if (!(await player.resumeLast())) {
                setCanResume(false);
                ToastAndroid.show('That music is no longer available', ToastAndroid.LONG);
              }
            }}
            style={styles.resume}
          />
        ) : null}
        <BigButton
          label="Go back"
          tone="plain"
          onPress={navigation.goBack}
          style={styles.resume}
        />
      </ScrollPage>
    );
  }

  const stop = () => {
    player.stop();
    navigation.goBack();
  };

  return (
    <ScrollPage bottomInset>
      {header}
      <AppText variant="label" style={styles.eyebrow}>
        {playback.isAlarm ? 'YOUR MORNING MUSIC' : 'NOW PLAYING'}
      </AppText>
      <Artwork uri={playback.artworkUri} />

      <AppText variant="title" numberOfLines={2} style={styles.title}>
        {playback.title ?? 'Your music'}
      </AppText>
      <AppText variant="subtitle" numberOfLines={2} style={styles.centered}>
        {playback.fallback
          ? 'Your songs could not be found, so a gentle chime is playing'
          : [playback.artist, playback.playlistName].filter(Boolean).join('  ·  ')}
      </AppText>
      {playback.count > 1 ? (
        <AppText variant="secondary" style={styles.centered}>
          Song {playback.index + 1} of {playback.count}
        </AppText>
      ) : null}
      {playback.skippedSongs > 0 ? (
        <AppText variant="secondary" color={colors.stopText} style={styles.centered}>
          {playback.skippedSongs === 1
            ? '1 song is missing and was skipped'
            : `${playback.skippedSongs} songs are missing and were skipped`}
        </AppText>
      ) : null}

      <Slider
        value={playback.positionMs}
        max={playback.durationMs}
        step={15000}
        label="Position in song"
        valueText={`${formatDuration(playback.positionMs)} of ${formatDuration(playback.durationMs)}`}
        onComplete={player.seekTo}
      />
      <View style={styles.times}>
        <AppText variant="secondary">{formatDuration(playback.positionMs)}</AppText>
        <AppText variant="secondary">{formatDuration(playback.durationMs)}</AppText>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous song"
          onPress={player.previous}
          style={styles.skip}>
          <Icon name="previous" size={44} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playback.playWhenReady ? 'Pause' : 'Play'}
          onPress={playback.playWhenReady ? player.pause : player.play}
          style={styles.playPause}>
          <Icon
            name={playback.playWhenReady ? 'pause' : 'play'}
            size={48}
            color={colors.onSage}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next song"
          onPress={player.next}
          style={styles.skip}>
          <Icon name="next" size={44} />
        </Pressable>
      </View>

      <View style={styles.modes}>
        <LabelledIconButton
          label="Shuffle"
          icon="shuffle"
          active={playback.shuffle}
          onPress={() => player.setShuffle(!playback.shuffle)}
        />
        <LabelledIconButton
          label="Repeat"
          icon="repeat"
          active={playback.repeat}
          onPress={() => player.setRepeat(!playback.repeat)}
        />
      </View>

      <BigButton
        label={playback.isAlarm ? 'Stop alarm' : 'Stop music'}
        tone="stop"
        icon="stop"
        onPress={stop}
        style={styles.stop}
      />
      <AppText variant="secondary" style={styles.footer}>
        Playing from this device
      </AppText>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  nothing: { textAlign: 'center', marginVertical: 32 },
  resume: { marginBottom: spacing.gap },
  eyebrow: { textAlign: 'center', marginTop: 4, marginBottom: 14 },
  art: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 26,
    backgroundColor: colors.artTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.artCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artImage: { width: 200, height: 200 },
  title: { textAlign: 'center', marginTop: 18 },
  centered: { textAlign: 'center' },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: 12,
  },
  skip: {
    width: MIN_TOUCH + 16,
    height: MIN_TOUCH + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPause: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modes: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stop: { marginTop: spacing.gap, minHeight: 66 },
  footer: { textAlign: 'center', marginTop: 14 },
});
