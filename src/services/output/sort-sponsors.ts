import type {
  NodeWithValue,
  SortedSponsors,
  SponsorNode,
} from '../../types.js';

export const sortSponsors = (nodes: SponsorNode[]): SortedSponsors => {
  const activeUsers: NodeWithValue[] = [];
  const activeOrgs: NodeWithValue[] = [];
  const pastUsers: NodeWithValue[] = [];
  const pastOrgs: NodeWithValue[] = [];

  for (const node of nodes) {
    const sponsor = node.sponsorEntity;
    if (!sponsor?.login) continue;

    if (sponsor.__typename !== 'Organization' && sponsor.__typename !== 'User')
      continue;

    const isOrg = sponsor.__typename === 'Organization';
    const value = node.tier?.monthlyPriceInDollars ?? 0;

    if (node.isActive) {
      if (isOrg) {
        activeOrgs.push({ login: sponsor.login, value });
        continue;
      }

      activeUsers.push({ login: sponsor.login, value });
      continue;
    }

    if (isOrg) {
      pastOrgs.push({ login: sponsor.login, value });
      continue;
    }

    pastUsers.push({ login: sponsor.login, value });
  }

  const sortByValueDesc = (a: NodeWithValue, b: NodeWithValue) =>
    b.value - a.value;

  activeUsers.sort(sortByValueDesc);
  activeOrgs.sort(sortByValueDesc);
  pastUsers.sort(sortByValueDesc);
  pastOrgs.sort(sortByValueDesc);

  return {
    activeUsers: activeUsers.map((s) => s.login),
    activeOrgs: activeOrgs.map((s) => s.login),
    pastUsers: pastUsers.map((s) => s.login),
    pastOrgs: pastOrgs.map((s) => s.login),
  };
};
