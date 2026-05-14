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
    Story issue with a Project Slice field value
    Story issue with a Project Slice field value
```

The generator reads this as:

| StoryMap concept | GitHub concept |
| --- | --- |
| Activity | Project issue with no parent and at least one child Task |
| Task | Child issue with at least one child Story |
| Story | Child issue with a Project `Slice` field value |
| Slice | Project `Slice` field |
| Slice sequence | Order of the Project `Slice` field options |
| Task order | Native sub-issue order under the Activity |
| Story order | Native sub-issue order under the Task |

No labels or title prefixes are required.

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

## Slices

Stories must have a Project-level `Slice` field value.

Milestones are repo-scoped in GitHub, so they are the wrong primary slice model
for multi-repo StoryMaps. Use Project fields instead, because Project fields are
scoped to the Project and work across every repo in the Project.

Create these Project fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `Slice` | Single select | The release slice a Story belongs to |

Example:

```text
Foundation
Slice 1 - Keystone - data model
Slice 2 - Inspection templates
Slice 3 - Inspection flow
Slice 4 - Task detail follow-ups
Slice 5 - Telematics on the gear page
Slice 6 - Nav, filters, saved views
Slice 7 - Enrichment
```

The generator orders slices by the order of the `Slice` field options. To change
slice sequence, reorder the options in the Project field. This changes the
StoryMap row order without touching the Stories in those slices.

The generator still supports Milestones as a fallback for older or single-repo
maps, but multi-repo teams should prefer Project fields.

## Team Setup Checklist

1. Create or choose a GitHub Project V2.
2. Create a Project single-select field named `Slice`.
3. Add the Slice options in the order they should appear in the StoryMap.
4. Create top-level Activity issues.
5. Add Task issues as sub-issues under Activities.
6. Add Story issues as sub-issues under Tasks.
7. Add the Activity, Task, and Story issues to the Project if GitHub has not
   already added them through the sub-issue hierarchy.
8. Set each Story issue's `Slice` field.
9. Reorder Tasks and Stories with GitHub's native sub-issue ordering.
10. Reorder the `Slice` field options whenever slice sequence changes.
11. Run the generator:

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
Stories are assigned to Project-level Slices.

Example diagnostics from the current Project:

- `Feature: Shareable Links — time-limited share URLs` is not part of a
  recognized Activity -> Task -> Story chain.
- Several `Share, Phase ...` child issues have no Slice-backed Stories.
- No Activities were found.

To make this Project generate a StoryMap, the team needs to decide which
top-level issues are Activities, put Task issues under them, and put
Slice-backed Story issues under those Tasks.

## GearJot StoryMap Prototype Setup

To prove this without changing GearJot Project 4, create a new org Project:

```text
GearJot StoryMap Prototype
```

Create the Project field:

```text
Slice
```

Type:

```text
Single select
```

Add these options in this order:

```text
Foundation
Slice 1 - Keystone - data model
Slice 2 - Inspection templates
Slice 3 - Inspection flow
Slice 4 - Task detail follow-ups
Slice 5 - Telematics on the gear page
Slice 6 - Nav, filters, saved views
Slice 7 - Enrichment
```

Create Activity issues in `GearJot/gearjot-v2-planning`:

```text
Get oriented
Add & connect a piece of gear
Set up a template
Create a task
Run an inspection
Follow up on a task
```

Create Task issues under those Activities:

```text
Get oriented
  Step 1 - Land in the org
  Step 2 - Filter gear and switch views

Add & connect a piece of gear
  Step 3 - Add a new piece of gear
  Step 4 - Connect telematics
  Step 5 - Use gear-scoped navigation

Set up a template
  Step 6 - Build and assign an inspection template

Create a task
  Step 7 - Create a task with the right details

Run an inspection
  Step 8 - Start an inspection from a task
  Step 9 - Answer questions and create follow-up work
  Step 10 - Review submitted inspection results

Follow up on a task
  Step 11 - Reassign, update status, and comment
```

For the lowest-impact prototype, create prototype Story issues in
`GearJot/gearjot-v2-planning` and link each one to the real backlog issue in the
body. Once the team is comfortable, replace those with the real issues or add
the real issues as Story sub-issues directly.

Map the Stories to Slices like this:

| Task | Slice | Stories |
| --- | --- | --- |
| Step 1 - Land in the org | Slice 6 - Nav, filters, saved views | G-003, G-034 |
| Step 1 - Land in the org | Slice 7 - Enrichment | G-002 |
| Step 2 - Filter gear and switch views | Slice 6 - Nav, filters, saved views | G-004 filter, G-004 saved view, G-005 |
| Step 3 - Add a new piece of gear | Foundation | G-006 |
| Step 4 - Connect telematics | Slice 5 - Telematics on the gear page | G-009, G-036 |
| Step 4 - Connect telematics | Slice 7 - Enrichment | G-007, G-008 |
| Step 5 - Use gear-scoped navigation | Foundation | G-001 |
| Step 6 - Build and assign an inspection template | Foundation | G-010 |
| Step 6 - Build and assign an inspection template | Slice 2 - Inspection templates | G-011, G-012 |
| Step 7 - Create a task with the right details | Foundation | G-013, G-018, G-020, G-024, G-019 mitigation |
| Step 7 - Create a task with the right details | Slice 4 - Task detail follow-ups | G-019 full fix |
| Step 8 - Start an inspection from a task | Slice 3 - Inspection flow | G-014, G-029 |
| Step 9 - Answer questions and create follow-up work | Slice 1 - Keystone - data model | G-035 |
| Step 9 - Answer questions and create follow-up work | Slice 3 - Inspection flow | G-015, G-016, G-030, G-033 |
| Step 10 - Review submitted inspection results | Slice 3 - Inspection flow | G-017 |
| Step 11 - Reassign, update status, and comment | Foundation | G-021, G-022, G-023 |
| Step 11 - Reassign, update status, and comment | Slice 4 - Task detail follow-ups | G-031, G-026, G-027, G-037 |

Cleanup notes:

- Split `G-004` into filtering and saved-view Stories if those can ship
  separately.
- Split `G-019` into the mitigation and the full file-attachment fix if those
  can ship separately.
- Do not map `G-025`; the earlier StoryMap treated it as audit-only.
- Do not map `G-028`; it is a composite end-to-end gap that closes when its
  constituents close.

This prototype has been created at:

```text
https://github.com/orgs/GearJot/projects/5
```

The generated local HTML is:

```text
out/gearjot-prototype-storymap.html
```

Current result:

```text
6 Activities
8 Slices
0 diagnostics
```

Run the prototype generator with:

```sh
npm run storymap -- https://github.com/orgs/GearJot/projects/5 --out out/gearjot-prototype-storymap.html
```
