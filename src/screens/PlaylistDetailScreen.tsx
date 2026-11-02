import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, ToastAndroid, View } from 'react-native';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../components/AppText';
import { BigButton, LabelledIconButton } from '../components/Buttons';
import { NamePrompt } from '../components/Dialogs';
import { MiniPlayer } from '../components/MiniPlayer';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { RowIconButton, TrackRow } from '../components/TrackRow';
import {
  deletePlaylist,
  getPlaylist,
  moveTrackInPlaylist,
  playlistTracks,
  removeTrackFromPlaylist,
  renamePlaylist,
  setPlaylistOptions,
} from '../database';
import { useFocusData } from '../hooks/useFocusData';
import { usePlayback } from '../hooks/usePlayback';
import { listAlarms } from '../services/alarms';
import { onPreviewEnded, player } from '../services/audio';
import { colors, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Playlist, Track } from '../types';
import { formatPlaylistSummary } from '../utils/format';

type Route = RouteProp<RootStackParams, 'PlaylistDetail'>;

const empty = { playlist: null as Playlist | null, tracks: [] as Track[] };

export function PlaylistDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { playlistId } = useRoute<Route>().params;
  const playback = usePlayback();

  const load = useCallback(async () => {
    const [playlist, tracks] = await Promise.all([
      getPlaylist(playlistId),
      playlistTracks(playlistId),
    ]);
    return { playlist, tracks };
  }, [playlistId]);
  const { data, reload } = useFocusData(load, empty);
  const { playlist, tracks } = data;

  const [renaming, setRenaming] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    const subscription = onPreviewEnded(({ message }) => {
      setPreviewing(false);
      if (message) ToastAndroid.show(message, ToastAndroid.LONG);
    });
    return () => {
      subscription.remove();
      player.stopPreview();
    };
  }, []);

  if (!playlist) return <ScrollPage>{null}</ScrollPage>;

  const playable = tracks.filter(track => track.available);
  const isCurrent = playback.playlistId === playlist.id;

  const play = async (trackId?: number) => {
    setPreviewing(false);
    const started = await player.playPlaylist(playlist.id, trackId);
    if (started) navigation.navigate('NowPlaying');
    else ToastAndroid.show('None of these songs could be found', ToastAndroid.LONG);
  };

  const togglePreview = () => {
    if (previewing) {
      player.stopPreview();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    player.preview(playable.map(track => track.id));
    ToastAndroid.show('Playing a short part of each song', ToastAndroid.SHORT);
  };

  const setOptions = async (shuffle: boolean, repeat: boolean) => {
    await setPlaylistOptions(playlist.id, shuffle, repeat);
    if (isCurrent) {
      player.setShuffle(shuffle);
      player.setRepeat(repeat);
    }
    reload();
  };

  const confirmDelete = async () => {
    const alarms = await listAlarms();
    const used = alarms.filter(alarm => alarm.playlistId === playlist.id).length;
    const warning =
      used > 0
        ? ` ${used === 1 ? 'One alarm uses' : `${used} alarms use`} it and will play a chime instead until you choose another.`
        : '';
    Alert.alert(
      `Delete ${playlist.name}?`,
      `Your songs stay on the phone.${warning}`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isCurrent) player.stop();
            await deletePlaylist(playlist.id);
            ToastAndroid.show('Playlist deleted', ToastAndroid.SHORT);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const confirmRemove = (track: Track) =>
    Alert.alert(`Remove ${track.title}?`, 'It stays on the phone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeTrackFromPlaylist(playlist.id, track.id);
          reload();
        },
      },
    ]);

  const move = async (track: Track, delta: -1 | 1) => {
    await moveTrackInPlaylist(playlist.id, track.id, delta);
    reload();
  };

  return (
    <ScrollPage bottomInset footer={<MiniPlayer />}>
      <ScreenHeader
        back
        title={playlist.name}
        subtitle={formatPlaylistSummary(playlist.songCount, playlist.totalDurationMs)}
      />

      <BigButton
        label="Play"
        icon="play"
        disabled={playable.length === 0}
        onPress={() => play()}
        style={styles.play}
      />

      <View style={styles.options}>
        <LabelledIconButton
          label={previewing ? 'Stop' : 'Preview'}
          icon={previewing ? 'stop' : 'listen'}
          onPress={togglePreview}
        />
        <LabelledIconButton
          label="Shuffle"
          icon="shuffle"
          active={playlist.shuffle}
          onPress={() => setOptions(!playlist.shuffle, playlist.repeat)}
        />
        <LabelledIconButton
          label="Repeat"
          icon="repeat"
          active={playlist.repeat}
          onPress={() => setOptions(playlist.shuffle, !playlist.repeat)}
        />
      </View>

      <BigButton
        label="Add songs"
        icon="plus"
        tone="soft"
        onPress={() =>
          navigation.navigate('AddSongs', { playlistId: playlist.id })
        }
      />

      <AppText variant="section" style={styles.section}>
        Songs
      </AppText>
      {tracks.length === 0 ? (
        <AppText variant="secondary">
          No songs yet. Tap Add songs to choose some from your phone.
        </AppText>
      ) : null}
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          seed={index}
          onPress={track.available ? () => play(track.id) : undefined}>
          <RowIconButton
            icon="chevronUp"
            label={`Move ${track.title} up`}
            disabled={index === 0}
            onPress={() => move(track, -1)}
          />
          <RowIconButton
            icon="chevronDown"
            label={`Move ${track.title} down`}
            disabled={index === tracks.length - 1}
            onPress={() => move(track, 1)}
          />
          <RowIconButton
            icon="close"
            label={`Remove ${track.title}`}
            color={colors.stopText}
            onPress={() => confirmRemove(track)}
          />
        </TrackRow>
      ))}

      <View style={styles.manage}>
        <BigButton
          label="Rename playlist"
          icon="edit"
          tone="plain"
          onPress={() => setRenaming(true)}
        />
        <BigButton
          label="Delete playlist"
          icon="trash"
          tone="stop"
          onPress={confirmDelete}
        />
      </View>

      <NamePrompt
        visible={renaming}
        title="Rename playlist"
        initial={playlist.name}
        confirmLabel="Save name"
        onCancel={() => setRenaming(false)}
        onSubmit={async name => {
          setRenaming(false);
          await renamePlaylist(playlist.id, name);
          reload();
        }}
      />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  play: { marginTop: 4 },
  options: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: spacing.gap,
  },
  section: { marginTop: 24, marginBottom: 4 },
  manage: { gap: spacing.gap, marginTop: 28 },
});
