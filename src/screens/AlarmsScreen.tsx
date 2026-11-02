import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Switch, ToastAndroid, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../components/AppText';
import { BigButton } from '../components/Buttons';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { listPlaylists } from '../database';
import { useFocusData } from '../hooks/useFocusData';
import { listAlarms, setAlarmEnabled } from '../services/alarms';
import { colors, fonts, radius, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Alarm, Playlist } from '../types';
import {
  describeRingTime,
  formatClock,
  formatRepeatDays,
} from '../utils/format';

const loadAlarms = async () => {
  const [alarms, playlists] = await Promise.all([listAlarms(), listPlaylists()]);
  return { alarms, playlists };
};

const empty = { alarms: [] as Alarm[], playlists: [] as Playlist[] };

export function AlarmsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { data, reload } = useFocusData(loadAlarms, empty);

  const toggle = useCallback(
    async (alarm: Alarm, enabled: boolean) => {
      const updated = await setAlarmEnabled(alarm.id, enabled);
      ToastAndroid.show(
        enabled && updated.nextTriggerAt
          ? `Alarm on for ${describeRingTime(updated.nextTriggerAt)}`
          : 'Alarm off',
        ToastAndroid.LONG,
      );
      reload();
    },
    [reload],
  );

  return (
    <ScrollPage>
      <ScreenHeader title="Your alarms" subtitle="Wake up to your own music" />
      <BigButton
        label="Create alarm"
        icon="plus"
        onPress={() => navigation.navigate('AlarmSetup')}
        style={styles.create}
      />
      {data.alarms.length === 0 ? (
        <AppText variant="secondary" style={styles.empty}>
          No alarms yet. Tap Create alarm to set your first one.
        </AppText>
      ) : null}
      {data.alarms.map(alarm => {
        const { time, period } = formatClock(alarm.hour, alarm.minute);
        const playlist = data.playlists.find(p => p.id === alarm.playlistId);
        return (
          <View key={alarm.id} style={styles.card}>
            <Pressable
              style={styles.main}
              accessibilityRole="button"
              accessibilityLabel={`Alarm at ${time} ${period}, ${formatRepeatDays(alarm.repeatDays)}. Tap to change`}
              onPress={() =>
                navigation.navigate('AlarmSetup', { alarmId: alarm.id })
              }>
              <View style={styles.timeRow}>
                <AppText
                  style={styles.time}
                  color={alarm.enabled ? colors.sage : colors.muted}>
                  {time}
                </AppText>
                <AppText style={styles.period} color={colors.muted}>
                  {period}
                </AppText>
              </View>
              <AppText variant="body">{formatRepeatDays(alarm.repeatDays)}</AppText>
              <AppText variant="secondary" numberOfLines={1}>
                {playlist?.name ?? 'No playlist chosen, a chime will play'}
              </AppText>
            </Pressable>
            <Switch
              value={alarm.enabled}
              onValueChange={value => toggle(alarm, value)}
              accessibilityLabel={`Alarm at ${time} ${period} on or off`}
              trackColor={{ true: colors.sagePill, false: colors.sageTrack }}
              thumbColor={alarm.enabled ? colors.sage : colors.surface}
              style={styles.switch}
            />
          </View>
        );
      })}
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  create: { marginTop: 6, marginBottom: 20 },
  empty: { textAlign: 'center', marginTop: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.card,
    marginBottom: spacing.gap,
  },
  main: { flex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline' },
  time: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 50 },
  period: { fontFamily: fonts.bold, fontSize: 17, marginLeft: 8 },
  switch: { transform: [{ scale: 1.3 }], marginLeft: 12 },
});
