# GitHub Projects StoryMap

Generate a static HTML story map from a GitHub Project using native GitHub data.

The app treats the GitHub Project as the planning boundary and derives:

- Activities from top-level issues.
- Tasks from sub-issues.
- Stories from sub-issues assigned to Milestones.
- Slices from Milestones.
- Slice sequence from Milestone due dates.
- Task and Story order from native sub-issue order.

See [STORYMAP_DESIGN.md](STORYMAP_DESIGN.md) for the working design.

## Usage

The CLI uses your local `gh` authentication.

```sh
npm install
npm run storymap -- https://github.com/users/DocOnDev/projects/8 --out out/storymap.html
```

Open `out/storymap.html` in a browser and share the generated file with the team.
