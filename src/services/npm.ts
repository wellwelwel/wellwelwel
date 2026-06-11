import type { DailyDownloads, DownloadsHistory } from './downloads-history.js';
import {
  keepSince,
  newestDay,
  recordableUntil,
  recordDays,
  shiftDays,
  sumSince,
  toDay,
  withUnsettledTail,
} from './downloads-history.js';

type Period = 'month' | 'year';

type DownloadInfo = {
  value: number;
  label: string;
};

export class NPM {
  private readonly username: string;
  private readonly historyPath: string;
  private static readonly SEARCH_PAGE_SIZE = 250;
  private static readonly BACKFILL_DAYS = 14;
  private static readonly SETTLE_DAYS = 2;
  private cachedPackages: string[] | null = null;
  private cachedDownloads: DownloadsHistory | null = null;

  constructor(username: string, historyPath = './docs/downloads-history.json') {
    this.username = username;
    this.historyPath = historyPath;
  }

  private periodStart(period: Period): string {
    const start = new Date();

    if (period === 'month') start.setMonth(start.getMonth() - 1);
    else start.setFullYear(start.getFullYear() - 1);

    return toDay(start);
  }

  private windowStart(recorded: DailyDownloads | undefined): string {
    const yearStart = this.periodStart('year');
    const newest = newestDay(recorded ?? Object.create(null));

    if (!newest) return yearStart;

    const overlapStart = shiftDays(newest, -NPM.BACKFILL_DAYS);

    return overlapStart > yearStart ? overlapStart : yearStart;
  }

  private async fetchDailyDownloads(
    packageName: string,
    start: string
  ): Promise<DailyDownloads> {
    const range = `${start}:${toDay(new Date())}`;
    const url = `https://api.npmjs.org/downloads/range/${range}/${packageName}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `NPM API error for ${packageName}: HTTP ${response.status}.`
        );

        return Object.create(null);
      }

      const data = (await response.json()) as {
        downloads: { day: string; downloads: number }[];
      };
      const daily: DailyDownloads = Object.create(null);

      for (const { day, downloads } of data.downloads)
        if (downloads > 0) daily[day] = downloads;

      return daily;
    } catch (error) {
      console.error(`NPM API error for ${packageName}:`, error);

      return Object.create(null);
    }
  }

  private async loadHistory(): Promise<DownloadsHistory> {
    try {
      return JSON.parse(await Bun.file(this.historyPath).text());
    } catch {
      return Object.create(null);
    }
  }

  private async refreshDownloads(): Promise<DownloadsHistory> {
    if (this.cachedDownloads) return this.cachedDownloads;

    const previous = await this.loadHistory();
    const packageNames = await this.packages();
    const yearStart = this.periodStart('year');
    const settledUntil = shiftDays(toDay(new Date()), -NPM.SETTLE_DAYS);

    const persistent: DownloadsHistory = Object.assign(
      Object.create(null),
      previous
    );
    const countable: DownloadsHistory = Object.assign(
      Object.create(null),
      previous
    );

    await Promise.all(
      packageNames.map(async (packageName) => {
        const fetched = await this.fetchDailyDownloads(
          packageName,
          this.windowStart(previous[packageName])
        );
        const recorded = keepSince(
          recordDays(
            previous[packageName],
            fetched,
            recordableUntil(fetched, settledUntil)
          ),
          yearStart
        );

        persistent[packageName] = recorded;
        countable[packageName] = withUnsettledTail(
          recorded,
          fetched,
          settledUntil
        );
      })
    );

    await Bun.write(this.historyPath, JSON.stringify(persistent));

    this.cachedDownloads = countable;

    return countable;
  }

  private async sumDownloads(period: Period): Promise<number> {
    const downloads = await this.refreshDownloads();

    return sumSince(downloads, this.periodStart(period));
  }

  private formatNumber(num: number, period: Period): string {
    if (num < 1000) return `${num}/${period}`;

    const units = [
      { value: 1e9, suffix: 'B' },
      { value: 1e6, suffix: 'M' },
      { value: 1e3, suffix: 'k' },
    ];

    for (const unit of units) {
      if (num >= unit.value) {
        const val = num / unit.value;

        return val % 1 === 0
          ? `${val.toFixed(0)}${unit.suffix}/${period}`
          : `${val.toFixed(1).replace(/\.0$/, '')}${unit.suffix}/${period}`;
      }
    }

    return `${num}/${period}`;
  }

  public async packages(): Promise<string[]> {
    if (this.cachedPackages) return this.cachedPackages;

    let from = 0;

    const size = NPM.SEARCH_PAGE_SIZE;
    const names: string[] = [];

    while (true) {
      const url = `https://registry.npmjs.org/-/v1/search?text=maintainer:${this.username}&size=${size}&from=${from}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(String(response.status));

      const data = (await response.json()) as {
        objects: { package: { name: string } }[];
      };
      const batch = data.objects.map((obj) => obj.package.name);

      names.push(...batch);

      if (batch.length < size) break;

      from += size;
    }

    this.cachedPackages = names;

    return names;
  }

  public async downloadsPerMonth(): Promise<DownloadInfo> {
    const downloads = await this.sumDownloads('month');

    return {
      value: downloads,
      label: this.formatNumber(downloads, 'month'),
    };
  }

  public async downloadsPerYear(): Promise<DownloadInfo> {
    const downloads = await this.sumDownloads('year');

    return {
      value: downloads,
      label: this.formatNumber(downloads, 'year'),
    };
  }
}
