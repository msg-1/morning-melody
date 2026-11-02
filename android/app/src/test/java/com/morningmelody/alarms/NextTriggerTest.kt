package com.morningmelody.alarms

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Test

class NextTriggerTest {
  private val india = ZoneId.of("Asia/Kolkata")
  private val newYork = ZoneId.of("America/New_York")
  private val everyDay = 0b1111111
  private val monday = 1 shl 0
  private val sunday = 1 shl 6

  private fun at(zone: ZoneId, y: Int, mo: Int, d: Int, h: Int, mi: Int) =
    ZonedDateTime.of(y, mo, d, h, mi, 0, 0, zone)

  @Test
  fun oneTimeAlarmLaterToday() {
    val now = at(india, 2026, 11, 2, 5, 0)
    assertEquals(at(india, 2026, 11, 2, 6, 0), nextTrigger(now, 6, 0, 0))
  }

  @Test
  fun oneTimeAlarmAlreadyPassedMovesToTomorrow() {
    val now = at(india, 2026, 11, 2, 7, 0)
    assertEquals(at(india, 2026, 11, 3, 6, 0), nextTrigger(now, 6, 0, 0))
  }

  @Test
  fun alarmAtExactlyNowDoesNotRingAgain() {
    val now = at(india, 2026, 11, 2, 6, 0)
    assertEquals(at(india, 2026, 11, 3, 6, 0), nextTrigger(now, 6, 0, everyDay))
  }

  @Test
  fun repeatSkipsToNextSelectedDay() {
    // 2 Nov 2026 is a Monday.
    val now = at(india, 2026, 11, 2, 7, 0)
    assertEquals(at(india, 2026, 11, 8, 6, 0), nextTrigger(now, 6, 0, sunday))
  }

  @Test
  fun singleDayRepeatWrapsAFullWeek() {
    val now = at(india, 2026, 11, 2, 7, 0)
    assertEquals(at(india, 2026, 11, 9, 6, 0), nextTrigger(now, 6, 0, monday))
  }

  @Test
  fun keepsWallClockAcrossDaylightSavingEnd() {
    // Clocks go back on 1 Nov 2026 in New York.
    val now = at(newYork, 2026, 10, 31, 20, 0)
    val trigger = nextTrigger(now, 6, 0, everyDay)
    assertEquals(6, trigger.hour)
    assertEquals(1, trigger.dayOfMonth)
  }

  @Test
  fun timeSkippedByDaylightSavingRingsAfterTheGap() {
    // 2:30 does not exist on 14 Mar 2027 in New York.
    val now = at(newYork, 2027, 3, 14, 0, 0)
    val trigger = nextTrigger(now, 2, 30, everyDay)
    assertEquals(3, trigger.hour)
    assertEquals(30, trigger.minute)
  }

  @Test
  fun timezoneChangeRecomputesInNewZone() {
    val now = at(india, 2026, 11, 2, 7, 0).withZoneSameInstant(newYork)
    assertEquals(6, nextTrigger(now, 6, 0, everyDay).withZoneSameInstant(newYork).hour)
  }
}
