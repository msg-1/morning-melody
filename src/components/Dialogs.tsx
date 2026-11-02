import React, { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppText } from './AppText';
import { BigButton } from './Buttons';
import { colors, fonts, MIN_TOUCH, radius, spacing } from '../theme';

function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="height" style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Asks for a name, used for creating and renaming playlists. */
export function NamePrompt({
  visible,
  title,
  initial = '',
  confirmLabel,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  initial?: string;
  confirmLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (visible) setName(initial);
  }, [visible, initial]);
  const trimmed = name.trim();
  return (
    <Sheet visible={visible} onClose={onCancel}>
      <AppText variant="section" style={styles.title}>
        {title}
      </AppText>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={60}
        placeholder="For example, Morning songs"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onSubmit(trimmed)}
        accessibilityLabel="Playlist name"
        style={styles.input}
      />
      <BigButton
        label={confirmLabel}
        disabled={!trimmed}
        onPress={() => onSubmit(trimmed)}
      />
      <BigButton
        label="Cancel"
        tone="plain"
        onPress={onCancel}
        style={styles.cancel}
      />
    </Sheet>
  );
}

export interface Choice {
  key: number | string;
  title: string;
  detail?: string;
}

export function ChoiceSheet({
  visible,
  title,
  choices,
  footer,
  onClose,
  onChoose,
}: {
  visible: boolean;
  title: string;
  choices: Choice[];
  footer?: ReactNode;
  onClose: () => void;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="section" style={styles.title}>
        {title}
      </AppText>
      <ScrollView style={styles.choices}>
        {choices.map(choice => (
          <Pressable
            key={choice.key}
            accessibilityRole="button"
            android_ripple={{ color: 'rgba(38,53,45,0.12)' }}
            onPress={() => onChoose(choice)}
            style={styles.choice}>
            <AppText variant="cardTitle">{choice.title}</AppText>
            {choice.detail ? (
              <AppText variant="secondary">{choice.detail}</AppText>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {footer}
      <BigButton
        label="Cancel"
        tone="plain"
        onPress={onClose}
        style={styles.cancel}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32,39,34,0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: spacing.screen,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  title: { marginBottom: 14 },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 16,
    marginBottom: 14,
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.ink,
  },
  choices: { flexGrow: 0, marginBottom: 10 },
  choice: {
    minHeight: MIN_TOUCH + 12,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cancel: { marginTop: 10 },
});
