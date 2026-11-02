import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, tints } from '../theme';

/** Album artwork when the song has some, otherwise a tinted circle as in the designs. */
export function ArtCircle({
  size = 54,
  seed = 0,
  uri,
  icon = 'note',
  tint,
}: {
  size?: number;
  seed?: number;
  uri?: string | null;
  icon?: IconName;
  tint?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      style={[
        styles.circle,
        dimensions,
        { backgroundColor: tint ?? tints[seed % tints.length] },
      ]}>
      <Icon name={icon} size={size * 0.52} color={colors.sage} />
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, dimensions]}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
