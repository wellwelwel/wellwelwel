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

export type NodeWithValue = {
  login: string;
  value: number;
};

export type SponsorNode = {
  sponsorEntity: {
    login: string;
  } | null;
  isActive: boolean;
  tier: {
    monthlyPriceInDollars: number;
  } | null;
};

export type SortedSponsors = {
  active: string[];
  past: string[];
};

export type SponsorsData = {
  fetched: string;
} & SortedSponsors;
