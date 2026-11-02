import {
  describeRingTime,
  formatClock,
  formatDuration,
  formatPlaylistSummary,
  formatRepeatDays,
  greetingFor,
} from '../src/utils/format';

describe('formatClock', () => {
  it('handles midnight, morning, noon and evening', () => {
    expect(formatClock(0, 5)).toEqual({ time: '12:05', period: 'AM' });
    expect(formatClock(6, 0)).toEqual({ time: '6:00', period: 'AM' });
    expect(formatClock(12, 0)).toEqual({ time: '12:00', period: 'PM' });
    expect(formatClock(18, 30)).toEqual({ time: '6:30', period: 'PM' });
  });
});

describe('formatRepeatDays', () => {
  it('uses plain words for common choices', () => {
    expect(formatRepeatDays(0)).toBe('Once');
    expect(formatRepeatDays(0b1111111)).toBe('Every day');
    expect(formatRepeatDays(0b0011111)).toBe('Weekdays');
    expect(formatRepeatDays(0b1100000)).toBe('Weekends');
    expect(formatRepeatDays(0b0000101)).toBe('Mon, Wed');
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(512000)).toBe('8:32');
    expect(formatDuration(3725000)).toBe('1:02:05');
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('formatPlaylistSummary', () => {
  it('matches the design wording', () => {
    expect(formatPlaylistSummary(12, 2520000)).toBe('12 songs  ·  42 min');
    expect(formatPlaylistSummary(1, 1000)).toBe('1 song  ·  1 min');
    expect(formatPlaylistSummary(0, 0)).toBe('0 songs');
  });
});

describe('describeRingTime', () => {
  const now = new Date(2026, 10, 2, 20, 0);
  it('says today, tomorrow or the weekday', () => {
    expect(describeRingTime(new Date(2026, 10, 2, 21, 0).getTime(), now)).toBe(
      '9:00 PM today',
    );
    expect(describeRingTime(new Date(2026, 10, 3, 6, 0).getTime(), now)).toBe(
      '6:00 AM tomorrow',
    );
    expect(describeRingTime(new Date(2026, 10, 6, 6, 0).getTime(), now)).toBe(
      '6:00 AM on Friday',
    );
  });
});

describe('greetingFor', () => {
  it('follows the time of day', () => {
    expect(greetingFor(6)).toBe('Good morning');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(20)).toBe('Good evening');
  });
});
