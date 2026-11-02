package com.morningmelody.alarms

import java.time.ZonedDateTime

/**
 * Finds the next moment an alarm should ring. [repeatDays] is a bitmask where bit 0 is Monday and
 * bit 6 is Sunday; zero means the alarm rings once. Works from wall-clock time, so a timezone change
 * or daylight saving shift keeps a 6:00 alarm at 6:00. A time skipped by daylight saving rings at
 * the first valid moment after the gap.
 */
fun nextTrigger(now: ZonedDateTime, hour: Int, minute: Int, repeatDays: Int): ZonedDateTime {
  val today = now.toLocalDate()
  for (offset in 0L..7L) {
    val date = today.plusDays(offset)
    val matchesDay = repeatDays == 0 || repeatDays and (1 shl (date.dayOfWeek.value - 1)) != 0
    if (!matchesDay) continue
    val candidate = date.atTime(hour, minute).atZone(now.zone)
    if (candidate.isAfter(now)) return candidate
  }
  throw IllegalArgumentException("Invalid repeat days: $repeatDays")
}
