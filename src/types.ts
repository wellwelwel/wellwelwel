export type GitHubGraphQlPageInfo = {
  endCursor: string;
  hasNextPage: boolean;
};

export type GraphQlResult<Property extends string, T> = {
  viewer: {
    [Key in Property]: T & {
      totalCount: number;
      pageInfo: GitHubGraphQlPageInfo;
    };
  };
};

export type SponsorType = 'User' | 'Organization';

export type SponsorNode = {
  sponsorEntity: {
    login: string;
    __typename: SponsorType;
  } | null;
  isActive: boolean;
  tier: {
    monthlyPriceInDollars: number;
  } | null;
};

export type SponsorsData = {
  fetched: string;
  active: string[];
  past: string[];
};

export type SortedSponsors = {
  active: string[];
  past: string[];
};

export type NodeWithValue = {
  login: string;
  value: number;
};
