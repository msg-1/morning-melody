import { DeviceEventEmitter, NativeModules } from 'react-native';
import type { PlaybackState } from '../../types';

const { MelodyAudio } = NativeModules;

export const idlePlayback: PlaybackState = {
  hasQueue: false,
  isPlaying: false,
  playWhenReady: false,
  isLoading: false,
  title: null,
  artist: null,
  album: null,
  artworkUri: null,
  positionMs: 0,
  durationMs: 0,
  index: 0,
  count: 0,
  shuffle: false,
  repeat: false,
  playlistId: null,
  playlistName: null,
  isAlarm: false,
  fallback: false,
  skippedSongs: 0,
};

let current = idlePlayback;
const listeners = new Set<() => void>();

const publish = (next: PlaybackState) => {
  current = next;
  listeners.forEach(listener => listener());
};

DeviceEventEmitter.addListener('MelodyPlaybackState', publish);

export const getPlaybackSnapshot = () => current;

export const subscribePlayback = (listener: () => void) => {
  if (listeners.size === 0) {
    MelodyAudio.getState().then(publish, () => {});
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const player = {
  playPlaylist: (playlistId: number, trackId?: number): Promise<boolean> =>
    MelodyAudio.playPlaylist(playlistId, trackId ?? 0),
  resumeLast: (): Promise<boolean> => MelodyAudio.resumeLast(),
  hasSavedPlayback: (): Promise<boolean> => MelodyAudio.hasSavedPlayback(),
  play: () => MelodyAudio.play(),
  pause: () => MelodyAudio.pause(),
  next: () => MelodyAudio.next(),
  previous: () => MelodyAudio.previous(),
  stop: () => MelodyAudio.stop(),
  seekTo: (positionMs: number) => MelodyAudio.seekTo(positionMs),
  setShuffle: (enabled: boolean) => MelodyAudio.setShuffle(enabled),
  setRepeat: (enabled: boolean) => MelodyAudio.setRepeat(enabled),
  preview: (trackIds: number[]): Promise<boolean> =>
    MelodyAudio.preview(trackIds),
  stopPreview: () => MelodyAudio.stopPreview(),
};

export const onPreviewEnded = (
  listener: (event: { message: string | null }) => void,
) => DeviceEventEmitter.addListener('MelodyPreviewEnded', listener);
