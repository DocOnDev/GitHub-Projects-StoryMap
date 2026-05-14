import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GithubIssue, GithubProject, ProjectLocator } from "./types.js";

const execFileAsync = promisify(execFile);

type ProjectResponse = {
  data?: {
    user?: ProjectOwner | null;
    organization?: ProjectOwner | null;
  };
};

type ProjectOwner = {
  projectV2: {
    title: string;
    url: string;
    items: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: ProjectItemNode[];
    };
  } | null;
};

type ProjectItemNode = {
  content: GithubIssueNode | null;
};

type IssueTreeResponse = {
  data?: {
    node?: GithubIssueNode | null;
  };
};

type GithubIssueNode = {
  __typename: "Issue";
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  repository: { nameWithOwner: string };
  milestone: GithubMilestoneNode | null;
  parent: GithubIssueRefNode | null;
  subIssues?: {
    totalCount: number;
    nodes: GithubIssueNode[];
  };
};

type GithubMilestoneNode = {
  id: string;
  number: number;
  title: string;
  url: string;
  dueOn: string | null;
  state: string;
};

type GithubIssueRefNode = {
  id: string;
  number: number;
  title: string;
  url: string;
  repository: { nameWithOwner: string };
};

const issueFragment = `
  id
  number
  title
  url
  state
  repository { nameWithOwner }
  milestone { id number title url dueOn state }
  parent {
    id
    number
    title
    url
    repository { nameWithOwner }
  }
`;

export async function fetchProject(locator: ProjectLocator): Promise<GithubProject> {
  const rootIssues: GithubIssue[] = [];
  let projectTitle = "";
  let projectUrl = "";
  let cursor: string | null = null;

  do {
    const response: ProjectResponse = await graphql<ProjectResponse>(projectItemsQuery(locator.ownerKind), {
      owner: locator.owner,
      number: locator.number,
      cursor: cursor ?? "",
    });
    const owner: ProjectOwner | null | undefined =
      locator.ownerKind === "user" ? response.data?.user : response.data?.organization;
    const project: ProjectOwner["projectV2"] | null | undefined = owner?.projectV2;

    if (!project) {
      throw new Error(`Could not find Project ${locator.owner}/${locator.number}`);
    }

    projectTitle = project.title;
    projectUrl = project.url;

    for (const item of project.items.nodes) {
      if (item.content?.__typename === "Issue" && !item.content.parent && hasSubIssues(item.content)) {
        rootIssues.push(await fetchIssueTree(item.content.id));
      }
    }

    cursor = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);

  return {
    title: projectTitle,
    url: projectUrl,
    items: dedupeIssues(rootIssues),
  };
}

function projectItemsQuery(ownerKind: ProjectLocator["ownerKind"]) {
  const ownerField = ownerKind === "user" ? "user" : "organization";

  return `
    query StoryMapProjectItems($owner: String!, $number: Int!, $cursor: String) {
      ${ownerField}(login: $owner) {
        projectV2(number: $number) {
          title
          url
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              content {
                __typename
                ... on Issue {
                  ${issueFragment}
                  subIssues(first: 1) { totalCount nodes { id } }
                }
              }
            }
          }
        }
      }
    }
  `;
}

async function fetchIssueTree(issueId: string): Promise<GithubIssue> {
  const response = await graphql<IssueTreeResponse>(
    `
      query IssueTree($issueId: ID!) {
        node(id: $issueId) {
          __typename
          ... on Issue {
            ${issueFragment}
            subIssues(first: 50) {
              totalCount
              nodes {
                ${issueFragment}
                subIssues(first: 50) {
                  totalCount
                  nodes {
                    ${issueFragment}
                    subIssues(first: 1) { totalCount nodes { id } }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { issueId },
  );

  if (response.data?.node?.__typename !== "Issue") {
    throw new Error(`Could not fetch issue tree for ${issueId}`);
  }

  return toIssue(response.data.node);
}

async function graphql<T>(graphqlQuery: string, variables: Record<string, unknown>): Promise<T> {
  const { stdout } = await execFileAsync("gh", [
    "api",
    "graphql",
    "-f",
    `query=${graphqlQuery}`,
    ...Object.entries(variables).flatMap(([key, value]) => ["-F", `${key}=${String(value)}`]),
  ]);
  const parsed = JSON.parse(stdout) as T & { errors?: Array<{ message: string }> };

  if (parsed.errors?.length) {
    throw new Error(parsed.errors.map((error) => error.message).join("\n"));
  }

  return parsed;
}

function toIssue(node: GithubIssueNode): GithubIssue {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    repository: node.repository.nameWithOwner,
    milestone: node.milestone,
    parent: node.parent
      ? {
          id: node.parent.id,
          number: node.parent.number,
          title: node.parent.title,
          url: node.parent.url,
          repository: node.parent.repository.nameWithOwner,
        }
      : null,
    subIssues: node.subIssues?.nodes.filter(isIssueNode).map(toIssue) ?? [],
  };
}

function hasSubIssues(issue: GithubIssueNode): boolean {
  return Boolean(issue.subIssues?.totalCount);
}

function dedupeIssues(issues: GithubIssue[]): GithubIssue[] {
  return [...new Map(issues.map((issue) => [issue.id, issue])).values()];
}

function isIssueNode(node: Partial<GithubIssueNode>): node is GithubIssueNode {
  return typeof node.title === "string";
}
