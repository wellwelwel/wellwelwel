import { NPM } from '../services/npm.js';

const npm = new NPM('weslley.io', {
  coMaintained: ['mysql2', 'named-placeholders'],
});

const data = {
  author: await npm.authorStats(),
  coMaintained: await npm.coMaintainedStats(),
  fetched: new Date().toISOString(),
};

console.log(JSON.stringify(data, null, 2));

if (
  [data.author, data.coMaintained].every(
    ({ downloadsPerMonth, downloadsPerYear }) =>
      downloadsPerMonth.value > 0 && downloadsPerYear.value > 0
  )
)
  await Bun.write('./docs/stats.json', JSON.stringify(data));
