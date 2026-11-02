import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { AppText } from '../components/AppText';
import { BigButton } from '../components/Buttons';
import { ChoiceSheet, NamePrompt } from '../components/Dialogs';
import { Icon } from '../components/Icon';
import { MiniPlayer } from '../components/MiniPlayer';
import { Page, ScreenHeader } from '../components/Screen';
import { RowIconButton, TrackRow } from '../components/TrackRow';
import {
  addTracksToPlaylist,
  createPlaylist,
  listPlaylists,
  listTracks,
} from '../database';
import { onPreviewEnded, player } from '../services/audio';
import {
  hasMusicPermission,
  pickMusicFiles,
  requestMusicPermission,
  scanMusic,
} from '../services/music-library';
import { colors, fonts, MIN_TOUCH, radius, spacing } from '../theme';
import type { RootStackParams } from '../navigation/types';
import type { Playlist, Track } from '../types';
import { formatPlaylistSummary } from '../utils/format';

const pluralSongs = (count: number) => (count === 1 ? '1 song' : `${count} songs`);

export function LibraryScreen() {
  const navigation = useNavigation();
  // Set when opened from a playlist's Add songs button rather than from the Library tab.
  const route = useRoute<RouteProp<RootStackParams, 'AddSongs'>>();
  const targetPlaylistId = route.params?.playlistId;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [naming, setNaming] = useState(false);

  const refresh = useCallback(async () => {
    setTracks(await listTracks(search));
  }, [search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const allowed = await hasMusicPermission();
        if (!active) return;
        setPermitted(allowed);
        if (allowed) await scanMusic();
        if (active) refresh();
      })();
      return () => {
        active = false;
        player.stopPreview();
        setPreviewing(null);
      };
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = onPreviewEnded(({ message }) => {
      setPreviewing(null);
      if (message) ToastAndroid.show(message, ToastAndroid.LONG);
    });
    return () => subscription.remove();
  }, []);

  const scanThisPhone = useCallback(async () => {
    const allowed = (await hasMusicPermission()) || (await requestMusicPermission());
    setPermitted(allowed);
    if (!allowed) {
      Alert.alert(
        'Music access is off',
        'You can still choose songs one by one, or allow music access on the setup page.',
      );
      return;
    }
    await scanMusic();
    const found = await listTracks();
    setSearch('');
    setTracks(found);
    ToastAndroid.show(`Found ${pluralSongs(found.length)} on this phone`, ToastAndroid.LONG);
  }, []);

  const chooseFiles = useCallback(async () => {
    const added = await pickMusicFiles();
    if (added > 0) {
      ToastAndroid.show(`Added ${pluralSongs(added)}`, ToastAndroid.LONG);
      refresh();
    }
  }, [refresh]);

  const findMusic = () =>
    Alert.alert('Find your music', 'How would you like to add songs?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose files', onPress: chooseFiles },
      { text: 'Scan this phone', onPress: scanThisPhone },
    ]);

  const toggle = useCallback((id: number) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePreview = useCallback(
    async (id: number) => {
      if (previewing === id) {
        player.stopPreview();
        setPreviewing(null);
        return;
      }
      setPreviewing(id);
      await player.preview([id]);
    },
    [previewing],
  );

  const addTo = async (playlistId: number, playlistName?: string) => {
    const ids = [...selected];
    const added = await addTracksToPlaylist(playlistId, ids);
    setSelected(new Set());
    setPlaylists(null);
    ToastAndroid.show(
      added > 0
        ? `Added ${pluralSongs(added)}${playlistName ? ` to ${playlistName}` : ''}`
        : 'Those songs are already in this playlist',
      ToastAndroid.LONG,
    );
    if (targetPlaylistId) navigation.goBack();
  };

  const addSelected = async () => {
    if (targetPlaylistId) {
      await addTo(targetPlaylistId);
      return;
    }
    const all = await listPlaylists();
    if (all.length === 0) setNaming(true);
    else setPlaylists(all);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => {
      const isSelected = selected.has(item.id);
      return (
        <TrackRow
          track={item}
          seed={index}
          selected={isSelected}
          onPress={() => toggle(item.id)}>
          <RowIconButton
            icon={previewing === item.id ? 'stop' : 'listen'}
            label={
              previewing === item.id
                ? `Stop listening to ${item.title}`
                : `Listen to ${item.title}`
            }
            onPress={() => togglePreview(item.id)}
          />
          <RowIconButton
            icon={isSelected ? 'check' : 'plus'}
            label={isSelected ? `Unselect ${item.title}` : `Select ${item.title}`}
            onPress={() => toggle(item.id)}
          />
        </TrackRow>
      );
    },
    [previewing, selected, toggle, togglePreview],
  );

  const header = useMemo(
    () => (
      <View>
        {permitted === false && tracks.length > 0 ? (
          <BigButton
            label="Music access is off. Tap to allow"
            tone="stop"
            icon="alert"
            onPress={scanThisPhone}
            style={styles.scan}
          />
        ) : null}
        <BigButton
          label="Scan or choose music files"
          icon="plus"
          tone="soft"
          onPress={findMusic}
          style={styles.scan}
        />
        <View style={styles.sectionRow}>
          <AppText variant="section">On this device</AppText>
          <AppText variant="secondary">{pluralSongs(tracks.length)}</AppText>
        </View>
      </View>
    ),
    // findMusic only closes over stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks.length, permitted, chooseFiles, scanThisPhone],
  );

  const empty =
    permitted === false ? (
      <View style={styles.empty}>
        <AppText variant="cardTitle" style={styles.emptyTitle}>
          Allow access to see your songs
        </AppText>
        <AppText variant="secondary" style={styles.emptyText}>
          Your music stays on this phone and is never sent anywhere.
        </AppText>
        <BigButton label="Allow music access" onPress={scanThisPhone} />
      </View>
    ) : (
      <View style={styles.empty}>
        <AppText variant="cardTitle" style={styles.emptyTitle}>
          {search ? 'No songs match your search' : 'No songs found yet'}
        </AppText>
        <AppText variant="secondary" style={styles.emptyText}>
          {search
            ? 'Try another word.'
            : 'Copy songs onto the phone, or choose them from a folder.'}
        </AppText>
      </View>
    );

  return (
    <Page bottomInset={!!targetPlaylistId}>
      <View style={styles.searchWrap}>
        <FlatList
          data={tracks}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          extraData={[selected, previewing]}
          ListHeaderComponent={
            <View>
              <ScreenHeader
                back={!!targetPlaylistId}
                title={targetPlaylistId ? 'Add songs' : 'Music library'}
                subtitle="Songs on this phone"
              />
              <View style={styles.searchBox}>
                <Icon name="search" size={26} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search songs on this device"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Search songs"
                  style={styles.searchInput}
                />
              </View>
              {header}
            </View>
          }
          ListEmptyComponent={empty}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        />
        {selected.size > 0 ? (
          <BigButton
            label={`Add selected songs  ·  ${selected.size}`}
            onPress={addSelected}
            style={styles.add}
          />
        ) : null}
      </View>
      {targetPlaylistId ? <MiniPlayer /> : null}

      <ChoiceSheet
        visible={playlists !== null}
        title="Add to which playlist?"
        choices={(playlists ?? []).map(playlist => ({
          key: playlist.id,
          title: playlist.name,
          detail: formatPlaylistSummary(playlist.songCount, playlist.totalDurationMs),
        }))}
        footer={
          <BigButton
            label="Create a playlist"
            icon="plus"
            tone="soft"
            onPress={() => {
              setPlaylists(null);
              setNaming(true);
            }}
          />
        }
        onClose={() => setPlaylists(null)}
        onChoose={choice => addTo(Number(choice.key), choice.title)}
      />
      <NamePrompt
        visible={naming}
        title="Name your playlist"
        confirmLabel="Create and add songs"
        onCancel={() => setNaming(false)}
        onSubmit={async name => {
          setNaming(false);
          await addTo(await createPlaylist(name), name);
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flex: 1 },
  list: { paddingHorizontal: spacing.screen, paddingBottom: 24 },
  scan: { marginTop: 10 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    backgroundColor: colors.surface,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
  },
  empty: { paddingVertical: 28 },
  emptyTitle: { textAlign: 'center', marginBottom: 6 },
  emptyText: { textAlign: 'center', marginBottom: 18 },
  add: { marginHorizontal: spacing.screen, marginVertical: 10 },
});
