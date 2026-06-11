export type DailyDownloads = Record<string, number>;
export type DownloadsHistory = Record<string, DailyDownloads>;

export const toDay = (date: Date): string => date.toISOString().slice(0, 10);

export const shiftDays = (day: string, days: number): string => {
  const date = new Date(day);

  date.setDate(date.getDate() + days);

  return toDay(date);
};

export const newestDay = (days: DailyDownloads): string | undefined =>
  Object.keys(days).sort().at(-1);

export const recordableUntil = (
  fetched: DailyDownloads,
  settledUntil: string
): string => {
  const newest = newestDay(fetched);

  if (!newest) return '';

  const proven = shiftDays(newest, -1);

  return proven < settledUntil ? proven : settledUntil;
};

export const recordDays = (
  recorded: DailyDownloads | undefined,
  fetched: DailyDownloads,
  until: string
): DailyDownloads => {
  const days: DailyDownloads = Object.assign(Object.create(null), recorded);

  for (const [day, downloads] of Object.entries(fetched))
    if (day <= until && !(day in days)) days[day] = downloads;

  return days;
};

export const keepSince = (
  days: DailyDownloads,
  start: string
): DailyDownloads => {
  const kept: DailyDownloads = Object.create(null);

  for (const day of Object.keys(days).sort())
    if (day >= start) kept[day] = days[day];

  return kept;
};

export const withUnsettledTail = (
  recorded: DailyDownloads,
  fetched: DailyDownloads,
  settledUntil: string
): DailyDownloads => {
  const days: DailyDownloads = Object.assign(Object.create(null), recorded);

  for (const [day, downloads] of Object.entries(fetched))
    if (day > settledUntil) days[day] = downloads;

  return days;
};

export const sumSince = (history: DownloadsHistory, start: string): number => {
  let sum = 0;

  for (const daily of Object.values(history))
    for (const [day, downloads] of Object.entries(daily))
      if (day >= start) sum += downloads;

  return sum;
};
