import type {
  DailyDownloads,
  DownloadsHistory,
  PackageHistory,
} from './downloads-history.js';
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

type Metrics = {
  downloadsPerMonth: DownloadInfo;
  downloadsPerYear: DownloadInfo;
  downloadsTotal: DownloadInfo;
};

export type PackageStats = Metrics & {
  since: string;
};

export type GroupStats = Metrics & {
  since: string | null;
  packages: Record<string, PackageStats>;
};

type Options = {
  coMaintained?: Record<string, string>;
  deprecated?: string[];
  historyPath?: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class NPM {
  private readonly username: string;
  private readonly coMaintained: Map<string, string>;
  private readonly deprecated: string[];
  private readonly historyPath: string;
  private static readonly SEARCH_PAGE_SIZE = 250;
  private static readonly RANGE_LIMIT_DAYS = 540;
  private static readonly BACKFILL_DAYS = 14;
  private static readonly SETTLE_DAYS = 2;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 5000;
  private static readonly UNITS = [
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'k' },
  ];
  private cachedPackages: string[] | null = null;
  private cachedDownloads: DownloadsHistory | null = null;

  constructor(username: string, options: Options = Object.create(null)) {
    const joined: Record<string, string> =
      options.coMaintained ?? Object.create(null);

    for (const [packageName, day] of Object.entries(joined))
      if (!ISO_DAY.test(day))
        throw new Error(`Invalid join day "${day}" for "${packageName}".`);

    this.username = username;
    this.coMaintained = new Map(
      Object.keys(joined)
        .sort()
        .map((packageName) => [packageName, joined[packageName]])
    );
    this.deprecated = [...(options.deprecated ?? [])].sort();
    this.historyPath = options.historyPath ?? './docs/downloads-history.json';
  }

  private periodStart(period: Period): string {
    const start = new Date();

    if (period === 'month') start.setMonth(start.getMonth() - 1);
    else start.setFullYear(start.getFullYear() - 1);

    return toDay(start);
  }

  private fetchStart(
    since: string,
    recorded: PackageHistory | undefined
  ): string {
    if (!recorded || since < recorded.since) return since;

    const newest = newestDay(recorded.days);

    if (!newest) return since;

    const overlapStart = shiftDays(newest, -NPM.BACKFILL_DAYS);

    return overlapStart > since ? overlapStart : since;
  }

  private async fetchThrottled(url: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url);

      if (response.status !== 429 || attempt === NPM.MAX_ATTEMPTS)
        return response;

      await Bun.sleep(NPM.RETRY_DELAY_MS * attempt);
    }
  }

  private async fetchCreatedDay(packageName: string): Promise<string> {
    const response = await this.fetchThrottled(
      `https://registry.npmjs.org/${packageName}`
    );

    if (!response.ok)
      throw new Error(
        `NPM registry error for ${packageName}: HTTP ${response.status}.`
      );

    const { time } = (await response.json()) as { time: { created: string } };

    return toDay(new Date(time.created));
  }

  private async sinceOf(
    packageName: string,
    recorded: PackageHistory | undefined
  ): Promise<string> {
    return (
      this.coMaintained.get(packageName) ??
      recorded?.since ??
      (await this.fetchCreatedDay(packageName))
    );
  }

  private async fetchRange(
    packageName: string,
    from: string,
    until: string
  ): Promise<DailyDownloads | undefined> {
    const url = `https://api.npmjs.org/downloads/range/${from}:${until}/${packageName}`;

    try {
      const response = await this.fetchThrottled(url);

      if (!response.ok) {
        console.error(
          `NPM API error for ${packageName}: HTTP ${response.status}.`
        );

        return undefined;
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

      return undefined;
    }
  }

  private async fetchDailyDownloads(
    packageName: string,
    start: string
  ): Promise<DailyDownloads | undefined> {
    const today = toDay(new Date());
    const daily: DailyDownloads = Object.create(null);

    for (
      let from = start;
      from <= today;
      from = shiftDays(from, NPM.RANGE_LIMIT_DAYS)
    ) {
      const until = shiftDays(from, NPM.RANGE_LIMIT_DAYS - 1);
      const fetched = await this.fetchRange(
        packageName,
        from,
        until < today ? until : today
      );

      if (!fetched) return undefined;

      Object.assign(daily, fetched);
    }

    return daily;
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
    const packageNames = [
      ...(await this.authorPackages()),
      ...this.coMaintained.keys(),
    ];
    const tracked = new Set(packageNames);

    for (const packageName of Object.keys(previous))
      if (!tracked.has(packageName))
        console.warn(`"${packageName}" is recorded but no longer tracked.`);

    const settledUntil = shiftDays(toDay(new Date()), -NPM.SETTLE_DAYS);

    const persistent: DownloadsHistory = Object.assign(
      Object.create(null),
      previous
    );
    const countable: DownloadsHistory = Object.assign(
      Object.create(null),
      previous
    );

    for (const packageName of packageNames) {
      const recorded = previous[packageName];
      const since = await this.sinceOf(packageName, recorded);
      const kept = keepSince(recorded?.days ?? Object.create(null), since);
      const fetched = await this.fetchDailyDownloads(
        packageName,
        this.fetchStart(since, recorded)
      );

      if (!fetched) {
        countable[packageName] = { since, days: kept };

        continue;
      }

      const days = recordDays(
        kept,
        fetched,
        recordableUntil(fetched, settledUntil)
      );

      persistent[packageName] = { since, days };
      countable[packageName] = {
        since,
        days: withUnsettledTail(days, fetched, settledUntil),
      };
    }

    await Bun.write(this.historyPath, JSON.stringify(persistent));

    this.cachedDownloads = countable;

    return countable;
  }

  private abbreviate(num: number): string {
    const unit = NPM.UNITS.find(({ value }) => num >= value);

    if (!unit) return String(num);

    return `${(num / unit.value).toFixed(1).replace(/\.0$/, '')}${unit.suffix}`;
  }

  private downloadInfo(value: number, period?: Period): DownloadInfo {
    const amount = this.abbreviate(value);

    return { value, label: period ? `${amount}/${period}` : amount };
  }

  private async groupStats(packageNames: string[]): Promise<GroupStats> {
    const downloads = await this.refreshDownloads();
    const monthStart = this.periodStart('month');
    const yearStart = this.periodStart('year');
    const packages: Record<string, PackageStats> = Object.create(null);

    let month = 0;
    let year = 0;
    let total = 0;

    for (const packageName of packageNames) {
      const { since, days } = downloads[packageName];
      const monthly = sumSince(days, monthStart);
      const yearly = sumSince(days, yearStart);
      const all = sumSince(days, since);

      packages[packageName] = {
        since,
        downloadsPerMonth: this.downloadInfo(monthly, 'month'),
        downloadsPerYear: this.downloadInfo(yearly, 'year'),
        downloadsTotal: this.downloadInfo(all),
      };

      month += monthly;
      year += yearly;
      total += all;
    }

    const since =
      Object.values(packages)
        .map((stats) => stats.since)
        .sort()
        .at(0) ?? null;

    return {
      since,
      packages,
      downloadsPerMonth: this.downloadInfo(month, 'month'),
      downloadsPerYear: this.downloadInfo(year, 'year'),
      downloadsTotal: this.downloadInfo(total),
    };
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

    const names = new Set([
      ...(await this.searchPackages()),
      ...this.deprecated,
    ]);

    this.cachedPackages = [...names]
      .filter((name) => !this.coMaintained.has(name))
      .sort();

    return this.cachedPackages;
  }

  public async authorStats(): Promise<GroupStats> {
    return this.groupStats(await this.authorPackages());
  }

  public async coMaintainedStats(): Promise<GroupStats> {
    return this.groupStats([...this.coMaintained.keys()]);
  }
}
