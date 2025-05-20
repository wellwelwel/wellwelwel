import type { SponsorsData } from '../../types.js';
import { readFile, writeFile } from 'node:fs/promises';

export const generateJSON = async (data: SponsorsData) => {
  try {
    const currentSponsorsDataString = await readFile('./sponsors.json', 'utf8');
    const currentSponsorsData: SponsorsData = JSON.parse(
      currentSponsorsDataString
    );

    if (
      JSON.stringify(currentSponsorsData.active) ===
        JSON.stringify(data.active) &&
      JSON.stringify(currentSponsorsData.past) === JSON.stringify(data.past)
    )
      return false;
  } catch {}

  console.log(data);
  await writeFile('./sponsors.json', `${JSON.stringify(data, null, 2)}\n`);

  return true;
};
