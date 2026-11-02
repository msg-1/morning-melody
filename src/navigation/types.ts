export type TabParams = {
  Home: undefined;
  Library: undefined;
  Playlists: undefined;
  Alarms: undefined;
};

export type RootStackParams = {
  Tabs: { screen?: keyof TabParams } | undefined;
  AddSongs: { playlistId: number };
  PlaylistDetail: { playlistId: number };
  AlarmSetup: { alarmId?: number } | undefined;
  NowPlaying: undefined;
  Setup: undefined;
};
