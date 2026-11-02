export const EVERY_DAY = 0b1111111;
const WEEKDAYS = 0b0011111;
const WEEKEND = 0b1100000;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatClock(hour: number, minute: number) {
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${twelveHour}:${String(minute).padStart(2, '0')}`,
    period: hour < 12 ? 'AM' : 'PM',
  };
}

export function formatRepeatDays(mask: number) {
  if (mask === 0) return 'Once';
  if (mask === EVERY_DAY) return 'Every day';
  if (mask === WEEKDAYS) return 'Weekdays';
  if (mask === WEEKEND) return 'Weekends';
  return DAY_NAMES.filter((_, day) => mask & (1 << day)).join(', ');
}

/** 8:32 or 1:02:05 */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** 12 songs · 42 min */
export function formatPlaylistSummary(songCount: number, totalMs: number) {
  const songs = songCount === 1 ? '1 song' : `${songCount} songs`;
  if (songCount === 0) return songs;
  const minutes = Math.max(1, Math.round(totalMs / 60000));
  return `${songs}  ·  ${minutes} min`;
}

export function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "6:00 AM tomorrow", "6:00 AM on Friday" */
export function describeRingTime(triggerAt: number, now = new Date()) {
  const when = new Date(triggerAt);
  const { time, period } = formatClock(when.getHours(), when.getMinutes());
  const days = Math.round((startOfDay(when) - startOfDay(now)) / 86400000);
  const label = `${time} ${period}`;
  if (days === 0) return `${label} today`;
  if (days === 1) return `${label} tomorrow`;
  return `${label} on ${when.toLocaleDateString('en-GB', { weekday: 'long' })}`;
}
