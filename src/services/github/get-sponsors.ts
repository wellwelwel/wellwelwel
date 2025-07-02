import type { GraphQlResult, SponsorNode } from '../../sponsors/types.js';

export const getSponsors = async (
  cursor?: string
): Promise<
  GraphQlResult<'sponsorshipsAsMaintainer', { nodes: SponsorNode[] }>
> => {
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
            isActive
            tier { monthlyPriceInDollars }
            sponsorEntity {
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

  if (result.errors)
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);

  return result.data as GraphQlResult<
    'sponsorshipsAsMaintainer',
    { nodes: SponsorNode[] }
  >;
};
