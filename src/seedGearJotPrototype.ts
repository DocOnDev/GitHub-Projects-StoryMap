import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repositoryOwner = "GearJot";
const repositoryName = "gearjot-v2-planning";
const projectId = "PVT_kwDOAPioDM4BXtNA";
const sliceFieldId = "PVTSSF_lADOAPioDM4BXtNAzhS4QIs";

type Issue = {
  id: string;
  node_id: string;
  number: number;
  title: string;
  url: string;
};

type ProjectItem = {
  id: string;
};

type Story = {
  title: string;
  slice: keyof typeof sliceOptions;
};

type Task = {
  title: string;
  stories: Story[];
};

type Activity = {
  title: string;
  tasks: Task[];
};

const sliceOptions = {
  Foundation: "9f5b7fd1",
  "Slice 1 - Keystone - data model": "b07e6395",
  "Slice 2 - Inspection templates": "25552109",
  "Slice 3 - Inspection flow": "ebbd100c",
  "Slice 4 - Task detail follow-ups": "d067148c",
  "Slice 5 - Telematics on the gear page": "54bdf1cb",
  "Slice 6 - Nav, filters, saved views": "5f83d472",
  "Slice 7 - Enrichment": "fdad079d",
} as const;

const map: Activity[] = [
  activity("Get oriented", [
    task("Step 1 - Land in the org", [
      story("G-003 - Activity Feed is a top-level item in the left nav", "Slice 6 - Nav, filters, saved views"),
      story("G-034 - Efficient endpoint for left-nav count badges", "Slice 6 - Nav, filters, saved views"),
      story("G-002 - Left-nav items expand with sub-items and count badges", "Slice 7 - Enrichment"),
    ]),
    task("Step 2 - Filter gear and switch views", [
      story("G-004 - Filter lists by column values", "Slice 6 - Nav, filters, saved views"),
      story("G-004 - Save a filter as a named view", "Slice 6 - Nav, filters, saved views"),
      story("G-005 - Filter carries when switching from list to map", "Slice 6 - Nav, filters, saved views"),
    ]),
  ]),
  activity("Add & connect a piece of gear", [
    task("Step 3 - Add a new piece of gear", [
      story("G-006 - Create type, make, and model inline", "Foundation"),
    ]),
    task("Step 4 - Connect telematics", [
      story("G-009 - Connect a telematics provider on a gear page", "Slice 5 - Telematics on the gear page"),
      story("G-036 - Endpoint to list provider units and link one to gear", "Slice 5 - Telematics on the gear page"),
      story("G-007 - Gear-page widget tiles", "Slice 7 - Enrichment"),
      story("G-008 - Activity feed alongside gear data", "Slice 7 - Enrichment"),
    ]),
    task("Step 5 - Use gear-scoped navigation", [
      story("G-001 - Left nav switches to a gear-scoped view", "Foundation"),
    ]),
  ]),
  activity("Set up a template", [
    task("Step 6 - Build and assign an inspection template", [
      story("G-010 - Drag question types from a right-hand palette", "Foundation"),
      story("G-011 - Assign a template to gear types, makes, models, or specific gear", "Slice 2 - Inspection templates"),
      story("G-012 - Add Yes / N/A / No and other missing question types", "Slice 2 - Inspection templates"),
    ]),
  ]),
  activity("Create a task", [
    task("Step 7 - Create a task with the right details", [
      story("G-013 - Attach an inspection template to the task at creation", "Foundation"),
      story("G-018 - Assign the task to one or more people at creation", "Foundation"),
      story("G-020 - Task description as rich text with @mentions", "Foundation"),
      story("G-024 - Two-column detail with properties card and dates", "Foundation"),
      story("G-019 mitigation - Hide the Coming soon placeholder on Attachments", "Foundation"),
      story("G-019 - Attach a file to a task at creation", "Slice 4 - Task detail follow-ups"),
    ]),
  ]),
  activity("Run an inspection", [
    task("Step 8 - Start an inspection from a task", [
      story("G-014 - Start-inspection affordance on the task detail", "Slice 3 - Inspection flow"),
      story("G-029 - Inspector sees only templates relevant to the gear", "Slice 3 - Inspection flow"),
    ]),
    task("Step 9 - Answer questions and create follow-up work", [
      story("G-035 - A task records which inspection question it came from", "Slice 1 - Keystone - data model"),
      story("G-015 - Create Task from a No answer", "Slice 3 - Inspection flow"),
      story("G-016 - See unresolved issues from prior inspections", "Slice 3 - Inspection flow"),
      story("G-030 - Fill-out preserves template page structure", "Slice 3 - Inspection flow"),
      story("G-033 - Respect reduced-motion preference", "Slice 3 - Inspection flow"),
    ]),
    task("Step 10 - Review submitted inspection results", [
      story("G-017 - Submission detail shows Reported Issues summary", "Slice 3 - Inspection flow"),
    ]),
  ]),
  activity("Follow up on a task", [
    task("Step 11 - Reassign, update status, and comment", [
      story("G-021 - Change status inline on the detail page", "Foundation"),
      story("G-022 - Show To Do instead of Open and remove Cancelled", "Foundation"),
      story("G-023 - Task description shown on the detail page", "Foundation"),
      story("G-031 - Reassign inline without leaving the detail page", "Slice 4 - Task detail follow-ups"),
      story("G-026 - Timeline labeled Status Updates", "Slice 4 - Task detail follow-ups"),
      story("G-027 - Jump back to the source inspection question", "Slice 4 - Task detail follow-ups"),
      story("G-037 - Filter the task list by inspection template", "Slice 4 - Task detail follow-ups"),
    ]),
  ]),
];

async function main() {
  for (const activityData of map) {
    const activityIssue = await createIssue(activityData.title, "Activity");
    await addToProject(activityIssue.id);

    for (const taskData of activityData.tasks) {
      const taskIssue = await createIssue(taskData.title, "Task");
      await addSubIssue(activityIssue.id, taskIssue.id);
      await addToProject(taskIssue.id);

      for (const storyData of taskData.stories) {
        const storyIssue = await createIssue(storyData.title, "Story", storyData.slice);
        await addSubIssue(taskIssue.id, storyIssue.id);
        const projectItem = await addToProject(storyIssue.id);
        await setSlice(projectItem.id, sliceOptions[storyData.slice]);
      }
    }

    console.log(`Seeded ${activityData.title}`);
  }
}

function activity(title: string, tasks: Task[]): Activity {
  return { title, tasks };
}

function task(title: string, stories: Story[]): Task {
  return { title, stories };
}

function story(title: string, slice: Story["slice"]): Story {
  return { title, slice };
}

async function createIssue(title: string, kind: "Activity" | "Task" | "Story", slice?: string): Promise<Issue> {
  const fullTitle = `[StoryMap Prototype] ${title}`;
  const existing = await findIssueByTitle(fullTitle);

  if (existing) {
    return { ...existing, id: existing.node_id };
  }

  const body = [
    "Seeded by the GitHub Projects StoryMap prototype generator.",
    "",
    `StoryMap role: ${kind}`,
    slice ? `Slice: ${slice}` : "",
    "",
    "This is a prototype planning issue for proving the StoryMap shape before changing the real GearJot backlog structure.",
  ]
    .filter(Boolean)
    .join("\n");
  const issue = await rest<Issue>(["repos", repositoryOwner, repositoryName, "issues"], "POST", {
    title: fullTitle,
    body,
  });

  return { ...issue, id: issue.node_id };
}

async function findIssueByTitle(title: string): Promise<Issue | null> {
  const issues = await rest<Issue[]>(["repos", repositoryOwner, repositoryName, "issues"], "GET", {
    state: "all",
    per_page: "100",
  });

  return issues.find((issue) => issue.title === title) ?? null;
}

async function addSubIssue(issueId: string, subIssueId: string) {
  try {
    await graphql(
      `mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
        addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) { issue { id } }
      }`,
      { issueId, subIssueId },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.toLowerCase().includes("already") &&
      !message.toLowerCase().includes("duplicate sub-issues") &&
      !message.toLowerCase().includes("only have one parent")
    ) {
      throw error;
    }
  }
}

async function addToProject(contentId: string): Promise<ProjectItem> {
  const response = await graphql<{
    data: {
      addProjectV2ItemById: {
        item: ProjectItem;
      };
    };
  }>(
    `mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId },
  );

  return response.data.addProjectV2ItemById.item;
}

async function setSlice(itemId: string, optionId: string) {
  await graphql(
    `mutation SetSlice($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId: sliceFieldId, optionId },
  );
}

async function graphql<T = unknown>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { stdout } = await execFileAsync("gh", [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    ...Object.entries(variables).flatMap(([key, value]) => [
      typeof value === "number" ? "-F" : "-f",
      `${key}=${String(value)}`,
    ]),
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
