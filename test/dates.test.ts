import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, todayISO } from '../src/dates.js';

describe('dates', () => {
  it('addDaysは月またぎ・年またぎを処理する', () => {
    expect(addDays('2026-07-05', 1)).toBe('2026-07-06');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('addDaysは不正な日付にundefinedを返す', () => {
    expect(addDays('unknown', 1)).toBeUndefined();
  });

  it('daysBetweenは a - b を日数で返す', () => {
    expect(daysBetween('2026-07-06', '2026-07-05')).toBe(1);
    expect(daysBetween('2026-07-05', '2026-07-05')).toBe(0);
    expect(daysBetween('2026-07-01', '2026-07-06')).toBe(-5);
  });

  it('todayISOはローカル日付をYYYY-MM-DDで返す', () => {
    expect(todayISO(new Date(2026, 6, 6, 23, 30))).toBe('2026-07-06');
    expect(todayISO(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
