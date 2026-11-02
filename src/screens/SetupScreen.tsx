import React, { useCallback, useEffect } from 'react';
import {
  AppState,
  PermissionsAndroid,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../components/AppText';
import { BigButton } from '../components/Buttons';
import { Icon } from '../components/Icon';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { setSetting } from '../database';
import { useFocusData } from '../hooks/useFocusData';
import { getSetupStatus, openSetting } from '../services/alarms';
import {
  requestMusicPermission,
  scanMusic,
} from '../services/music-library';
import { colors, radius, spacing } from '../theme';
import type { SetupStatus } from '../types';

const initialStatus: SetupStatus = {
  music: true,
  notifications: true,
  exactAlarms: true,
  battery: true,
  fullScreen: true,
  hasAutostartPage: false,
  manufacturer: '',
};

function Step({
  done,
  title,
  why,
  action,
  onPress,
}: {
  done: boolean;
  title: string;
  why: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <Icon
          name={done ? 'check' : 'alert'}
          size={28}
          color={done ? colors.sage : colors.stopText}
        />
        <AppText variant="cardTitle" style={styles.stepTitle}>
          {title}
        </AppText>
      </View>
      {done ? null : (
        <>
          <AppText variant="secondary" style={styles.why}>
            {why}
          </AppText>
          <BigButton label={action} onPress={onPress} />
        </>
      )}
    </View>
  );
}

/**
 * Android and phone makers can stop an alarm app in several separate ways. This page turns each one
 * into a single button, and comes back to the list when the system settings page is closed.
 */
export function SetupScreen() {
  const navigation = useNavigation();
  const { data: status, reload } = useFocusData(getSetupStatus, initialStatus);

  useEffect(() => {
    setSetting('setupSeen', '1');
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [reload]);

  const allowMusic = useCallback(async () => {
    if (await requestMusicPermission()) await scanMusic();
    else await openSetting('app');
    reload();
  }, [reload]);

  const allowNotifications = useCallback(async () => {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      await openSetting('notifications');
    }
    reload();
  }, [reload]);

  return (
    <ScrollPage bottomInset>
      <ScreenHeader
        back
        title="Get your alarm ready"
        subtitle="A few things the phone needs you to allow"
      />
      <Step
        done={status.music}
        title="See the songs on this phone"
        why="So you can choose your music. Your songs stay on this phone and are never sent anywhere."
        action="Allow music"
        onPress={allowMusic}
      />
      <Step
        done={status.notifications}
        title="Light up the screen with a Stop button"
        why="Without this your music still plays, but the screen stays dark and there is no Stop button on the lock screen."
        action="Allow notifications"
        onPress={allowNotifications}
      />
      <Step
        done={status.exactAlarms}
        title="Ring exactly on time"
        why="Without this, the phone may start your alarm late."
        action="Allow alarms"
        onPress={() => openSetting('exactAlarms')}
      />
      <Step
        done={status.fullScreen}
        title="Light up the screen"
        why="So the alarm appears on the screen when the phone is locked."
        action="Allow full screen"
        onPress={() => openSetting('fullScreen')}
      />
      <Step
        done={status.battery}
        title="Keep working while the phone rests"
        why="Battery saving can put the app to sleep and stop your alarm."
        action="Allow in background"
        onPress={() => openSetting('battery')}
      />

      {status.hasAutostartPage ? (
        <View style={styles.step}>
          <AppText variant="cardTitle">One more step on this phone</AppText>
          <AppText variant="secondary" style={styles.why}>
            {status.manufacturer} phones have their own switch for this. Find
            Morning Melody on the next page and turn it on. The app cannot see
            this switch, so this step never shows a tick.
          </AppText>
          <BigButton
            label="Open autostart page"
            tone="soft"
            onPress={() => openSetting('autostart')}
          />
        </View>
      ) : null}

      <View style={styles.tip}>
        <AppText variant="cardTitle">Please do not force stop</AppText>
        <AppText variant="secondary" style={styles.tipText}>
          If the phone is restarted, unlock it once so the alarm can use your
          songs. And if someone uses Force stop in the phone's settings, alarms
          stay off until Morning Melody is opened again.
        </AppText>
      </View>

      <BigButton
        label="Done"
        onPress={navigation.goBack}
        style={styles.done}
      />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  step: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.card,
    marginTop: spacing.gap,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center' },
  stepTitle: { flex: 1, marginLeft: 12 },
  why: { marginTop: 8, marginBottom: 14 },
  tip: {
    backgroundColor: colors.tipCard,
    borderRadius: radius.card,
    padding: 20,
    marginTop: spacing.gap,
  },
  tipText: { marginTop: 8 },
  done: { marginTop: 20 },
});
