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

export type PackageStats = {
  downloadsPerMonth: DownloadInfo;
  downloadsPerYear: DownloadInfo;
};

export type GroupStats = PackageStats & {
  packages: Record<string, PackageStats>;
};

type Options = {
  coMaintained?: string[];
  historyPath?: string;
};

export class NPM {
  private readonly username: string;
  private readonly coMaintained: string[];
  private readonly historyPath: string;
  private static readonly SEARCH_PAGE_SIZE = 250;
  private static readonly BACKFILL_DAYS = 14;
  private static readonly SETTLE_DAYS = 2;
  private cachedPackages: string[] | null = null;
  private cachedDownloads: DownloadsHistory | null = null;
  private cachedHistory: DownloadsHistory | null = null;

  constructor(username: string, options: Options = Object.create(null)) {
    this.username = username;
    this.coMaintained = [...(options.coMaintained ?? [])].sort();
    this.historyPath = options.historyPath ?? './docs/downloads-history.json';
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

  private async history(): Promise<DownloadsHistory> {
    if (this.cachedHistory) return this.cachedHistory;

    const loaded = await this.loadHistory();

    this.cachedHistory = loaded;

    return loaded;
  }

  private async isMaintainer(packageName: string): Promise<boolean> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`);

      if (response.status === 404) return false;
      if (!response.ok) return true;

      const data = (await response.json()) as {
        maintainers?: { name: string }[];
      };

      return (data.maintainers ?? []).some(
        (maintainer) => maintainer.name === this.username
      );
    } catch {
      return true;
    }
  }

  private async refreshDownloads(): Promise<DownloadsHistory> {
    if (this.cachedDownloads) return this.cachedDownloads;

    const previous = await this.history();
    const packageNames = [
      ...(await this.authorPackages()),
      ...this.coMaintained,
    ];
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

  private downloadInfo(value: number, period: Period): DownloadInfo {
    return { value, label: this.formatNumber(value, period) };
  }

  private async groupStats(packageNames: string[]): Promise<GroupStats> {
    const downloads = await this.refreshDownloads();
    const monthStart = this.periodStart('month');
    const yearStart = this.periodStart('year');
    const packages: Record<string, PackageStats> = Object.create(null);

    let month = 0;
    let year = 0;

    for (const packageName of packageNames) {
      const daily: DailyDownloads =
        downloads[packageName] ?? Object.create(null);
      const monthly = sumSince(daily, monthStart);
      const yearly = sumSince(daily, yearStart);

      packages[packageName] = {
        downloadsPerMonth: this.downloadInfo(monthly, 'month'),
        downloadsPerYear: this.downloadInfo(yearly, 'year'),
      };

      month += monthly;
      year += yearly;
    }

    return {
      packages,
      downloadsPerMonth: this.downloadInfo(month, 'month'),
      downloadsPerYear: this.downloadInfo(year, 'year'),
    };
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

  private async searchPackages(): Promise<string[]> {
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

    return names;
  }

  public async authorPackages(): Promise<string[]> {
    if (this.cachedPackages) return this.cachedPackages;

    const searched = await this.searchPackages();
    const remembered = Object.keys(await this.history()).filter(
      (name) => !searched.includes(name) && !this.coMaintained.includes(name)
    );
    const stillAuthored = await Promise.all(
      remembered.map(async (name) =>
        (await this.isMaintainer(name)) ? name : null
      )
    );

    this.cachedPackages = [
      ...searched.filter((name) => !this.coMaintained.includes(name)),
      ...stillAuthored.filter((name) => name !== null),
    ].sort();

    return this.cachedPackages;
  }

  public async authorStats(): Promise<GroupStats> {
    return this.groupStats(await this.authorPackages());
  }

  public async coMaintainedStats(): Promise<GroupStats> {
    return this.groupStats(this.coMaintained);
  }
}
