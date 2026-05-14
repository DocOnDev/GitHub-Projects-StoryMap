# GitHub Projects StoryMap Design

## Purpose

This app visualizes a GitHub Project as a user story map.

The source of truth is GitHub. The app should use native GitHub Project, issue,
sub-issue, and Project field concepts wherever possible.

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
| Story | Child issue with a Project `Slice` field value |
| Slice | Project single-select field named `Slice` |
| Slice sequence | Order of the `Slice` field options |
| Task order | Native sub-issue order under an Activity |
| Story priority | Native sub-issue order under a Task |
| Status | Native Project Status field |

No explicit issue labels or title prefixes are required to identify Activity,
Task, and Story roles.

## Discovery Rules

Given a Project:

1. Fetch Project items.
2. For each issue item, fetch its parent issue, sub-issues, Project field
   values, and repository.
3. Treat an issue as an Activity when it has no parent and has at least one child
   issue that qualifies as a Task.
4. Treat an issue as a Task when it is a child issue and has at least one child
   issue with a Project `Slice` value.
5. Treat an issue as a Story when it is a child issue with a Project `Slice`
   value.
6. Treat each `Slice` field option referenced by a Story as a Slice.
7. Order Slices by the order of the Project `Slice` field options.
8. Order Tasks and Stories by GitHub's native sub-issue order.

## Slice Sequencing

Slices are ordered by the option order of the Project single-select field named
`Slice`.

This lets the team put a Story into a Slice with one dropdown and then sequence
the Slices independently of the Stories in them by reordering the field options.

Milestones are repo-scoped in GitHub, so they are not suitable as the primary
slice model for multi-repo Projects. The generator may still use Milestones as a
fallback for older single-repo maps, but Project fields are the preferred model.

Fallback ordering:

1. Project `Slice` option order.
2. Slice title.
3. Milestone fallback title, when no Project `Slice` is set.

The app should clearly surface Stories without `Slice` values and fallback
Milestone Slices whose sequence is ambiguous.

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
7. Render Slice rows ordered by the Project `Slice` field option order.
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
- Story issue has no `Slice` value.
- Slice is not present in the Project `Slice` option list.
- Story parent is not present in the Project.
- Task parent is not present in the Project.
- A Project item is not part of a recognized Activity -> Task -> Story chain.

## Future Editor Mode

The longer-term goal is to allow StoryMap adjustments from the app while still
storing the data in GitHub.

Potential interactions:

| User action | GitHub operation |
| --- | --- |
| Move Story to another Slice | Update Project `Slice` field value |
| Reorder Stories under a Task | `reprioritizeSubIssue` |
| Move Story to another Task | Change sub-issue parent |
| Reorder Tasks under an Activity | `reprioritizeSubIssue` |
| Move Task to another Activity | Change sub-issue parent |
| Create Slice | Add an option to the Project `Slice` field |
| Rename Slice | Rename the Project `Slice` field option |
| Change Slice sequence | Reorder the Project `Slice` field options |
| Create Story | Create issue, add as sub-issue, set Project `Slice` field |
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

- Project V2 exposes native `Parent issue`, `Sub-issues progress`, and custom
  single-select fields.
- GraphQL supports `addSubIssue`.
- GraphQL supports `reprioritizeSubIssue`.
- GraphQL supports `updateProjectV2ItemPosition`.
- GraphQL supports `createProjectV2Field`, `updateProjectV2Field`, and
  `updateProjectV2ItemFieldValue` for assigning Stories to Slices and reordering
  Slice options.
- Issue queries return parent issues, sub-issues, native sub-issue order, and
  Project field values.
