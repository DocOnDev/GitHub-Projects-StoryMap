import type {
  Activity,
  Diagnostic,
  GithubIssue,
  GithubProject,
  Slice,
  StoryMap,
  Task,
} from "./types.js";

export function buildStoryMap(project: GithubProject): StoryMap {
  const diagnostics: Diagnostic[] = [];
  const slicesByKey = new Map<string, Slice>();
  const sliceOptionsByName = new Map(project.sliceOptions.map((option) => [option.name, option]));
  const projectIssueIds = new Set(project.items.map((issue) => issue.id));
  const activities: Activity[] = [];

  for (const issue of project.items) {
    if (issue.parent) {
      continue;
    }

    const tasks = issue.subIssues.flatMap((subIssue) =>
      toTask(subIssue, slicesByKey, sliceOptionsByName, diagnostics),
    );

    if (tasks.length > 0) {
      activities.push({ issue, tasks });
    }
  }

  for (const issue of project.items) {
    if (issue.parent && !projectIssueIds.has(issue.parent.id)) {
      diagnostics.push({
        severity: "warning",
        message: `Parent issue for ${issueLabel(issue)} is not present in the Project.`,
        url: issue.url,
      });
    }

    if (!isRecognized(project.items, issue, sliceOptionsByName)) {
      diagnostics.push({
        severity: "info",
        message: `${issueLabel(issue)} is not part of a recognized Activity -> Task -> Story chain.`,
        url: issue.url,
      });
    }
  }

  const slices = [...slicesByKey.values()].sort(compareSlices);

  for (const slice of slices) {
    if (slice.sequence === null) {
      diagnostics.push({
        severity: "warning",
        message: `Slice "${slice.title}" is not in the Project Slice option list, so its sequence is ambiguous.`,
        url: slice.url,
      });
    }
  }

  if (activities.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "No Activities found. Add top-level Project issues with child Tasks and Slice-backed Stories.",
    });
  }

  return {
    projectTitle: project.title,
    projectUrl: project.url,
    generatedAt: new Date().toISOString(),
    activities,
    slices,
    diagnostics,
  };
}

function toTask(
  issue: GithubIssue,
  slicesByKey: Map<string, Slice>,
  sliceOptionsByName: Map<string, { id: string; name: string; sequence: number }>,
  diagnostics: Diagnostic[],
): Task[] {
  const stories = issue.subIssues.flatMap((subIssue) => toStory(subIssue, slicesByKey, sliceOptionsByName));

  if (stories.length === 0) {
    diagnostics.push({
      severity: "info",
      message: `${issueLabel(issue)} is a child issue, but it has no Slice-backed Stories.`,
      url: issue.url,
    });
    return [];
  }

  return [{ issue, stories }];
}

function toStory(
  issue: GithubIssue,
  slicesByKey: Map<string, Slice>,
  sliceOptionsByName: Map<string, { id: string; name: string; sequence: number }>,
) {
  const slice = issueSlice(issue, sliceOptionsByName);

  if (!slice) {
    return [];
  }

  if (!slicesByKey.has(slice.key)) {
    slicesByKey.set(slice.key, slice);
  } else {
    const existing = slicesByKey.get(slice.key);
    if (existing && existing.sequence === null && slice.sequence !== null) {
      existing.sequence = slice.sequence;
    }
  }

  return [{ issue, sliceKey: slice.key }];
}

function isRecognized(
  projectIssues: GithubIssue[],
  issue: GithubIssue,
  sliceOptionsByName: Map<string, { id: string; name: string; sequence: number }>,
): boolean {
  for (const activity of projectIssues) {
    if (activity.parent) {
      continue;
    }

    if (activity.id === issue.id) {
      return activity.subIssues.some((task) =>
        task.subIssues.some((story) => issueSlice(story, sliceOptionsByName)),
      );
    }

    for (const task of activity.subIssues) {
      if (task.id === issue.id) {
        return task.subIssues.some((story) => issueSlice(story, sliceOptionsByName));
      }

      if (task.subIssues.some((story) => story.id === issue.id && issueSlice(story, sliceOptionsByName))) {
        return true;
      }
    }
  }

  return false;
}

function compareSlices(left: Slice, right: Slice): number {
  const leftSequence = left.sequence;
  const rightSequence = right.sequence;

  if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  if (leftSequence !== null && rightSequence === null) {
    return -1;
  }

  if (leftSequence === null && rightSequence !== null) {
    return 1;
  }

  const titleComparison = left.title.localeCompare(right.title);

  if (titleComparison !== 0) {
    return titleComparison;
  }

  return left.key.localeCompare(right.key);
}

function issueSlice(
  issue: GithubIssue,
  sliceOptionsByName: Map<string, { id: string; name: string; sequence: number }>,
): Slice | null {
  if (issue.projectFields.slice) {
    const option = sliceOptionsByName.get(issue.projectFields.slice);

    return {
      key: `project-field:${issue.projectFields.slice}`,
      title: issue.projectFields.slice,
      sequence: option?.sequence ?? null,
      source: "project-field",
    };
  }

  if (issue.milestone) {
    return {
      key: `milestone:${issue.milestone.id}`,
      title: issue.milestone.title,
      sequence: null,
      url: issue.milestone.url,
      source: "milestone",
    };
  }

  return null;
}

function issueLabel(issue: GithubIssue): string {
  return `${issue.repository}#${issue.number} "${issue.title}"`;
}
