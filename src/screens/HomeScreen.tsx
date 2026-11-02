import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../components/AppText';
import { ArtCircle } from '../components/ArtCircle';
import { BigButton } from '../components/Buttons';
import { Icon, IconName } from '../components/Icon';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { getSetting, listPlaylists } from '../database';
import { useFocusData } from '../hooks/useFocusData';
import { getSetupStatus, listAlarms, setAlarmEnabled } from '../services/alarms';
import { colors, fonts, radius, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Alarm, Playlist, SetupStatus } from '../types';
import {
  formatClock,
  formatPlaylistSummary,
  formatRepeatDays,
  greetingFor,
} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** The next alarm to ring, or an off one to switch back on when nothing is on. */
function chooseAlarm(alarms: Alarm[]) {
  const enabled = alarms
    .filter(alarm => alarm.enabled && alarm.nextTriggerAt)
    .sort((a, b) => a.nextTriggerAt! - b.nextTriggerAt!);
  return enabled[0] ?? alarms[0] ?? null;
}

export const setupNeedsAttention = (status: SetupStatus) =>
  !status.music ||
  !status.notifications ||
  !status.exactAlarms ||
  !status.battery ||
  !status.fullScreen;

const loadHome = async () => {
  const [alarms, playlists, setup] = await Promise.all([
    listAlarms(),
    listPlaylists(),
    getSetupStatus(),
  ]);
  return {
    alarm: chooseAlarm(alarms),
    playlists,
    setupIssue: setupNeedsAttention(setup),
  };
};

const emptyHome = {
  alarm: null as Alarm | null,
  playlists: [] as Playlist[],
  setupIssue: false,
};

function QuickAction({
  icon,
  label,
  soft,
  onPress,
}: {
  icon: IconName;
  label: string;
  soft?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.quick, soft && styles.quickSoft]}>
      <Icon name={icon} size={32} />
      <AppText variant="cardTitle" style={styles.quickLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { data, reload } = useFocusData(loadHome, emptyHome);
  const { alarm, playlists, setupIssue } = data;

  useEffect(() => {
    getSetting('setupSeen').then(seen => {
      if (!seen) navigation.navigate('Setup');
    });
  }, [navigation]);

  const toggle = useCallback(async () => {
    if (!alarm) return;
    await setAlarmEnabled(alarm.id, !alarm.enabled);
    reload();
  }, [alarm, reload]);

  const featured =
    playlists.find(playlist => playlist.id === alarm?.playlistId) ??
    playlists[0];
  const clock = alarm ? formatClock(alarm.hour, alarm.minute) : null;
  const playlistName = alarm
    ? playlists.find(playlist => playlist.id === alarm.playlistId)?.name
    : null;

  return (
    <ScrollPage>
      <ScreenHeader
        title={greetingFor(new Date().getHours())}
        subtitle="A calmer start to every day"
      />

      {setupIssue ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Setup')}
          style={styles.warning}>
          <Icon name="alert" size={28} color={colors.stopText} />
          <AppText variant="cardTitle" color={colors.stopText} style={styles.warningText}>
            Your alarm may not ring. Tap to fix this.
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <AppText variant="label" color={colors.onSageLabel}>
            YOUR NEXT ALARM
          </AppText>
          {alarm ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: alarm.enabled }}
              accessibilityLabel="Alarm on or off"
              onPress={toggle}
              hitSlop={12}
              style={styles.pill}>
              <AppText variant="button" color={colors.onSage} style={styles.pillText}>
                {alarm.enabled ? 'ON' : 'OFF'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {clock && alarm ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Alarm at ${clock.time} ${clock.period}. Tap to change`}
            onPress={() =>
              navigation.navigate('AlarmSetup', { alarmId: alarm.id })
            }>
            <View style={styles.timeRow}>
              <AppText color={colors.onSage} style={styles.time}>
                {clock.time}
              </AppText>
              <AppText color={colors.onSageSoft} style={styles.period}>
                {clock.period}
              </AppText>
            </View>
            <AppText variant="body" color={colors.onSageSoft}>
              {formatRepeatDays(alarm.repeatDays)}
              {playlistName ? `  ·  ${playlistName}` : ''}
            </AppText>
          </Pressable>
        ) : (
          <View>
            <AppText variant="section" color={colors.onSage} style={styles.noAlarm}>
              No alarm yet
            </AppText>
            <BigButton
              label="Set an alarm"
              tone="soft"
              onPress={() => navigation.navigate('AlarmSetup')}
            />
          </View>
        )}
      </View>

      <AppText variant="section" style={styles.section}>
        Your morning playlist
      </AppText>
      {featured ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('PlaylistDetail', { playlistId: featured.id })
          }
          style={styles.playlist}>
          <ArtCircle size={58} icon="music" tint="#DDE6D5" />
          <View style={styles.playlistText}>
            <AppText variant="cardTitle">{featured.name}</AppText>
            <AppText variant="secondary">
              {formatPlaylistSummary(featured.songCount, featured.totalDurationMs)}
            </AppText>
          </View>
          <Icon name="chevronRight" size={32} color={colors.muted} />
        </Pressable>
      ) : (
        <BigButton
          label="Create your first playlist"
          tone="plain"
          icon="plus"
          onPress={() => navigation.navigate('Tabs', { screen: 'Playlists' })}
        />
      )}

      <AppText variant="section" style={styles.section}>
        Quick actions
      </AppText>
      <View style={styles.quickRow}>
        <QuickAction
          icon="plus"
          label="Add songs"
          soft
          onPress={() => navigation.navigate('Tabs', { screen: 'Library' })}
        />
        <QuickAction
          icon="clock"
          label="Manage alarms"
          onPress={() => navigation.navigate('Tabs', { screen: 'Alarms' })}
        />
      </View>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stop,
    borderRadius: radius.button,
    padding: 16,
    marginBottom: spacing.gap,
  },
  warningText: { flex: 1, marginLeft: 12 },
  hero: {
    backgroundColor: colors.sage,
    borderRadius: radius.hero,
    padding: 22,
    marginTop: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  pill: {
    backgroundColor: colors.sagePill,
    borderRadius: 20,
    minWidth: 68,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  pillText: { fontSize: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  time: { fontFamily: fonts.bold, fontSize: 60, lineHeight: 72 },
  period: { fontFamily: fonts.semibold, fontSize: 20, marginLeft: 10 },
  noAlarm: { marginTop: 12, marginBottom: 14 },
  section: { marginTop: 26, marginBottom: 12 },
  playlist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.card,
    minHeight: 88,
  },
  playlistText: { flex: 1, marginLeft: 14 },
  quickRow: { flexDirection: 'row', gap: spacing.gap },
  quick: {
    flex: 1,
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    padding: 18,
    justifyContent: 'space-between',
  },
  quickSoft: { backgroundColor: colors.sageSoft },
  quickLabel: { marginTop: 10 },
});
