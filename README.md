# Morning Melody

An Android alarm app that wakes you with songs already on your phone. No account, no server, and release builds have no internet permission at all.

## Build and run

Needs Node 22+, JDK 17 and the Android SDK (platform 37, NDK 27.1).

```sh
npm install

# Development build, needs Metro running
npm start
npm run android

# Installable APK, no computer needed afterwards
cd android && ./gradlew :app:assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the debug key, which is fine for installing on your own phones. Publishing to the Play Store would need a real signing key, and a Play policy declaration for `USE_EXACT_ALARM` and `USE_FULL_SCREEN_INTENT`.

## Architecture

```
AlarmManager.setAlarmClock
   └─ AlarmReceiver             re-arms the next occurrence first, then starts:
       └─ PlaybackService       foreground service + Media3 ExoPlayer + MediaSession
           ├─ notification, lock screen, headset   ─┐
           ├─ AlarmActivity (over the lock screen)  ├─ all drive one shared player
           └─ React Native UI via MediaController  ─┘
```

| Decision | Why |
| --- | --- |
| Bare React Native, not Expo | The core of the app is custom Kotlin. |
| Nothing in the alarm path uses JavaScript | An alarm must work when the React runtime has never started. |
| SQLite is owned by Kotlin (`db/MelodyDatabase.kt`), and `src/database` is a typed bridge to it | Boot and alarm receivers must read it with no JS running. Only one engine ever writes the file. |
| `setAlarmClock` | The strongest scheduling API: exact, fires through Doze, and allows starting a foreground service from the background. |
| `USAGE_ALARM` audio | Rings through silent mode, with its own volume. The user's level is restored afterwards. |
| `startForeground` is called before loading anything | A missing song can never crash an alarm by missing Android's 5 second deadline. |
| Up and down arrows instead of drag to reorder | Much easier for the people this app is for. |

`android/.../alarms`, `playback`, `music` and `db` hold the native logic, and `bridge` exposes it to JS. `src/` holds the screens, components, navigation, typed services and hooks.

### Design differences from the Penpot files

- Text and touch targets are larger, because the design's 9 to 12px labels are too small for elderly users.
- The muted text colour is `#5A665C` rather than `#7D887E`, which only reached 3.3:1 contrast on the cream background.
- Text glyph icons such as ◷ and ▤ are redrawn as vectors, because many Android fonts cannot draw them.
- Added screens the design did not cover: alarm list, playlist detail, setup checklist.

## Android limitations

These are platform limits, not bugs. Automatic playback cannot be guaranteed on every phone.

- **Force stop** cancels all alarms until the app is next opened. On some phones (Xiaomi, Oppo, Vivo, OnePlus, Huawei and others) swiping the app from recents behaves like a force stop, so the setup page links to their autostart screen where one can be found.
- **After a restart** the phone must be unlocked once. Before that, Android keeps app data and music encrypted, and an alarm cannot read them.
- **Notifications denied:** music still plays, but the screen stays dark and there is no Stop button on the lock screen. The Home banner warns about this.
- **Music permission denied:** alarms play a chime, and songs chosen in the file picker keep working.
- **Do Not Disturb** set to total silence blocks alarm sound, as it does for every alarm app.
- **A phone call** takes audio focus, so the music pauses during the call.
- **The phone must be powered on.** Alarms cannot power on a switched-off phone.

## Testing

```sh
npx jest                                  # JS formatting logic
cd android && ./gradlew :app:testDebugUnitTest   # next-ring-time logic, incl. daylight saving and timezones
```

The Alarm Setup screen's **Test in 1 minute** button sends a real alarm through the whole native path. Use it on the actual phone, locked, after setup.

Everything below was run on an Android 15 emulator. **None of it has been run on a physical phone yet**, and manufacturer battery restrictions cannot be reproduced on an emulator.

| Scenario | Emulator result |
| --- | --- |
| Screen locked, app process dead | Rang on time, screen woke, alarm page over lock screen |
| Doze, battery optimised, on battery | Rang on time. Android would not enter deep idle with an alarm clock 1 minute away, and left deep idle when the clock jumped towards the alarm, so it never had to fire from inside deep idle |
| Swiped from recents | Music kept playing |
| Reboot | Alarm re-armed without opening the app, then rang |
| Force stop, then reopen | Alarms cancelled, then re-armed on opening |
| Time change, timezone change | Re-armed, keeps wall-clock time |
| Alarm off and on, several alarms, one-time alarm | Correct |
| One song missing / all songs missing | Skipped / chime played |
| Music permission denied | Chime played, app prompts to allow access |
| Notification and media-session controls | In sync with the app |
| Killed in background, then reopened | Reopens correctly (fixed a crash found here) |

Not yet tested: a real phone, phone calls, and manufacturer battery managers. Test checklist for a real phone:

1. Finish the setup page until everything has a tick.
2. Create a playlist from real songs and set an alarm.
3. Press **Test in 1 minute**, lock the phone and leave it alone.
4. Repeat with the app swiped from recents.
5. Restart the phone, unlock it once, and test again.
6. Most importantly, leave it overnight on battery and see whether a real alarm rings.
