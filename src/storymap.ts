import type {
  Activity,
  Diagnostic,
  GithubIssue,
  GithubMilestone,
  GithubProject,
  Slice,
  StoryMap,
  Task,
} from "./types.js";

export function buildStoryMap(project: GithubProject): StoryMap {
  const diagnostics: Diagnostic[] = [];
  const slicesByKey = new Map<string, Slice>();
  const projectIssueIds = new Set(project.items.map((issue) => issue.id));
  const activities: Activity[] = [];

  for (const issue of project.items) {
    if (issue.parent) {
      continue;
    }

    const tasks = issue.subIssues.flatMap((subIssue) => toTask(subIssue, slicesByKey, diagnostics));

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

    if (!isRecognized(project.items, issue)) {
      diagnostics.push({
        severity: "info",
        message: `${issueLabel(issue)} is not part of a recognized Activity -> Task -> Story chain.`,
        url: issue.url,
      });
    }
  }

  const slices = [...slicesByKey.values()].sort(compareSlices);

  for (const slice of slices) {
    if (!slice.milestone.dueOn) {
      diagnostics.push({
        severity: "warning",
        message: `Slice "${slice.milestone.title}" has no due date, so its sequence is ambiguous.`,
        url: slice.milestone.url,
      });
    }
  }

  if (activities.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "No Activities found. Add top-level Project issues with child Tasks and Milestone-backed Stories.",
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
  diagnostics: Diagnostic[],
): Task[] {
  const stories = issue.subIssues.flatMap((subIssue) => toStory(subIssue, slicesByKey));

  if (stories.length === 0) {
    diagnostics.push({
      severity: "info",
      message: `${issueLabel(issue)} is a child issue, but it has no Milestone-backed Stories.`,
      url: issue.url,
    });
    return [];
  }

  return [{ issue, stories }];
}

function toStory(issue: GithubIssue, slicesByKey: Map<string, Slice>) {
  if (!issue.milestone) {
    return [];
  }

  const sliceKey = milestoneKey(issue.milestone);

  if (!slicesByKey.has(sliceKey)) {
    slicesByKey.set(sliceKey, {
      key: sliceKey,
      milestone: issue.milestone,
    });
  }

  return [{ issue, sliceKey }];
}

function isRecognized(projectIssues: GithubIssue[], issue: GithubIssue): boolean {
  for (const activity of projectIssues) {
    if (activity.parent) {
      continue;
    }

    if (activity.id === issue.id) {
      return activity.subIssues.some((task) => task.subIssues.some((story) => story.milestone));
    }

    for (const task of activity.subIssues) {
      if (task.id === issue.id) {
        return task.subIssues.some((story) => story.milestone);
      }

      if (task.subIssues.some((story) => story.id === issue.id && story.milestone)) {
        return true;
      }
    }
  }

  return false;
}

function compareSlices(left: Slice, right: Slice): number {
  const leftDate = left.milestone.dueOn ?? "";
  const rightDate = right.milestone.dueOn ?? "";

  if (leftDate && rightDate && leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  if (leftDate && !rightDate) {
    return -1;
  }

  if (!leftDate && rightDate) {
    return 1;
  }

  const titleComparison = left.milestone.title.localeCompare(right.milestone.title);

  if (titleComparison !== 0) {
    return titleComparison;
  }

  return left.milestone.number - right.milestone.number;
}

function milestoneKey(milestone: GithubMilestone): string {
  return milestone.id;
}

function issueLabel(issue: GithubIssue): string {
  return `${issue.repository}#${issue.number} "${issue.title}"`;
}
