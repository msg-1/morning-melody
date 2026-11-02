import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, MIN_TOUCH, radius } from '../theme';

type Tone = 'primary' | 'soft' | 'plain' | 'stop';

const tones: Record<Tone, { background: string; text: string; icon: string }> = {
  primary: { background: colors.sage, text: colors.onSage, icon: colors.onSage },
  soft: { background: colors.sageSoft, text: colors.ink, icon: colors.sage },
  plain: { background: colors.surface, text: colors.ink, icon: colors.sage },
  stop: { background: colors.stop, text: colors.stopText, icon: colors.stopText },
};

export function BigButton({
  label,
  icon,
  tone = 'primary',
  disabled,
  onPress,
  style,
}: {
  label: string;
  icon?: IconName;
  tone?: Tone;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: 'rgba(38,53,45,0.12)' }}
      style={[
        styles.button,
        { backgroundColor: palette.background, opacity: disabled ? 0.5 : 1 },
        style,
      ]}>
      {icon ? (
        <View style={styles.icon}>
          <Icon name={icon} size={26} color={palette.icon} />
        </View>
      ) : null}
      <AppText variant="button" color={palette.text} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** An icon with its word underneath, so nothing has to be guessed. */
export function LabelledIconButton({
  label,
  icon,
  active,
  onPress,
  color = colors.sage,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={active === undefined ? 'button' : 'togglebutton'}
      accessibilityState={active === undefined ? undefined : { checked: active }}
      style={[styles.labelled, active && styles.labelledActive]}>
      <Icon name={icon} size={28} color={active ? colors.onSage : color} />
      <AppText
        variant="secondary"
        color={active ? colors.onSage : colors.ink}
        numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  icon: { marginRight: 10 },
  label: { textAlign: 'center', flexShrink: 1 },
  labelled: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
  },
  labelledActive: { backgroundColor: colors.sage },
});
