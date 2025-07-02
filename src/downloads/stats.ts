import { writeFile } from 'node:fs/promises';
import { NPM } from 'src/services/npm.js';

const npm = new NPM('weslley.io');

const data = {
  packages: await npm.packages(),
  downloadsPerMonth: await npm.downloadsPerMonth(),
  downloadsPerYear: await npm.downloadsPerYear(),
  // fetched: new Date().toISOString(),
};

if (data.downloadsPerMonth.value > 0 && data.downloadsPerYear.value > 0)
  await writeFile('./docs/stats.json', JSON.stringify(data), 'utf8');
