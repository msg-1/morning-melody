package com.morningmelody.db

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class Track(
  val id: Long,
  val title: String,
  val artist: String?,
  val album: String?,
  val durationMs: Long,
  val localUri: String,
  val artworkUri: String?,
  val available: Boolean,
)

data class Playlist(
  val id: Long,
  val name: String,
  val createdAt: Long,
  val shuffle: Boolean,
  val repeat: Boolean,
  val resumeTrackId: Long?,
  val resumePositionMs: Long,
  val songCount: Int,
  val totalDurationMs: Long,
)

data class Alarm(
  val id: Long,
  val hour: Int,
  val minute: Int,
  val enabled: Boolean,
  val repeatDays: Int,
  val playlistId: Long?,
  val volume: Int,
  val startFromBeginning: Boolean,
  val createdAt: Long,
  val nextTriggerAt: Long?,
)

data class ScannedTrack(
  val mediaKey: String,
  val title: String,
  val artist: String?,
  val album: String?,
  val durationMs: Long,
  val localUri: String,
  val artworkUri: String?,
)

data class SavedPlayback(
  val playlistId: Long,
  val trackId: Long,
  val positionMs: Long,
)

/**
 * The one SQLite database of the app. It lives on the native side because the alarm receiver, boot
 * receiver and playback service must read it when no JavaScript is running.
 */
class MelodyDatabase private constructor(context: Context) :
  SQLiteOpenHelper(context, "morning_melody.db", null, 1) {

  override fun onConfigure(db: SQLiteDatabase) {
    db.setForeignKeyConstraintsEnabled(true)
    db.enableWriteAheadLogging()
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """CREATE TABLE track (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        local_uri TEXT NOT NULL UNIQUE,
        artwork_uri TEXT,
        media_key TEXT UNIQUE,
        source TEXT NOT NULL DEFAULT 'mediastore',
        available INTEGER NOT NULL DEFAULT 1
      )""")
    db.execSQL(
      """CREATE TABLE playlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        shuffle INTEGER NOT NULL DEFAULT 0,
        repeat INTEGER NOT NULL DEFAULT 0,
        resume_track_id INTEGER REFERENCES track(id) ON DELETE SET NULL,
        resume_position_ms INTEGER NOT NULL DEFAULT 0
      )""")
    db.execSQL(
      """CREATE TABLE playlist_track (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
        track_id INTEGER NOT NULL REFERENCES track(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        UNIQUE (playlist_id, track_id)
      )""")
    db.execSQL("CREATE INDEX idx_playlist_track_position ON playlist_track(playlist_id, position)")
    db.execSQL(
      """CREATE TABLE alarm (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        repeat_days INTEGER NOT NULL DEFAULT 0,
        playlist_id INTEGER REFERENCES playlist(id) ON DELETE SET NULL,
        volume INTEGER NOT NULL DEFAULT 70,
        start_from_beginning INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        next_trigger_at INTEGER
      )""")
    db.execSQL(
      """CREATE TABLE playback_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        playlist_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        position_ms INTEGER NOT NULL
      )""")
    db.execSQL("CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  // Tracks

  fun listTracks(search: String?): List<Track> {
    val query = search?.trim().orEmpty()
    val args = if (query.isEmpty()) emptyArray() else Array(3) { "%$query%" }
    val filter = if (query.isEmpty()) "" else "AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)"
    return readableDatabase
      .rawQuery("SELECT * FROM track WHERE available = 1 $filter ORDER BY title COLLATE NOCASE", args)
      .use { c -> c.mapAll(::readTrack) }
  }

  fun getTrack(id: Long): Track? =
    readableDatabase.rawQuery("SELECT * FROM track WHERE id = ?", arrayOf(id.toString())).use { c ->
      if (c.moveToFirst()) readTrack(c) else null
    }

  /**
   * Applies a full device scan. Tracks are matched on their file path first so that playlists keep
   * working when Android hands the same file a new MediaStore id. Anything not seen is only flagged
   * as unavailable, never deleted, because an SD card may simply be out of the phone.
   */
  fun applyScan(scanned: List<ScannedTrack>) {
    val db = writableDatabase
    db.transaction {
      execSQL("UPDATE track SET available = 0 WHERE source = 'mediastore'")
      for (track in scanned) {
        val values =
          ContentValues().apply {
            put("title", track.title)
            put("artist", track.artist)
            put("album", track.album)
            put("duration_ms", track.durationMs)
            put("local_uri", track.localUri)
            put("artwork_uri", track.artworkUri)
            put("media_key", track.mediaKey)
            put("source", "mediastore")
            put("available", 1)
          }
        val updated =
          updateWithOnConflict(
            "track", values, "media_key = ?", arrayOf(track.mediaKey), SQLiteDatabase.CONFLICT_IGNORE)
        if (updated > 0) continue
        val moved =
          updateWithOnConflict(
            "track", values, "local_uri = ?", arrayOf(track.localUri), SQLiteDatabase.CONFLICT_IGNORE)
        if (moved > 0) continue
        insertWithOnConflict("track", null, values, SQLiteDatabase.CONFLICT_IGNORE)
      }
    }
  }

  fun addPickedTrack(
    title: String,
    artist: String?,
    album: String?,
    durationMs: Long,
    localUri: String,
  ): Long {
    val values =
      ContentValues().apply {
        put("title", title)
        put("artist", artist)
        put("album", album)
        put("duration_ms", durationMs)
        put("local_uri", localUri)
        put("source", "picked")
        put("available", 1)
      }
    val db = writableDatabase
    val id = db.insertWithOnConflict("track", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    if (id != -1L) return id
    db.update("track", values, "local_uri = ?", arrayOf(localUri))
    return db.rawQuery("SELECT id FROM track WHERE local_uri = ?", arrayOf(localUri)).use { c ->
      c.moveToFirst()
      c.getLong(0)
    }
  }

  fun hasSong(title: String, durationMs: Long): Boolean =
    readableDatabase
      .rawQuery(
        "SELECT 1 FROM track WHERE available = 1 AND title = ? AND ABS(duration_ms - ?) < 1500",
        arrayOf(title, durationMs.toString()))
      .use { c -> c.moveToFirst() }

  fun setTrackAvailable(id: Long, available: Boolean) {
    val values = ContentValues().apply { put("available", if (available) 1 else 0) }
    writableDatabase.update("track", values, "id = ?", arrayOf(id.toString()))
  }

  fun pickedTracks(): List<Track> =
    readableDatabase.rawQuery("SELECT * FROM track WHERE source = 'picked'", emptyArray()).use { c ->
      c.mapAll(::readTrack)
    }

  // Playlists

  fun listPlaylists(): List<Playlist> =
    readableDatabase.rawQuery("$PLAYLIST_SELECT GROUP BY p.id ORDER BY p.created_at", emptyArray()).use {
      c ->
      c.mapAll(::readPlaylist)
    }

  fun getPlaylist(id: Long): Playlist? =
    readableDatabase
      .rawQuery("$PLAYLIST_SELECT WHERE p.id = ? GROUP BY p.id", arrayOf(id.toString()))
      .use { c -> if (c.moveToFirst()) readPlaylist(c) else null }

  fun createPlaylist(name: String): Long {
    val values =
      ContentValues().apply {
        put("name", name)
        put("created_at", System.currentTimeMillis())
      }
    return writableDatabase.insertOrThrow("playlist", null, values)
  }

  fun renamePlaylist(id: Long, name: String) {
    val values = ContentValues().apply { put("name", name) }
    writableDatabase.update("playlist", values, "id = ?", arrayOf(id.toString()))
  }

  fun deletePlaylist(id: Long) {
    writableDatabase.delete("playlist", "id = ?", arrayOf(id.toString()))
  }

  fun setPlaylistOptions(id: Long, shuffle: Boolean, repeat: Boolean) {
    val values =
      ContentValues().apply {
        put("shuffle", if (shuffle) 1 else 0)
        put("repeat", if (repeat) 1 else 0)
      }
    writableDatabase.update("playlist", values, "id = ?", arrayOf(id.toString()))
  }

  fun playlistTracks(playlistId: Long): List<Track> =
    readableDatabase
      .rawQuery(
        """SELECT t.* FROM playlist_track pt JOIN track t ON t.id = pt.track_id
           WHERE pt.playlist_id = ? ORDER BY pt.position""",
        arrayOf(playlistId.toString()))
      .use { c -> c.mapAll(::readTrack) }

  /** Songs already in the playlist are left where they are. Returns how many were really added. */
  fun addTracksToPlaylist(playlistId: Long, trackIds: List<Long>): Int {
    var added = 0
    writableDatabase.transaction {
      var position =
        rawQuery(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_track WHERE playlist_id = ?",
            arrayOf(playlistId.toString()))
          .use { c ->
            c.moveToFirst()
            c.getInt(0)
          }
      for (trackId in trackIds) {
        val values =
          ContentValues().apply {
            put("playlist_id", playlistId)
            put("track_id", trackId)
            put("position", position)
          }
        if (insertWithOnConflict("playlist_track", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L) {
          position++
          added++
        }
      }
    }
    return added
  }

  fun removeTrackFromPlaylist(playlistId: Long, trackId: Long) {
    writableDatabase.transaction {
      delete(
        "playlist_track",
        "playlist_id = ? AND track_id = ?",
        arrayOf(playlistId.toString(), trackId.toString()))
    }
  }

  /** Swaps a song with its neighbour; [delta] is -1 for up and +1 for down. */
  fun moveTrackInPlaylist(playlistId: Long, trackId: Long, delta: Int) {
    writableDatabase.transaction {
      val order =
        rawQuery(
            "SELECT track_id FROM playlist_track WHERE playlist_id = ? ORDER BY position",
            arrayOf(playlistId.toString()))
          .use { c -> c.mapAll { it.getLong(0) } }
          .toMutableList()
      val from = order.indexOf(trackId)
      val to = from + delta
      if (from < 0 || to !in order.indices) return@transaction
      order[from] = order[to].also { order[to] = order[from] }
      order.forEachIndexed { index, id ->
        val values = ContentValues().apply { put("position", index) }
        update(
          "playlist_track",
          values,
          "playlist_id = ? AND track_id = ?",
          arrayOf(playlistId.toString(), id.toString()))
      }
    }
  }

  // Alarms

  fun listAlarms(): List<Alarm> =
    readableDatabase.rawQuery("SELECT * FROM alarm ORDER BY hour, minute", emptyArray()).use { c ->
      c.mapAll(::readAlarm)
    }

  fun getAlarm(id: Long): Alarm? =
    readableDatabase.rawQuery("SELECT * FROM alarm WHERE id = ?", arrayOf(id.toString())).use { c ->
      if (c.moveToFirst()) readAlarm(c) else null
    }

  fun saveAlarm(alarm: Alarm): Long {
    val values =
      ContentValues().apply {
        put("hour", alarm.hour)
        put("minute", alarm.minute)
        put("enabled", if (alarm.enabled) 1 else 0)
        put("repeat_days", alarm.repeatDays)
        put("playlist_id", alarm.playlistId)
        put("volume", alarm.volume)
        put("start_from_beginning", if (alarm.startFromBeginning) 1 else 0)
      }
    val db = writableDatabase
    if (alarm.id > 0) {
      db.update("alarm", values, "id = ?", arrayOf(alarm.id.toString()))
      return alarm.id
    }
    values.put("created_at", System.currentTimeMillis())
    return db.insertOrThrow("alarm", null, values)
  }

  fun setAlarmEnabled(id: Long, enabled: Boolean) {
    val values = ContentValues().apply { put("enabled", if (enabled) 1 else 0) }
    writableDatabase.update("alarm", values, "id = ?", arrayOf(id.toString()))
  }

  fun setAlarmNextTrigger(id: Long, triggerAt: Long?) {
    val values = ContentValues().apply { put("next_trigger_at", triggerAt) }
    writableDatabase.update("alarm", values, "id = ?", arrayOf(id.toString()))
  }

  fun deleteAlarm(id: Long) {
    writableDatabase.delete("alarm", "id = ?", arrayOf(id.toString()))
  }

  // Playback state

  fun savePlayback(state: SavedPlayback) {
    writableDatabase.transaction {
      val values =
        ContentValues().apply {
          put("id", 1)
          put("playlist_id", state.playlistId)
          put("track_id", state.trackId)
          put("position_ms", state.positionMs)
        }
      insertWithOnConflict("playback_state", null, values, SQLiteDatabase.CONFLICT_REPLACE)
      val resume =
        ContentValues().apply {
          put("resume_track_id", state.trackId)
          put("resume_position_ms", state.positionMs)
        }
      update("playlist", resume, "id = ?", arrayOf(state.playlistId.toString()))
    }
  }

  fun loadPlayback(): SavedPlayback? =
    readableDatabase
      .rawQuery("SELECT playlist_id, track_id, position_ms FROM playback_state", emptyArray())
      .use { c ->
        if (c.moveToFirst()) SavedPlayback(c.getLong(0), c.getLong(1), c.getLong(2)) else null
      }

  // Settings

  fun getSetting(key: String): String? =
    readableDatabase.rawQuery("SELECT value FROM setting WHERE key = ?", arrayOf(key)).use { c ->
      if (c.moveToFirst()) c.getString(0) else null
    }

  fun setSetting(key: String, value: String) {
    val values =
      ContentValues().apply {
        put("key", key)
        put("value", value)
      }
    writableDatabase.insertWithOnConflict("setting", null, values, SQLiteDatabase.CONFLICT_REPLACE)
  }

  private fun readTrack(c: Cursor) =
    Track(
      id = c.long("id"),
      title = c.string("title").orEmpty(),
      artist = c.string("artist"),
      album = c.string("album"),
      durationMs = c.long("duration_ms"),
      localUri = c.string("local_uri").orEmpty(),
      artworkUri = c.string("artwork_uri"),
      available = c.long("available") == 1L,
    )

  private fun readPlaylist(c: Cursor) =
    Playlist(
      id = c.long("id"),
      name = c.string("name").orEmpty(),
      createdAt = c.long("created_at"),
      shuffle = c.long("shuffle") == 1L,
      repeat = c.long("repeat") == 1L,
      resumeTrackId = c.longOrNull("resume_track_id"),
      resumePositionMs = c.long("resume_position_ms"),
      songCount = c.long("song_count").toInt(),
      totalDurationMs = c.long("total_duration_ms"),
    )

  private fun readAlarm(c: Cursor) =
    Alarm(
      id = c.long("id"),
      hour = c.long("hour").toInt(),
      minute = c.long("minute").toInt(),
      enabled = c.long("enabled") == 1L,
      repeatDays = c.long("repeat_days").toInt(),
      playlistId = c.longOrNull("playlist_id"),
      volume = c.long("volume").toInt(),
      startFromBeginning = c.long("start_from_beginning") == 1L,
      createdAt = c.long("created_at"),
      nextTriggerAt = c.longOrNull("next_trigger_at"),
    )

  companion object {
    private const val PLAYLIST_SELECT =
      """SELECT p.*, COUNT(t.id) AS song_count, COALESCE(SUM(t.duration_ms), 0) AS total_duration_ms
         FROM playlist p
         LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
         LEFT JOIN track t ON t.id = pt.track_id AND t.available = 1"""

    @Volatile private var instance: MelodyDatabase? = null

    fun get(context: Context): MelodyDatabase =
      instance
        ?: synchronized(this) {
          instance ?: MelodyDatabase(context.applicationContext).also { instance = it }
        }
  }
}

private inline fun SQLiteDatabase.transaction(block: SQLiteDatabase.() -> Unit) {
  beginTransaction()
  try {
    block()
    setTransactionSuccessful()
  } finally {
    endTransaction()
  }
}

private inline fun <T> Cursor.mapAll(read: (Cursor) -> T): List<T> {
  val items = ArrayList<T>(count)
  while (moveToNext()) items.add(read(this))
  return items
}

private fun Cursor.long(column: String) = getLong(getColumnIndexOrThrow(column))

private fun Cursor.longOrNull(column: String): Long? {
  val index = getColumnIndexOrThrow(column)
  return if (isNull(index)) null else getLong(index)
}

private fun Cursor.string(column: String): String? = getString(getColumnIndexOrThrow(column))
