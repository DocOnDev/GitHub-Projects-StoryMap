import type { Activity, StoryMap, Task } from "./types.js";

export function renderHtml(storyMap: StoryMap): string {
  const taskColumns = storyMap.activities.flatMap((activity) =>
    activity.tasks.map((task) => ({ activity, task })),
  );
  const generatedAt = new Date(storyMap.generatedAt).toLocaleString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(storyMap.projectTitle)} StoryMap</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #24292f;
      --muted: #57606a;
      --line: #d0d7de;
      --surface: #ffffff;
      --canvas: #f6f8fa;
      --activity: #fb8500;
      --task: #c8edf2;
      --story: #fff5a8;
      --story-border: #eac54f;
      --warning: #9a6700;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--ink);
      background: var(--canvas);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    header {
      padding: 24px 28px 18px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.2;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: var(--muted);
      font-size: 14px;
    }

    main {
      padding: 20px 28px 32px;
    }

    .diagnostics {
      max-width: 1100px;
      margin: 0 0 18px;
      padding: 14px 16px;
      background: #fff8c5;
      border: 1px solid #eac54f;
      border-radius: 8px;
    }

    .diagnostics h2 {
      margin: 0 0 8px;
      font-size: 15px;
    }

    .diagnostics ul {
      margin: 0;
      padding-left: 20px;
      color: var(--warning);
      font-size: 14px;
    }

    .map-scroll {
      overflow: auto;
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: 8px;
    }

    .story-map {
      display: grid;
      grid-template-columns: 180px repeat(${Math.max(taskColumns.length, 1)}, minmax(180px, 1fr));
      min-width: ${180 + Math.max(taskColumns.length, 1) * 180}px;
    }

    .corner,
    .activity,
    .task,
    .slice-label,
    .cell {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .corner {
      position: sticky;
      left: 0;
      z-index: 5;
      background: var(--surface);
    }

    .activity {
      min-height: 70px;
      padding: 12px;
      background: #fff3dd;
      border-top: 4px solid var(--activity);
      font-weight: 700;
    }

    .task {
      min-height: 70px;
      padding: 10px 12px;
      background: var(--task);
      font-weight: 650;
    }

    .slice-label {
      position: sticky;
      left: 0;
      z-index: 4;
      min-height: 126px;
      padding: 12px;
      background: #f0f3f6;
      font-weight: 700;
    }

    .slice-date {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
    }

    .cell {
      min-height: 126px;
      padding: 8px;
      background: var(--surface);
    }

    .story {
      display: block;
      min-height: 56px;
      margin: 0 0 8px;
      padding: 9px 10px;
      background: var(--story);
      border: 1px solid var(--story-border);
      border-radius: 4px;
      box-shadow: 0 1px 2px rgb(31 35 40 / 12%);
      font-size: 13px;
      line-height: 1.25;
    }

    .issue-number {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
    }

    .empty {
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <h1><a href="${escapeAttribute(storyMap.projectUrl)}">${escapeHtml(storyMap.projectTitle)}</a> StoryMap</h1>
    <div class="meta">
      <span>Generated ${escapeHtml(generatedAt)}</span>
      <span>${storyMap.activities.length} activities</span>
      <span>${taskColumns.length} tasks</span>
      <span>${storyMap.slices.length} slices</span>
    </div>
  </header>
  <main>
    ${renderDiagnostics(storyMap)}
    <section class="map-scroll" aria-label="Story map">
      <div class="story-map">
        ${renderHeaderRows(storyMap.activities)}
        ${storyMap.slices.map((slice) => renderSliceRow(slice.key, storyMap, taskColumns)).join("")}
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderHeaderRows(activities: Activity[]): string {
  const activityCells = activities
    .map((activity) => {
      const taskCount = activity.tasks.length;
      return `<div class="activity" style="grid-column: span ${taskCount}"><a href="${escapeAttribute(activity.issue.url)}">${escapeHtml(activity.issue.title)}</a><span class="issue-number">${escapeHtml(activity.issue.repository)}#${activity.issue.number}</span></div>`;
    })
    .join("");
  const taskCells = activities
    .flatMap((activity) => activity.tasks.map((task) => renderTask(task)))
    .join("");

  return `
    <div class="corner"></div>
    ${activityCells || '<div class="activity">No Activities</div>'}
    <div class="corner"></div>
    ${taskCells || '<div class="task">No Tasks</div>'}
  `;
}

function renderTask(task: Task): string {
  return `<div class="task"><a href="${escapeAttribute(task.issue.url)}">${escapeHtml(task.issue.title)}</a><span class="issue-number">${escapeHtml(task.issue.repository)}#${task.issue.number}</span></div>`;
}

function renderSliceRow(
  sliceKey: string,
  storyMap: StoryMap,
  taskColumns: Array<{ activity: Activity; task: Task }>,
): string {
  const slice = storyMap.slices.find((candidate) => candidate.key === sliceKey);

  if (!slice) {
    return "";
  }

  const cells = taskColumns
    .map(({ task }) => {
      const stories = task.stories.filter((story) => story.sliceKey === sliceKey);
      return `<div class="cell">${stories.map((story) => `<a class="story" href="${escapeAttribute(story.issue.url)}">${escapeHtml(story.issue.title)}<span class="issue-number">${escapeHtml(story.issue.repository)}#${story.issue.number}</span></a>`).join("")}</div>`;
    })
    .join("");

  return `
    <div class="slice-label">
      <a href="${escapeAttribute(slice.milestone.url)}">${escapeHtml(slice.milestone.title)}</a>
      <span class="slice-date">${slice.milestone.dueOn ? escapeHtml(slice.milestone.dueOn) : "No target release date"}</span>
    </div>
    ${cells || '<div class="cell"><span class="empty">No stories</span></div>'}
  `;
}

function renderDiagnostics(storyMap: StoryMap): string {
  if (storyMap.diagnostics.length === 0) {
    return "";
  }

  return `
    <section class="diagnostics">
      <h2>Diagnostics</h2>
      <ul>
        ${storyMap.diagnostics.map((diagnostic) => `<li>${diagnostic.url ? `<a href="${escapeAttribute(diagnostic.url)}">` : ""}${escapeHtml(diagnostic.message)}${diagnostic.url ? "</a>" : ""}</li>`).join("")}
      </ul>
    </section>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
