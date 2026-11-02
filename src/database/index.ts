import { NativeModules } from 'react-native';
import type { Playlist, Track } from '../types';

// The SQLite database lives in android/.../db/MelodyDatabase.kt so that alarms can read it with no
// JavaScript running. This file is the typed doorway to it.
const { MelodyData } = NativeModules;

export const listTracks = (search?: string): Promise<Track[]> =>
  MelodyData.listTracks(search ?? null);

export const listPlaylists = (): Promise<Playlist[]> =>
  MelodyData.listPlaylists();

export const getPlaylist = (id: number): Promise<Playlist | null> =>
  MelodyData.getPlaylist(id);

export const createPlaylist = (name: string): Promise<number> =>
  MelodyData.createPlaylist(name);

export const renamePlaylist = (id: number, name: string): Promise<void> =>
  MelodyData.renamePlaylist(id, name);

export const deletePlaylist = (id: number): Promise<void> =>
  MelodyData.deletePlaylist(id);

export const setPlaylistOptions = (
  id: number,
  shuffle: boolean,
  repeat: boolean,
): Promise<void> => MelodyData.setPlaylistOptions(id, shuffle, repeat);

export const playlistTracks = (id: number): Promise<Track[]> =>
  MelodyData.playlistTracks(id);

export const addTracksToPlaylist = (
  id: number,
  trackIds: number[],
): Promise<number> => MelodyData.addTracksToPlaylist(id, trackIds);

export const removeTrackFromPlaylist = (
  id: number,
  trackId: number,
): Promise<void> => MelodyData.removeTrackFromPlaylist(id, trackId);

export const moveTrackInPlaylist = (
  id: number,
  trackId: number,
  delta: -1 | 1,
): Promise<void> => MelodyData.moveTrackInPlaylist(id, trackId, delta);

export const getSetting = (key: string): Promise<string | null> =>
  MelodyData.getSetting(key);

export const setSetting = (key: string, value: string): Promise<void> =>
  MelodyData.setSetting(key, value);
