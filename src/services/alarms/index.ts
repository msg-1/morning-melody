import { NativeModules } from 'react-native';
import type { Alarm, AlarmInput, SetupSetting, SetupStatus } from '../../types';

const { MelodyAlarms } = NativeModules;

export const listAlarms = (): Promise<Alarm[]> => MelodyAlarms.listAlarms();

export const getAlarm = (id: number): Promise<Alarm | null> =>
  MelodyAlarms.getAlarm(id);

export const saveAlarm = (alarm: AlarmInput): Promise<Alarm> =>
  MelodyAlarms.saveAlarm(alarm);

export const setAlarmEnabled = (id: number, enabled: boolean): Promise<Alarm> =>
  MelodyAlarms.setAlarmEnabled(id, enabled);

export const deleteAlarm = (id: number): Promise<void> =>
  MelodyAlarms.deleteAlarm(id);

/** Sends the real alarm through AlarmManager, so it also proves the phone's restrictions allow it. */
export const scheduleTest = (
  playlistId: number | null,
  volume: number,
  delayMs: number,
): Promise<number> =>
  MelodyAlarms.scheduleTest(playlistId ?? 0, volume, delayMs);

export const pickTime = (
  hour: number,
  minute: number,
): Promise<{ hour: number; minute: number } | null> =>
  MelodyAlarms.pickTime(hour, minute);

export const getSetupStatus = (): Promise<SetupStatus> =>
  MelodyAlarms.getSetupStatus();

export const openSetting = (which: SetupSetting): Promise<void> =>
  MelodyAlarms.openSetting(which);
