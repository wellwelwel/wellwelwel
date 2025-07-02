import type { SponsorNode, SponsorsData } from './types.js';
import { writeFile } from 'node:fs/promises';
import { getAllPages } from '../services/github/get-all-pages.js';
import { getSponsors } from '../services/github/get-sponsors.js';
import { sortSponsors } from '../services/output/sort-sponsors.js';

const resultPages = await getAllPages('sponsorshipsAsMaintainer', getSponsors);
const allNodes: SponsorNode[] = [];

for (const page of resultPages) allNodes.push(...page.nodes);

const { active, past } = sortSponsors(allNodes);

const data: SponsorsData = {
  active,
  past,
  // fetched: new Date().toISOString(),
};

await writeFile('./sponsors.json', JSON.stringify(data), 'utf8');
