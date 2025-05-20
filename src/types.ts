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
  active: {
    users: string[];
    organizations: string[];
  };
  past: {
    users: string[];
    organizations: string[];
  };
};

export type SortedSponsors = {
  activeUsers: string[];
  activeOrgs: string[];
  pastUsers: string[];
  pastOrgs: string[];
};

export type NodeWithValue = {
  login: string;
  value: number;
};
