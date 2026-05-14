import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseProjectUrl } from "./projectUrl.js";

const execFileAsync = promisify(execFile);

const repositoryOwner = "DocOnDev";
const repositoryName = "GitHub-Projects-StoryMap";
const projectUrl = "https://github.com/users/DocOnDev/projects/8";

type ProjectInfo = {
  id: string;
  itemIds: string[];
};

type Issue = {
  id: string;
  node_id: string;
  number: number;
  title: string;
  url: string;
};

type Milestone = {
  number: number;
  title: string;
};

type ExampleStory = {
  title: string;
  release: string;
};

type ExampleTask = {
  title: string;
  stories: ExampleStory[];
};

type ExampleActivity = {
  title: string;
  tasks: ExampleTask[];
};

const releases = [
  { title: "Release 1", dueOn: "2026-05-21T00:00:00Z" },
  { title: "Release 2", dueOn: "2026-05-28T00:00:00Z" },
  { title: "Release 3", dueOn: "2026-06-04T00:00:00Z" },
];

const example: ExampleActivity[] = [
  {
    title: "Organize Email",
    tasks: [
      {
        title: "Search Email",
        stories: [
          story("Search by Keyword", "Release 1"),
          story("Limit Search to one field", "Release 2"),
          story("Limit Search to 1+ fields", "Release 2"),
          story("Search attachments", "Release 3"),
          story("Search sub folders", "Release 3"),
        ],
      },
      {
        title: "File Emails",
        stories: [
          story("Move Emails", "Release 1"),
          story("Create sub folders", "Release 1"),
        ],
      },
    ],
  },
  {
    title: "Manage Email",
    tasks: [
      {
        title: "Compose Email",
        stories: [
          story("Create and send basic email", "Release 1"),
          story("Send RTF e-mail", "Release 1"),
          story("Send HTML e-mail", "Release 2"),
          story("Set email priority", "Release 2"),
          story("Get address from contacts", "Release 3"),
          story("Send Attachments", "Release 3"),
        ],
      },
      {
        title: "Read Email",
        stories: [
          story("Open basic email", "Release 1"),
          story("Open RTF e-mail", "Release 1"),
          story("Open HTML e-mail", "Release 2"),
          story("Open Attachments", "Release 2"),
        ],
      },
      {
        title: "Delete Email",
        stories: [
          story("Delete email", "Release 1"),
          story("Empty Deleted Items", "Release 2"),
        ],
      },
    ],
  },
  {
    title: "Manage Calendar",
    tasks: [
      {
        title: "View Calendar",
        stories: [
          story("View list of appts", "Release 1"),
          story("View Monthly formats", "Release 1"),
          story("View Daily Format", "Release 2"),
          story("View Weekly Formats", "Release 3"),
          story("Search Calendar", "Release 3"),
        ],
      },
      {
        title: "Create Appt",
        stories: [
          story("Create basic appt", "Release 1"),
          story("Create RTF appt", "Release 1"),
          story("Create HTML appt", "Release 2"),
          story("Mandatory/Optional", "Release 2"),
          story("Get address from contacts", "Release 3"),
          story("Add Attachments", "Release 3"),
        ],
      },
      {
        title: "Update Appt",
        stories: [
          story("Update contents/location", "Release 1"),
          story("Propose new time", "Release 2"),
        ],
      },
      {
        title: "View Appt",
        stories: [
          story("View Appt", "Release 1"),
          story("Accept/Reject/Tentative", "Release 1"),
          story("View Attachments", "Release 3"),
        ],
      },
    ],
  },
  {
    title: "Manage Contacts",
    tasks: [
      {
        title: "Create Contact",
        stories: [
          story("Create basic contact", "Release 1"),
          story("Add address data", "Release 2"),
          story("Import Contacts", "Release 3"),
          story("Export Contacts", "Release 3"),
        ],
      },
      {
        title: "Update Contact",
        stories: [
          story("Update contact info", "Release 1"),
          story("Update Address Info", "Release 2"),
        ],
      },
      {
        title: "Delete Contact",
        stories: [story("Delete Contact", "Release 2")],
      },
    ],
  },
];

async function main() {
  const locator = parseProjectUrl(projectUrl);
  const project = await getProject(locator.owner, locator.number);

  console.log(`Clearing ${project.itemIds.length} existing Project items...`);
  for (const itemId of project.itemIds) {
    await graphql(
      `mutation DeleteProjectItem($projectId: ID!, $itemId: ID!) {
        deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
          deletedItemId
        }
      }`,
      { projectId: project.id, itemId },
    );
  }

  const milestones = new Map<string, Milestone>();
  for (const release of releases) {
    milestones.set(release.title, await upsertMilestone(release.title, release.dueOn));
  }

  for (const activityData of example) {
    const activity = await createIssue(activityData.title);
    await addToProject(project.id, activity.id);

    for (const taskData of activityData.tasks) {
      const task = await createIssue(taskData.title);
      await addSubIssue(activity.id, task.id);

      for (const storyData of taskData.stories) {
        const milestone = milestones.get(storyData.release);
        if (!milestone) {
          throw new Error(`Unknown release: ${storyData.release}`);
        }

        const storyIssue = await createIssue(storyData.title, milestone.number);
        await addSubIssue(task.id, storyIssue.id);
      }
    }

    console.log(`Seeded ${activity.title}`);
  }
}

function story(title: string, release: string): ExampleStory {
  return { title, release };
}

async function getProject(owner: string, number: number): Promise<ProjectInfo> {
  const response = await graphql<{
    data: {
      user: {
        projectV2: {
          id: string;
          items: { nodes: Array<{ id: string }> };
        };
      };
    };
  }>(
    `query Project($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          items(first: 100) { nodes { id } }
        }
      }
    }`,
    { owner, number },
  );

  return {
    id: response.data.user.projectV2.id,
    itemIds: response.data.user.projectV2.items.nodes.map((item) => item.id),
  };
}

async function upsertMilestone(title: string, dueOn: string): Promise<Milestone> {
  const milestones = await rest<Array<{ number: number; title: string }>>(
    ["repos", repositoryOwner, repositoryName, "milestones"],
    "GET",
    { state: "all", per_page: "100" },
  );
  const existing = milestones.find((milestone) => milestone.title === title);

  if (existing) {
    await rest(["repos", repositoryOwner, repositoryName, "milestones", String(existing.number)], "PATCH", {
      title,
      due_on: dueOn,
      state: "open",
    });
    return existing;
  }

  const created = await rest<Milestone>(["repos", repositoryOwner, repositoryName, "milestones"], "POST", {
    title,
    due_on: dueOn,
  });

  return created;
}

async function createIssue(title: string, milestoneNumber?: number): Promise<Issue> {
  const fields: Record<string, string> = {
    title,
    body: "Seeded by the GitHub Projects StoryMap example generator.",
  };

  if (milestoneNumber) {
    fields.milestone = String(milestoneNumber);
  }

  const issue = await rest<Issue>(["repos", repositoryOwner, repositoryName, "issues"], "POST", fields);

  return {
    ...issue,
    id: issue.node_id,
  };
}

async function addSubIssue(issueId: string, subIssueId: string) {
  await graphql(
    `mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
      addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
        issue { id }
      }
    }`,
    { issueId, subIssueId },
  );
}

async function addToProject(projectId: string, contentId: string) {
  await graphql(
    `mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId },
  );
}

async function graphql<T = unknown>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { stdout } = await execFileAsync("gh", [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    ...Object.entries(variables).flatMap(([key, value]) => ["-F", `${key}=${String(value)}`]),
  ]);
  const parsed = JSON.parse(stdout) as T & { errors?: Array<{ message: string }> };

  if (parsed.errors?.length) {
    throw new Error(parsed.errors.map((error) => error.message).join("\n"));
  }

  return parsed;
}

async function rest<T = unknown>(
  pathParts: string[],
  method: "GET" | "PATCH" | "POST",
  fields: Record<string, string> = {},
): Promise<T> {
  const args = ["api", "--method", method, pathParts.map(encodeURIComponent).join("/")];

  for (const [key, value] of Object.entries(fields)) {
    args.push("-f", `${key}=${value}`);
  }

  const { stdout } = await execFileAsync("gh", args);

  return JSON.parse(stdout) as T;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
