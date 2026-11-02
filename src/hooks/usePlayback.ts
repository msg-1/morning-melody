import { useSyncExternalStore } from 'react';
import { getPlaybackSnapshot, subscribePlayback } from '../services/audio';

export const usePlayback = () =>
  useSyncExternalStore(subscribePlayback, getPlaybackSnapshot);
