import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { MelodyMusicLibrary } = NativeModules;

const AUDIO_PERMISSION =
  Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

export const hasMusicPermission = (): Promise<boolean> =>
  MelodyMusicLibrary.hasPermission();

export const requestMusicPermission = async (): Promise<boolean> =>
  (await PermissionsAndroid.request(AUDIO_PERMISSION)) ===
  PermissionsAndroid.RESULTS.GRANTED;

/** Refreshes song information from the phone. Resolves false without permission. */
export const scanMusic = (): Promise<boolean> => MelodyMusicLibrary.scan();

/** Opens Android's file picker and resolves with how many songs were added. */
export const pickMusicFiles = (): Promise<number> =>
  MelodyMusicLibrary.pickFiles();
