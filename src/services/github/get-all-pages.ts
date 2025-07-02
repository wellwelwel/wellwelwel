import type {
  GitHubGraphQlPageInfo,
  GraphQlResult,
} from '../../sponsors/types.js';

export const getAllPages = async <
  Property extends string,
  Fetch extends (cursor?: string) => Promise<GraphQlResult<Property, any>>,
>(
  property: Property,
  getPage: Fetch
) => {
  const allItems: Awaited<ReturnType<Fetch>>['viewer'][Property][] = [];
  const firstPage = await getPage();

  let result = firstPage.viewer[property];
  let pageInfo: GitHubGraphQlPageInfo | undefined;

  pageInfo = result.pageInfo;

  allItems.push(result);

  while (pageInfo && pageInfo.hasNextPage) {
    const page = await getPage(pageInfo.endCursor);

    result = page.viewer[property];
    pageInfo = result.pageInfo;

    allItems.push(result);
  }

  return allItems;
};
