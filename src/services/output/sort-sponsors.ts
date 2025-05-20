import type {
  NodeWithValue,
  SortedSponsors,
  SponsorNode,
} from '../../types.js';

export const sortSponsors = (nodes: SponsorNode[]): SortedSponsors => {
  const active: NodeWithValue[] = [];
  const past: NodeWithValue[] = [];

  for (const node of nodes) {
    const sponsor = node.sponsorEntity;
    if (!sponsor?.login) continue;

    if (sponsor.__typename !== 'Organization' && sponsor.__typename !== 'User')
      continue;

    const value = node.tier?.monthlyPriceInDollars ?? 0;

    if (node.isActive) {
      active.push({ login: sponsor.login, value });
      continue;
    }

    past.push({ login: sponsor.login, value });
  }

  const sortByValueDesc = (a: NodeWithValue, b: NodeWithValue) =>
    b.value - a.value;

  active.sort(sortByValueDesc);
  past.sort(sortByValueDesc);

  return {
    active: active.map((s) => s.login),
    past: past.map((s) => s.login),
  };
};
