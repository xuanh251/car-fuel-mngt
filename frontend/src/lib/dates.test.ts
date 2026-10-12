import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { toApiDate, fromApiDate } from './dates';

describe('toApiDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toApiDate(dayjs('2026-03-05'))).toBe('2026-03-05');
  });

  it('keeps the local calendar day late in the evening', () => {
    expect(toApiDate(dayjs('2026-03-05 23:30'))).toBe('2026-03-05');
  });

  it('returns an empty string when there is no date', () => {
    expect(toApiDate(null)).toBe('');
    expect(toApiDate(undefined)).toBe('');
  });
});

describe('fromApiDate', () => {
  it('parses YYYY-MM-DD into the same local day', () => {
    const d = fromApiDate('2026-03-05');
    expect(d?.year()).toBe(2026);
    expect(d?.month()).toBe(2);
    expect(d?.date()).toBe(5);
  });

  it('returns null for an empty string', () => {
    expect(fromApiDate('')).toBeNull();
  });

  it('round-trips through toApiDate', () => {
    expect(toApiDate(fromApiDate('2026-12-31'))).toBe('2026-12-31');
  });
});
