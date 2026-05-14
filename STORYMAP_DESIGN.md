# GitHub Projects StoryMap Design

## Purpose

This app visualizes a GitHub Project as a user story map.

The source of truth is GitHub. The app should use native GitHub Project, issue,
sub-issue, and milestone concepts wherever possible. Custom Project fields are an
escape hatch, not the foundation.

## Core Model

The app requires a GitHub Project URL as input.

Example:

```text
https://github.com/users/DocOnDev/projects/8
```

The Project is the planning boundary. A repository is not required as an input.
Repositories are discovered from the issues contained in the Project.

StoryMap concepts map to GitHub concepts like this:

| StoryMap concept | GitHub concept |
| --- | --- |
| Activity | Project issue with no parent and at least one child Task |
| Task | Child issue with at least one child Story |
| Story | Child issue assigned to a Milestone |
| Slice | GitHub Milestone |
| Slice sequence | Milestone due date |
| Task order | Native sub-issue order under an Activity |
| Story priority | Native sub-issue order under a Task |
| Status | Native Project Status field |

No explicit issue labels, title prefixes, or custom fields are required to
identify Activity, Task, and Story roles.

## Discovery Rules

Given a Project:

1. Fetch Project items.
2. For each issue item, fetch its parent issue, sub-issues, milestone, and
   repository.
3. Treat an issue as an Activity when it has no parent and has at least one child
   issue that qualifies as a Task.
4. Treat an issue as a Task when it is a child issue and has at least one child
   issue assigned to a Milestone.
5. Treat an issue as a Story when it is a child issue assigned to a Milestone.
6. Treat each Milestone referenced by a Story as a Slice.
7. Order Slices by Milestone due date.
8. Order Tasks and Stories by GitHub's native sub-issue order.

## Slice Sequencing

Slices are ordered by Milestone due date.

Milestone numbers are not suitable as the primary sequence because GitHub assigns
them in creation order. If a team discovers a new earlier slice after later
Milestones already exist, the new Milestone number will not reflect the intended
StoryMap order.

Due dates are a native GitHub field and can order slices independently of
creation order. In the UI, this should be presented as a target release date, not
as an iteration or batching mechanism.

Fallback ordering for Slices:

1. Milestone due date.
2. Milestone title.
3. Milestone number.

The app should clearly surface Slices without due dates because their sequence is
ambiguous.

## First Slice: CLI Static HTML Visualization

The first implementation slice is a read-only CLI that generates a static HTML
StoryMap.

This is the fastest path to something teams can look at and share. The CLI uses
local `gh` authentication, so the app does not need to solve hosted OAuth before
the StoryMap model is proven.

Input:

```text
GitHub Project URL
```

Behavior:

1. Parse the Project URL.
2. Fetch the GitHub Project through GraphQL.
3. Fetch Project items and issue hierarchy.
4. Build the StoryMap model.
5. Render Activities and Tasks as the horizontal spine.
6. Render Stories under Tasks, grouped by Slice.
7. Render Slice rows ordered by Milestone due date.
8. Link Activity, Task, Story, and Slice elements back to GitHub.
9. Write a standalone HTML file.

The first slice should not mutate GitHub data.

Example:

```sh
npm run storymap -- https://github.com/users/DocOnDev/projects/8 --out out/storymap.html
```

## Diagnostics

The viewer should make missing or ambiguous data visible.

Useful diagnostics:

- No Activities found.
- Task issue has no Stories.
- Story issue has no Milestone.
- Milestone has no due date.
- Story parent is not present in the Project.
- Task parent is not present in the Project.
- A Project item is not part of a recognized Activity -> Task -> Story chain.

## Future Editor Mode

The longer-term goal is to allow StoryMap adjustments from the app while still
storing the data in GitHub.

Potential interactions:

| User action | GitHub operation |
| --- | --- |
| Move Story to another Slice | Update issue milestone |
| Reorder Stories under a Task | `reprioritizeSubIssue` |
| Move Story to another Task | Change sub-issue parent |
| Reorder Tasks under an Activity | `reprioritizeSubIssue` |
| Move Task to another Activity | Change sub-issue parent |
| Create Slice | Create Milestone in the relevant repository |
| Rename Slice | Update Milestone title |
| Change Slice sequence | Update Milestone due date |
| Create Story | Create issue, assign Milestone, add as sub-issue |
| Create Task | Create issue, add as sub-issue of Activity |
| Create Activity | Create top-level issue |

Repository selection is only needed when creating new GitHub objects and the
target repository cannot be inferred from the current Activity, Task, or Story.

## Proven Against GitHub

This model was proven against:

```text
Project: https://github.com/users/DocOnDev/projects/8
Repo:    https://github.com/DocOnDev/GitHub-Projects-StoryMap
```

Confirmed GitHub capabilities:

- Project V2 exposes native `Milestone`, `Parent issue`, and
  `Sub-issues progress` fields.
- GraphQL supports `addSubIssue`.
- GraphQL supports `reprioritizeSubIssue`.
- GraphQL supports `updateProjectV2ItemPosition`.
- Issue queries return parent issues, sub-issues, native sub-issue order, and
  Milestone data.
