package com.morningmelody.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.morningmelody.db.Alarm
import com.morningmelody.db.Playlist
import com.morningmelody.db.Track

internal fun Track.toMap(): WritableMap =
  Arguments.createMap().apply {
    putDouble("id", id.toDouble())
    putString("title", title)
    putString("artist", artist)
    putString("album", album)
    putDouble("durationMs", durationMs.toDouble())
    putString("localUri", localUri)
    putString("artworkUri", artworkUri)
    putBoolean("available", available)
  }

internal fun Playlist.toMap(): WritableMap =
  Arguments.createMap().apply {
    putDouble("id", id.toDouble())
    putString("name", name)
    putDouble("createdAt", createdAt.toDouble())
    putBoolean("shuffle", shuffle)
    putBoolean("repeat", repeat)
    putInt("songCount", songCount)
    putDouble("totalDurationMs", totalDurationMs.toDouble())
  }

internal fun Alarm.toMap(): WritableMap =
  Arguments.createMap().apply {
    putDouble("id", id.toDouble())
    putInt("hour", hour)
    putInt("minute", minute)
    putBoolean("enabled", enabled)
    putInt("repeatDays", repeatDays)
    if (playlistId != null) putDouble("playlistId", playlistId.toDouble()) else putNull("playlistId")
    putInt("volume", volume)
    putBoolean("startFromBeginning", startFromBeginning)
    putDouble("createdAt", createdAt.toDouble())
    if (nextTriggerAt != null) putDouble("nextTriggerAt", nextTriggerAt.toDouble())
    else putNull("nextTriggerAt")
  }

internal fun <T> List<T>.toArray(toMap: (T) -> WritableMap): WritableArray =
  Arguments.createArray().also { array -> forEach { array.pushMap(toMap(it)) } }

internal fun ReadableArray.toLongList(): List<Long> = (0 until size()).map { getDouble(it).toLong() }
