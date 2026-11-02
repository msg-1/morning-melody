import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fonts } from '../theme';

const variants = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.muted },
  section: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28, color: colors.ink },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink },
  secondary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, color: colors.muted },
  button: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.ink },
});

interface Props extends TextProps {
  variant?: keyof typeof variants;
  color?: string;
}

// Follows the phone's text size setting, capped where a layout would otherwise fall apart.
export function AppText({ variant = 'body', color, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.5}
      style={[variants[variant], color ? { color } : null, style]}
      {...rest}
    />
  );
}
