type DownloadPeriod = 'dm' | 'dy';

type DownloadInfo = {
  value: number;
  label: string;
};

export class NPM {
  private readonly username: string;
  private static readonly PERIODS_REGEX = /month|year/gi;
  private static readonly SHIELDS_IO_CACHE_SECONDS = 1;
  private static readonly SEARCH_PAGE_SIZE = 250;
  private cachedPackages: string[] | null = null;

  constructor(username: string) {
    this.username = username;
  }

  private async sumDownloads(period: DownloadPeriod): Promise<number> {
    const packageNames = await this.packages();

    const downloads = await Promise.all(
      packageNames.map((packageName) =>
        this.getShieldsIoDownloads(packageName, period)
      )
    );

    return downloads.reduce((sum, current) => sum + current, 0);
  }

  private async getShieldsIoDownloads(
    packageName: string,
    period: DownloadPeriod
  ): Promise<number> {
    const url = `https://img.shields.io/npm/${period}/${packageName}.json?cacheSeconds=${NPM.SHIELDS_IO_CACHE_SECONDS}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return 0;

      const data = await response.json();

      return this.parseDownloadValue(data.value);
    } catch (error) {
      console.error(packageName, error);

      return 0;
    }
  }

  private parseDownloadValue(value: string): number {
    const numberText = value.replace(NPM.PERIODS_REGEX, '');
    const cleanNumber = numberText.replace(/[^0-9.]/g, '');

    const multiplier = /k/i.test(numberText)
      ? 1_000
      : /m/i.test(numberText)
        ? 1_000_000
        : /b/i.test(numberText)
          ? 1_000_000_000
          : 1;

    return Number(cleanNumber) * multiplier;
  }

  private formatNumber(num: number, period: DownloadPeriod): string {
    const periods: Record<DownloadPeriod, string> = {
      dm: 'month',
      dy: 'year',
    };

    if (num < 1000) return `${num}/${periods[period]}`;

    const units = [
      { value: 1e9, suffix: 'B' },
      { value: 1e6, suffix: 'M' },
      { value: 1e3, suffix: 'k' },
    ];

    for (const unit of units) {
      if (num >= unit.value) {
        const val = num / unit.value;

        return val % 1 === 0
          ? `${val.toFixed(0)}${unit.suffix}/${periods[period]}`
          : `${val.toFixed(1).replace(/\.0$/, '')}${unit.suffix}/${periods[period]}`;
      }
    }

    return `${num}/${periods[period]}`;
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

      const data = await response.json();
      const batch = data.objects.map(
        (obj: { package: { name: string } }) => obj.package.name
      );

      names.push(...batch);

      if (batch.length < size) break;

      from += size;
    }

    this.cachedPackages = names;

    return names;
  }

  public async downloadsPerMonth(): Promise<DownloadInfo> {
    const downloads = await this.sumDownloads('dm');

    return {
      value: downloads,
      label: this.formatNumber(downloads, 'dm'),
    };
  }

  public async downloadsPerYear(): Promise<DownloadInfo> {
    const downloads = await this.sumDownloads('dy');

    return {
      value: downloads,
      label: this.formatNumber(downloads, 'dy'),
    };
  }
}
