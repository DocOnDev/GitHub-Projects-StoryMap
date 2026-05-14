# Setting Up a GitHub Project for StoryMap Generation

The StoryMap generator works with GitHub Projects V2 across one repo or many
repos. The Project is the planning boundary.

The generator does not need a repository URL. It only needs a GitHub Project
URL, for example:

```text
https://github.com/orgs/GearJot/projects/4
```

## Required Shape

The Project must contain issue hierarchy that matches the StoryMap model:

```text
Activity issue
  Task issue
    Story issue assigned to a Milestone
    Story issue assigned to a Milestone
```

The generator reads this as:

| StoryMap concept | GitHub concept |
| --- | --- |
| Activity | Project issue with no parent and at least one child Task |
| Task | Child issue with at least one child Story |
| Story | Child issue assigned to a Milestone |
| Slice | Milestone |
| Slice sequence | Milestone due date |
| Task order | Native sub-issue order under the Activity |
| Story order | Native sub-issue order under the Task |

No labels, title prefixes, or custom Project fields are required.

## Multi-Repo Setup

Multi-repo Projects are supported.

An Activity can live in one repo, its Tasks can live in the same repo, and its
Stories can live in the same or other repos as long as GitHub allows the
sub-issue relationship and the authenticated user can read them.

For day-to-day team clarity, prefer this convention:

- Put Activity and Task issues in the planning repo if the work spans multiple
  repos.
- Put Story issues in the repo where the work will actually happen.
- Add the Activity issues to the Project.
- Let GitHub include child Tasks and Stories through the sub-issue hierarchy.

The generator traverses from Project Activity roots into their child Tasks and
Stories.

## Milestones as Slices

Stories must be assigned to Milestones.

Milestones are repo-scoped in GitHub. In a multi-repo Project, use the same
Milestone names and due dates across repos when the slice spans multiple repos.

Example:

```text
Release 1, due 2026-05-21
Release 2, due 2026-05-28
Release 3, due 2026-06-04
```

The generator orders slices by Milestone due date. If a Story's Milestone has no
due date, the generator will warn that the slice sequence is ambiguous.

## Team Setup Checklist

1. Create or choose a GitHub Project V2.
2. Create Milestones for the intended slices in the relevant repos.
3. Give every slice Milestone a due date.
4. Create top-level Activity issues.
5. Add Task issues as sub-issues under Activities.
6. Add Story issues as sub-issues under Tasks.
7. Assign each Story issue to a Milestone.
8. Add the Activity issues to the Project.
9. Reorder Tasks and Stories with GitHub's native sub-issue ordering.
10. Run the generator:

```sh
npm run storymap -- https://github.com/orgs/GearJot/projects/4 --out out/gearjot-storymap.html
```

## Current GearJot Project 4 Check

The generator can read:

```text
https://github.com/orgs/GearJot/projects/4
```

Current result:

```text
0 Activities
0 Slices
12 diagnostics
```

This means the generator can access the Project, but the Project is not yet
structured as a StoryMap.

The current Project contains useful issues, including multi-repo items, but it
does not currently expose a complete Activity -> Task -> Story hierarchy where
Stories are assigned to Milestones.

Example diagnostics from the current Project:

- `Feature: Shareable Links — time-limited share URLs` is not part of a
  recognized Activity -> Task -> Story chain.
- Several `Share, Phase ...` child issues have no Milestone-backed Stories.
- No Activities were found.

To make this Project generate a StoryMap, the team needs to decide which
top-level issues are Activities, put Task issues under them, and put
Milestone-backed Story issues under those Tasks.
