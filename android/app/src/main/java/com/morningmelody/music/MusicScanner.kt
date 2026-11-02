package com.morningmelody.music

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.content.ContextCompat
import com.morningmelody.db.MelodyDatabase
import com.morningmelody.db.ScannedTrack

object MusicScanner {
  private const val UNKNOWN = "<unknown>"
  private const val MIN_NON_MUSIC_DURATION_MS = 30_000

  fun hasPermission(context: Context): Boolean {
    val permission =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.READ_MEDIA_AUDIO
      else Manifest.permission.READ_EXTERNAL_STORAGE
    return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
  }

  /**
   * Reads the phone's audio index and refreshes the database. Only metadata and references are
   * stored. Without permission the database is left alone, since an empty answer would otherwise
   * look as if every song had been deleted.
   */
  fun scan(context: Context): Boolean {
    if (!hasPermission(context)) return false
    val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    val projection =
      arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.ALBUM_ID,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.DATA,
      )
    // Devotional tracks are often not tagged as music, so also take long files that are not sounds.
    val selection =
      """${MediaStore.Audio.Media.IS_MUSIC} != 0 OR (
           ${MediaStore.Audio.Media.IS_RINGTONE} = 0 AND
           ${MediaStore.Audio.Media.IS_NOTIFICATION} = 0 AND
           ${MediaStore.Audio.Media.IS_ALARM} = 0 AND
           ${MediaStore.Audio.Media.DURATION} >= $MIN_NON_MUSIC_DURATION_MS)"""

    val cursor = context.contentResolver.query(collection, projection, selection, null, null) ?: return false
    val scanned = ArrayList<ScannedTrack>()
    cursor.use { c ->
      while (c.moveToNext()) {
        val id = c.getLong(0)
        val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id).toString()
        scanned.add(
          ScannedTrack(
            mediaKey = c.getString(6) ?: uri,
            title = c.getString(1) ?: "Untitled",
            artist = c.getString(2)?.takeIf { it != UNKNOWN },
            album = c.getString(3)?.takeIf { it != UNKNOWN },
            durationMs = c.getLong(5),
            localUri = uri,
            artworkUri = "content://media/external/audio/albumart/${c.getLong(4)}",
          ))
      }
    }
    val db = MelodyDatabase.get(context)
    db.applyScan(scanned)
    refreshPickedTracks(context, db)
    return true
  }

  private fun refreshPickedTracks(context: Context, db: MelodyDatabase) {
    for (track in db.pickedTracks()) {
      val readable =
        runCatching {
            context.contentResolver.openAssetFileDescriptor(Uri.parse(track.localUri), "r")?.close()
            true
          }
          .getOrDefault(false)
      if (readable != track.available) db.setTrackAvailable(track.id, readable)
    }
  }

  /** Remembers a file chosen in Android's file picker, which works without the music permission. */
  fun addPickedFile(context: Context, uri: Uri) {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, uri)
      val db = MelodyDatabase.get(context)
      val title =
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE) ?: displayName(context, uri)
      val durationMs =
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      // A file the phone's index already knows is in the library, so do not list it a second time.
      // File pickers hide the real path, so the same song is recognised by its title and length.
      if (db.hasSong(title, durationMs)) return
      db.addPickedTrack(
        title = title,
        artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST),
        album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM),
        durationMs = durationMs,
        localUri = uri.toString(),
      )
    } finally {
      retriever.release()
    }
  }

  private fun displayName(context: Context, uri: Uri): String {
    val name =
      context.contentResolver
        .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    return name?.substringBeforeLast('.') ?: "Untitled"
  }
}
