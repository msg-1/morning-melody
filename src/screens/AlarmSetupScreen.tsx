import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  ToastAndroid,
  View,
} from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../components/AppText';
import { ArtCircle } from '../components/ArtCircle';
import { BigButton } from '../components/Buttons';
import { ChoiceSheet } from '../components/Dialogs';
import { Icon } from '../components/Icon';
import { MiniPlayer } from '../components/MiniPlayer';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { Slider } from '../components/Slider';
import { listPlaylists } from '../database';
import {
  deleteAlarm,
  getAlarm,
  pickTime,
  saveAlarm,
  scheduleTest,
} from '../services/alarms';
import { colors, fonts, MIN_TOUCH, radius, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Playlist } from '../types';
import {
  describeRingTime,
  EVERY_DAY,
  formatClock,
  formatPlaylistSummary,
  formatRepeatDays,
} from '../utils/format';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const TEST_DELAY_MS = 60_000;

export function AlarmSetupScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const alarmId = useRoute<RouteProp<RootStackParams, 'AlarmSetup'>>().params
    ?.alarmId;

  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [repeatDays, setRepeatDays] = useState(EVERY_DAY);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [volume, setVolume] = useState(70);
  const [fromStart, setFromStart] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [choosing, setChoosing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listPlaylists().then(all => {
        setPlaylists(all);
        setPlaylistId(current => current ?? all[0]?.id ?? null);
      });
    }, []),
  );

  useEffect(() => {
    if (!alarmId) return;
    getAlarm(alarmId).then(alarm => {
      if (!alarm) return;
      setHour(alarm.hour);
      setMinute(alarm.minute);
      setRepeatDays(alarm.repeatDays);
      setPlaylistId(alarm.playlistId);
      setVolume(alarm.volume);
      setFromStart(alarm.startFromBeginning);
    });
  }, [alarmId]);

  const chooseTime = async () => {
    const picked = await pickTime(hour, minute);
    if (picked) {
      setHour(picked.hour);
      setMinute(picked.minute);
    }
  };

  const save = async () => {
    const saved = await saveAlarm({
      id: alarmId,
      hour,
      minute,
      enabled: true,
      repeatDays,
      playlistId,
      volume,
      startFromBeginning: fromStart,
    });
    ToastAndroid.show(
      `Alarm set for ${describeRingTime(saved.nextTriggerAt!)}`,
      ToastAndroid.LONG,
    );
    navigation.goBack();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this alarm?', undefined, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAlarm(alarmId!);
          ToastAndroid.show('Alarm deleted', ToastAndroid.SHORT);
          navigation.goBack();
        },
      },
    ]);

  const test = async () => {
    await scheduleTest(playlistId, volume, TEST_DELAY_MS);
    Alert.alert(
      'Test alarm in 1 minute',
      'Lock the phone and put it down. Your music should start by itself in one minute.',
    );
  };

  const toggleDay = (day: number) => setRepeatDays(mask => mask ^ (1 << day));

  const clock = formatClock(hour, minute);
  const playlist = playlists.find(p => p.id === playlistId);

  return (
    <ScrollPage bottomInset footer={<MiniPlayer />}>
      <ScreenHeader
        back
        title={alarmId ? 'Change alarm' : 'Create alarm'}
        subtitle="Set your wake-up music"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Alarm time ${clock.time} ${clock.period}. Tap to change`}
        onPress={chooseTime}
        style={styles.timeCard}>
        <AppText variant="label">ALARM TIME</AppText>
        <View style={styles.timeRow}>
          <AppText style={styles.time}>{clock.time}</AppText>
          <AppText style={styles.period}>{clock.period}</AppText>
        </View>
        <AppText variant="secondary">Tap time to change</AppText>
      </Pressable>

      <View style={styles.sectionRow}>
        <AppText variant="section">Repeat</AppText>
        <AppText variant="secondary">{formatRepeatDays(repeatDays)}</AppText>
      </View>
      <View style={styles.days}>
        {DAY_LETTERS.map((letter, day) => {
          const on = (repeatDays & (1 << day)) !== 0;
          return (
            <Pressable
              key={DAY_NAMES[day]}
              accessibilityRole="checkbox"
              accessibilityLabel={DAY_NAMES[day]}
              accessibilityState={{ checked: on }}
              onPress={() => toggleDay(day)}
              style={styles.dayTouch}>
              <View style={[styles.day, on && styles.dayOn]}>
                <AppText
                  variant="button"
                  color={on ? colors.onSage : colors.ink}
                  allowFontScaling={false}
                  style={styles.dayText}>
                  {letter}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="section" style={styles.section}>
        Play this playlist
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist: ${playlist?.name ?? 'none'}. Tap to change`}
        onPress={() =>
          playlists.length > 0
            ? setChoosing(true)
            : navigation.popTo('Tabs', { screen: 'Playlists' })
        }
        style={styles.playlist}>
        <ArtCircle size={50} icon="music" tint="#D4E0D0" />
        <View style={styles.playlistText}>
          <AppText variant="cardTitle" numberOfLines={2}>
            {playlist?.name ?? 'Create a playlist first'}
          </AppText>
          {playlist ? (
            <AppText variant="secondary">
              {formatPlaylistSummary(playlist.songCount, playlist.totalDurationMs)}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevronDown" size={32} color={colors.muted} />
      </Pressable>

      <View style={styles.startRow}>
        <AppText variant="cardTitle" style={styles.startText}>
          Start from the first song
        </AppText>
        <Switch
          value={fromStart}
          onValueChange={setFromStart}
          accessibilityLabel="Start from the first song"
          trackColor={{ true: colors.sagePill, false: colors.sageTrack }}
          thumbColor={fromStart ? colors.sage : colors.surface}
          style={styles.switch}
        />
      </View>
      {!fromStart ? (
        <AppText variant="secondary">
          The music will carry on from where it last stopped.
        </AppText>
      ) : null}

      <View style={styles.sectionRow}>
        <AppText variant="cardTitle">Alarm volume</AppText>
        <AppText variant="cardTitle" color={colors.muted}>
          {volume}%
        </AppText>
      </View>
      <Slider
        value={volume}
        step={10}
        label="Alarm volume"
        valueText={`${volume} percent`}
        onChange={value => setVolume(Math.max(10, Math.round(value / 5) * 5))}
      />

      <BigButton
        label="Save alarm"
        disabled={playlistId === null}
        onPress={save}
        style={styles.save}
      />
      <BigButton
        label="Test in 1 minute"
        icon="clock"
        tone="soft"
        disabled={playlistId === null}
        onPress={test}
        style={styles.secondaryButton}
      />
      {alarmId ? (
        <BigButton
          label="Delete alarm"
          icon="trash"
          tone="stop"
          onPress={confirmDelete}
          style={styles.secondaryButton}
        />
      ) : null}

      <ChoiceSheet
        visible={choosing}
        title="Choose a playlist"
        choices={playlists.map(p => ({
          key: p.id,
          title: p.name,
          detail: formatPlaylistSummary(p.songCount, p.totalDurationMs),
        }))}
        onClose={() => setChoosing(false)}
        onChoose={choice => {
          setPlaylistId(Number(choice.key));
          setChoosing(false);
        }}
      />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  timeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginTop: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: 14,
  },
  time: { fontFamily: fonts.bold, fontSize: 64, lineHeight: 76, color: colors.sage },
  period: { fontFamily: fonts.bold, fontSize: 20, color: colors.muted, marginLeft: 12 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 10,
  },
  section: { marginTop: 26, marginBottom: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayTouch: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sageSoft,
  },
  dayOn: { backgroundColor: colors.sage },
  dayText: { fontSize: 16 },
  playlist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sageSoft,
    borderRadius: radius.button,
    padding: 14,
    minHeight: 76,
  },
  playlistText: { flex: 1, marginLeft: 14 },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    marginTop: spacing.gap,
  },
  startText: { flex: 1 },
  switch: { transform: [{ scale: 1.3 }], marginRight: 6 },
  save: { marginTop: 18, minHeight: 66 },
  secondaryButton: { marginTop: spacing.gap },
});
