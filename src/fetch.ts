// Adapted from https://github.com/privatenumber/privatenumber/blob/b67e403d65b63681acd2123e52210806cee23ad9/scripts/fetch-sponsors.ts

import type {
  GitHubGraphQlPageInfo,
  GraphQlResult,
  SponsorEntity,
  SponsorsData,
} from './types.js';
import { readFile, writeFile } from 'node:fs/promises';

const getAllPages = async <
  Property extends string,
  Fetch extends (cursor?: string) => Promise<GraphQlResult<Property, unknown>>,
>(
  property: Property,
  getPage: Fetch
) => {
  const allItems: unknown[] = [];
  let pageInfo: GitHubGraphQlPageInfo | undefined;
  do {
    const page = await getPage(pageInfo?.endCursor);
    const result = page.viewer[property];
    allItems.push(result);

    pageInfo = result.pageInfo;
  } while (pageInfo.hasNextPage);

  return allItems as Awaited<ReturnType<Fetch>>['viewer'][Property][];
};

const getSponsors = async (
  cursor?: string
): Promise<GraphQlResult<'sponsorshipsAsMaintainer', SponsorEntity>> => {
  const query = `
    query {
      viewer {
        sponsorshipsAsMaintainer(
          first: 100,
          orderBy: { field: CREATED_AT, direction: ASC },
          activeOnly: false,
          ${cursor ? `after: "${cursor}"` : ''}
        ) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            sponsorEntity {
              __typename
              ... on User { login }
              ... on Organization { login }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  return result.data as GraphQlResult<
    'sponsorshipsAsMaintainer',
    SponsorEntity
  >;
};

const resultPages = await getAllPages('sponsorshipsAsMaintainer', getSponsors);

const userSponsors: string[] = [];
const orgSponsors: string[] = [];

for (const page of resultPages) {
  for (const { sponsorEntity } of page.nodes) {
    if (sponsorEntity.__typename === 'User') {
      userSponsors.push(sponsorEntity.login);
    } else {
      orgSponsors.push(sponsorEntity.login);
    }
  }
}

const data: SponsorsData = {
  users: userSponsors,
  organizations: orgSponsors,
  fetched: new Date(),
};

const generateJSON = async () => {
  try {
    const currentSponsorsDataString = await readFile('./sponsors.json', 'utf8');
    const currentSponsorsData = JSON.parse(
      currentSponsorsDataString
    ) as SponsorsData;
    if (
      JSON.stringify(currentSponsorsData.users) ===
        JSON.stringify(data.users) &&
      JSON.stringify(currentSponsorsData.organizations) ===
        JSON.stringify(data.organizations)
    )
      return false;
  } catch {}

  console.log(data);
  await writeFile('./sponsors.json', `${JSON.stringify(data, null, 2)}\n`);

  return true;
};

await generateJSON();
