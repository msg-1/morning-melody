export interface Track {
  id: number;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number;
  localUri: string;
  artworkUri: string | null;
  available: boolean;
}

export interface Playlist {
  id: number;
  name: string;
  createdAt: number;
  shuffle: boolean;
  repeat: boolean;
  songCount: number;
  totalDurationMs: number;
}

export interface Alarm {
  id: number;
  hour: number;
  minute: number;
  enabled: boolean;
  /** Bitmask: bit 0 is Monday, bit 6 is Sunday, zero rings once. */
  repeatDays: number;
  playlistId: number | null;
  volume: number;
  startFromBeginning: boolean;
  createdAt: number;
  nextTriggerAt: number | null;
}

export type AlarmInput = Omit<Alarm, 'id' | 'createdAt' | 'nextTriggerAt'> & {
  id?: number;
};

export interface PlaybackState {
  hasQueue: boolean;
  isPlaying: boolean;
  playWhenReady: boolean;
  isLoading: boolean;
  title: string | null;
  artist: string | null;
  album: string | null;
  artworkUri: string | null;
  positionMs: number;
  durationMs: number;
  index: number;
  count: number;
  shuffle: boolean;
  repeat: boolean;
  playlistId: number | null;
  playlistName: string | null;
  isAlarm: boolean;
  fallback: boolean;
  skippedSongs: number;
}

export interface SetupStatus {
  music: boolean;
  notifications: boolean;
  exactAlarms: boolean;
  battery: boolean;
  fullScreen: boolean;
  hasAutostartPage: boolean;
  manufacturer: string;
}

export type SetupSetting =
  | 'exactAlarms'
  | 'battery'
  | 'fullScreen'
  | 'notifications'
  | 'autostart'
  | 'app';
