import React, { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, MIN_TOUCH, spacing } from '../theme';

export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const navigation = useNavigation();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}>
          <Icon name="chevronLeft" size={32} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText variant="subtitle">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

/** A plain page background that respects the status bar and navigation bar. */
export function Page({
  children,
  bottomInset,
}: {
  children: ReactNode;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.page,
        {
          paddingTop: insets.top + 8,
          paddingBottom: bottomInset ? insets.bottom : 0,
        },
      ]}>
      {children}
    </View>
  );
}

export function ScrollPage({
  children,
  bottomInset,
  footer,
}: {
  children: ReactNode;
  bottomInset?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Page bottomInset={bottomInset}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screen, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: MIN_TOUCH,
  },
  headerText: { flex: 1 },
  back: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
