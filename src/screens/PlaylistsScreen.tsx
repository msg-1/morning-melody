import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, ToastAndroid, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../components/AppText';
import { ArtCircle } from '../components/ArtCircle';
import { BigButton } from '../components/Buttons';
import { NamePrompt } from '../components/Dialogs';
import { Icon, IconName } from '../components/Icon';
import { ScreenHeader, ScrollPage } from '../components/Screen';
import { createPlaylist, listPlaylists } from '../database';
import { useFocusData } from '../hooks/useFocusData';
import { colors, radius, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Playlist } from '../types';
import { formatPlaylistSummary } from '../utils/format';

const cardArt: { icon: IconName; tint: string }[] = [
  { icon: 'sun', tint: '#E7EBDD' },
  { icon: 'note', tint: '#F1E6D7' },
  { icon: 'music', tint: '#E2EAE5' },
];

const noPlaylists: Playlist[] = [];

export function PlaylistsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const load = useCallback(() => listPlaylists(), []);
  const { data: playlists } = useFocusData(load, noPlaylists);
  const [naming, setNaming] = useState(false);

  const create = async (name: string) => {
    setNaming(false);
    const id = await createPlaylist(name);
    ToastAndroid.show(`${name} created`, ToastAndroid.SHORT);
    navigation.navigate('PlaylistDetail', { playlistId: id });
  };

  return (
    <ScrollPage>
      <ScreenHeader title="Your playlists" subtitle="Your favourite collections" />
      <BigButton
        label="Create a playlist"
        icon="plus"
        onPress={() => setNaming(true)}
        style={styles.create}
      />

      {playlists.map((playlist, index) => {
        const art = cardArt[index % cardArt.length];
        return (
          <Pressable
            key={playlist.id}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('PlaylistDetail', { playlistId: playlist.id })
            }
            style={styles.card}>
            <ArtCircle size={58} icon={art.icon} tint={art.tint} />
            <View style={styles.cardText}>
              <AppText variant="cardTitle">{playlist.name}</AppText>
              <AppText variant="secondary">
                {formatPlaylistSummary(playlist.songCount, playlist.totalDurationMs)}
              </AppText>
            </View>
            <Icon name="chevronRight" size={32} color={colors.muted} />
          </Pressable>
        );
      })}

      <View style={styles.tip}>
        <AppText variant="cardTitle" style={styles.tipTitle}>
          A little morning ritual
        </AppText>
        <AppText variant="secondary">
          Choose a playlist for each alarm, or enjoy one whenever you like.
        </AppText>
      </View>

      <NamePrompt
        visible={naming}
        title="Name your playlist"
        confirmLabel="Create playlist"
        onCancel={() => setNaming(false)}
        onSubmit={create}
      />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  create: { marginTop: 6, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.card,
    minHeight: 92,
    marginBottom: spacing.gap,
  },
  cardText: { flex: 1, marginLeft: 14 },
  tip: {
    backgroundColor: colors.tipCard,
    borderRadius: radius.card,
    padding: 20,
    marginTop: 18,
  },
  tipTitle: { marginBottom: 8 },
});
