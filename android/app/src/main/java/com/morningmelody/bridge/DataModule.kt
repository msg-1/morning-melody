package com.morningmelody.bridge

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.morningmelody.db.MelodyDatabase

/** Playlists, tracks and settings for the JavaScript side. See src/database. */
class DataModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val db get() = MelodyDatabase.get(reactApplicationContext)

  override fun getName() = NAME

  @ReactMethod
  fun listTracks(search: String?, promise: Promise) = settle(promise) {
    db.listTracks(search).toArray { it.toMap() }
  }

  @ReactMethod
  fun listPlaylists(promise: Promise) = settle(promise) { db.listPlaylists().toArray { it.toMap() } }

  @ReactMethod
  fun getPlaylist(id: Double, promise: Promise) = settle(promise) { db.getPlaylist(id.toLong())?.toMap() }

  @ReactMethod
  fun createPlaylist(name: String, promise: Promise) = settle(promise) {
    db.createPlaylist(name).toDouble()
  }

  @ReactMethod
  fun renamePlaylist(id: Double, name: String, promise: Promise) = settle(promise) {
    db.renamePlaylist(id.toLong(), name)
    null
  }

  @ReactMethod
  fun deletePlaylist(id: Double, promise: Promise) = settle(promise) {
    db.deletePlaylist(id.toLong())
    null
  }

  @ReactMethod
  fun setPlaylistOptions(id: Double, shuffle: Boolean, repeat: Boolean, promise: Promise) =
    settle(promise) {
      db.setPlaylistOptions(id.toLong(), shuffle, repeat)
      null
    }

  @ReactMethod
  fun playlistTracks(id: Double, promise: Promise) = settle(promise) {
    db.playlistTracks(id.toLong()).toArray { it.toMap() }
  }

  @ReactMethod
  fun addTracksToPlaylist(id: Double, trackIds: ReadableArray, promise: Promise) = settle(promise) {
    db.addTracksToPlaylist(id.toLong(), trackIds.toLongList())
  }

  @ReactMethod
  fun removeTrackFromPlaylist(id: Double, trackId: Double, promise: Promise) = settle(promise) {
    db.removeTrackFromPlaylist(id.toLong(), trackId.toLong())
    null
  }

  @ReactMethod
  fun moveTrackInPlaylist(id: Double, trackId: Double, delta: Double, promise: Promise) =
    settle(promise) {
      db.moveTrackInPlaylist(id.toLong(), trackId.toLong(), delta.toInt())
      null
    }

  @ReactMethod
  fun getSetting(key: String, promise: Promise) = settle(promise) { db.getSetting(key) }

  @ReactMethod
  fun setSetting(key: String, value: String, promise: Promise) = settle(promise) {
    db.setSetting(key, value)
    null
  }

  companion object {
    const val NAME = "MelodyData"
  }
}

internal inline fun settle(promise: Promise, block: () -> Any?) {
  try {
    promise.resolve(block())
  } catch (error: Exception) {
    promise.reject("E_MELODY", error.message, error)
  }
}
