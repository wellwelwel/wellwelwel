import type {
  NodeWithValue,
  SortedSponsors,
  SponsorNode,
} from '../../types.js';

export const sortByValueDesc = (a: NodeWithValue, b: NodeWithValue) =>
  b.value - a.value;

export const sortSponsors = (nodes: SponsorNode[]): SortedSponsors => {
  const active: NodeWithValue[] = [];
  const past: NodeWithValue[] = [];

  for (const node of nodes) {
    const sponsor = node.sponsorEntity;
    if (!sponsor?.login) continue;

    const value = node.tier?.monthlyPriceInDollars ?? 0;
    if (value <= 0) continue;

    if (node.isActive) {
      active.push({ login: sponsor.login, value });
      continue;
    }

    past.push({ login: sponsor.login, value });
  }

  active.sort(sortByValueDesc);
  past.sort(sortByValueDesc);

  return {
    active: active.map((s) => s.login),
    past: past.map((s) => s.login),
  };
};
