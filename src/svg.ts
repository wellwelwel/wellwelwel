import type { SponsorsData } from './types.js';
import { readFile, writeFile } from 'node:fs/promises';
import { AVATAR_SIZE, generateBase64 } from './base64.js';

const AVATAR_MARGIN = 2.5;
const SPONSORS_PER_ROW = 10;

const sponsorsDataString = await readFile('./sponsors.json', 'utf8');
const data = JSON.parse(sponsorsDataString) as SponsorsData;

const allSponsors = [...data.organizations, ...data.users];
const rows = Math.ceil(allSponsors.length / SPONSORS_PER_ROW);

const svgWidth =
  (AVATAR_SIZE + AVATAR_MARGIN * 2) *
  Math.min(allSponsors.length, SPONSORS_PER_ROW);
const svgHeight = (AVATAR_SIZE + AVATAR_MARGIN * 2) * rows;

let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><title>GitHub Sponsors</title>`;

svgContent += `  <defs>`;

allSponsors.forEach((_, index) => {
  const row = Math.floor(index / SPONSORS_PER_ROW);
  const col = index % SPONSORS_PER_ROW;

  const x = col * (AVATAR_SIZE + AVATAR_MARGIN * 2) + AVATAR_MARGIN;
  const y = row * (AVATAR_SIZE + AVATAR_MARGIN * 2) + AVATAR_MARGIN;

  const centerX = x + AVATAR_SIZE / 2;
  const centerY = y + AVATAR_SIZE / 2;

  svgContent += `<clipPath id="clip-${index}"><circle cx="${centerX}" cy="${centerY}" r="${
    AVATAR_SIZE / 2
  }" /></clipPath>`;
});

svgContent += `</defs>`;
svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="transparent" />`;

for (const [index, username] of allSponsors.entries()) {
  const row = Math.floor(index / SPONSORS_PER_ROW);
  const col = index % SPONSORS_PER_ROW;

  const x = col * (AVATAR_SIZE + AVATAR_MARGIN * 2) + AVATAR_MARGIN;
  const y = row * (AVATAR_SIZE + AVATAR_MARGIN * 2) + AVATAR_MARGIN;

  const centerX = x + AVATAR_SIZE / 2;
  const centerY = y + AVATAR_SIZE / 2;

  svgContent += `<a href="https://github.com/${username}" target="_blank"><image x="${x}" y="${y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${index})" xlink:href="data:image/png;base64,${await generateBase64(username)}" ><title>${username}</title></image><circle cx="${centerX}" cy="${centerY}" r="${
    AVATAR_SIZE / 2
  }" fill="none" /></a>`;
}

svgContent += `</svg>`;

await writeFile('sponsors.svg', svgContent);

console.log(`Sponsors: ${allSponsors.length}`);
