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

export type SponsorEntity = {
  nodes: {
    sponsorEntity: {
      login: string;
      __typename: SponsorType;
    };
  }[];
};

export type SponsorsData = {
  users: string[];
  organizations: string[];
  fetched: Date;
};
