import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  GithubIssue,
  GithubProject,
  ProjectFieldValues,
  ProjectLocator,
  ProjectSliceOption,
} from "./types.js";

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
    fields: {
      nodes: ProjectFieldNode[];
    };
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
  fieldValues: {
    nodes: ProjectFieldValueNode[];
  };
};

type ProjectFieldValueNode =
  | {
      __typename: "ProjectV2ItemFieldSingleSelectValue";
      name: string;
      field: ProjectFieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldDateValue";
      date: string;
      field: ProjectFieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldTextValue";
      text: string;
      field: ProjectFieldNode | null;
    }
  | {
      __typename: string;
      field?: ProjectFieldNode | null;
    };

type ProjectFieldNode = {
  __typename?: string;
  id?: string;
  name: string;
  dataType: string;
  options?: Array<{
    id: string;
    name: string;
  }>;
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
  const rootIssueIds: string[] = [];
  const projectFieldsByIssueId = new Map<string, ProjectFieldValues>();
  let sliceOptions: ProjectSliceOption[] = [];
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
    sliceOptions = readSliceOptions(project.fields.nodes);

    for (const item of project.items.nodes) {
      if (item.content?.__typename !== "Issue") {
        continue;
      }

      projectFieldsByIssueId.set(item.content.id, readProjectFieldValues(item.fieldValues.nodes));

      if (!item.content.parent && hasSubIssues(item.content)) {
        rootIssueIds.push(item.content.id);
      }
    }

    cursor = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);

  const rootIssues = await Promise.all(
    dedupeIds(rootIssueIds).map((issueId) => fetchIssueTree(issueId, projectFieldsByIssueId)),
  );

  return {
    title: projectTitle,
    url: projectUrl,
    sliceOptions,
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
          fields(first: 50) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { id name dataType }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options { id name }
              }
            }
          }
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name dataType } }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field { ... on ProjectV2FieldCommon { name dataType } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { name dataType } }
                  }
                }
              }
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

async function fetchIssueTree(
  issueId: string,
  projectFieldsByIssueId: Map<string, ProjectFieldValues>,
): Promise<GithubIssue> {
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

  return toIssue(response.data.node, projectFieldsByIssueId);
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

function toIssue(node: GithubIssueNode, projectFieldsByIssueId: Map<string, ProjectFieldValues>): GithubIssue {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    repository: node.repository.nameWithOwner,
    milestone: node.milestone,
    projectFields: projectFieldsByIssueId.get(node.id) ?? emptyProjectFields(),
    parent: node.parent
      ? {
          id: node.parent.id,
          number: node.parent.number,
          title: node.parent.title,
          url: node.parent.url,
          repository: node.parent.repository.nameWithOwner,
        }
      : null,
    subIssues: node.subIssues?.nodes.filter(isIssueNode).map((subIssue) => toIssue(subIssue, projectFieldsByIssueId)) ?? [],
  };
}

function readProjectFieldValues(values: ProjectFieldValueNode[]): ProjectFieldValues {
  const projectFields = emptyProjectFields();

  for (const value of values) {
    const fieldName = value.field?.name.toLowerCase();

    if (!fieldName) {
      continue;
    }

    if (isSingleSelectValue(value) && isSliceField(fieldName)) {
      projectFields.slice = value.name;
    }

    if (isTextValue(value) && isSliceField(fieldName)) {
      projectFields.slice = value.text;
    }

  }

  return projectFields;
}

function emptyProjectFields(): ProjectFieldValues {
  return {
    slice: null,
  };
}

function isSliceField(fieldName: string): boolean {
  return ["slice", "release"].includes(fieldName);
}

function isSingleSelectValue(
  value: ProjectFieldValueNode,
): value is Extract<ProjectFieldValueNode, { __typename: "ProjectV2ItemFieldSingleSelectValue" }> {
  return value.__typename === "ProjectV2ItemFieldSingleSelectValue" && "name" in value;
}

function isTextValue(
  value: ProjectFieldValueNode,
): value is Extract<ProjectFieldValueNode, { __typename: "ProjectV2ItemFieldTextValue" }> {
  return value.__typename === "ProjectV2ItemFieldTextValue" && "text" in value;
}

function readSliceOptions(fields: ProjectFieldNode[]): ProjectSliceOption[] {
  const sliceField = fields.find(
    (field) => field.__typename === "ProjectV2SingleSelectField" && field.name.toLowerCase() === "slice",
  );

  return (
    sliceField?.options?.map((option, index) => ({
      id: option.id,
      name: option.name,
      sequence: index,
    })) ?? []
  );
}

function hasSubIssues(issue: GithubIssueNode): boolean {
  return Boolean(issue.subIssues?.totalCount);
}

function dedupeIssues(issues: GithubIssue[]): GithubIssue[] {
  return [...new Map(issues.map((issue) => [issue.id, issue])).values()];
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function isIssueNode(node: Partial<GithubIssueNode>): node is GithubIssueNode {
  return typeof node.title === "string";
}
