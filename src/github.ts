import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GithubIssue, GithubProject, ProjectLocator } from "./types.js";

const execFileAsync = promisify(execFile);

type GraphqlResponse = {
  data?: {
    user?: ProjectOwner | null;
    organization?: ProjectOwner | null;
  };
  errors?: Array<{ message: string }>;
};

type ProjectOwner = {
  projectV2: {
    title: string;
    url: string;
    items: {
      nodes: Array<{
        content: GithubIssueNode | null;
      }>;
    };
  } | null;
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

function projectQuery(ownerKind: ProjectLocator["ownerKind"]) {
  const ownerField = ownerKind === "user" ? "user" : "organization";

  return `
  query StoryMapProject($owner: String!, $number: Int!) {
    ${ownerField}(login: $owner) {
      projectV2(number: $number) {
        title
        url
        items(first: 50) {
          nodes {
            content {
              __typename
              ... on Issue {
                ${issueFragment}
                subIssues(first: 40) {
                  nodes {
                    ${issueFragment}
                    subIssues(first: 40) {
                      nodes {
                        ${issueFragment}
                        subIssues(first: 1) { nodes { id } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
}

export async function fetchProject(locator: ProjectLocator): Promise<GithubProject> {
  const response = await graphql<GraphqlResponse>(projectQuery(locator.ownerKind), {
    owner: locator.owner,
    number: locator.number,
  });

  const owner = locator.ownerKind === "user" ? response.data?.user : response.data?.organization;
  const project = owner?.projectV2;

  if (!project) {
    throw new Error(`Could not find Project ${locator.owner}/${locator.number}`);
  }

  return {
    title: project.title,
    url: project.url,
    items: project.items.nodes.flatMap((item) => {
      if (item.content?.__typename !== "Issue") {
        return [];
      }

      return [toIssue(item.content)];
    }),
  };
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

function isIssueNode(node: Partial<GithubIssueNode>): node is GithubIssueNode {
  return typeof node.title === "string";
}
