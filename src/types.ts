export type ProjectLocator = {
  ownerKind: "user" | "org";
  owner: string;
  number: number;
};

export type GithubMilestone = {
  id: string;
  number: number;
  title: string;
  url: string;
  dueOn: string | null;
  state: string;
};

export type GithubIssue = {
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  repository: string;
  milestone: GithubMilestone | null;
  projectFields: ProjectFieldValues;
  parent: GithubIssueRef | null;
  subIssues: GithubIssue[];
};

export type ProjectFieldValues = {
  slice: string | null;
};

export type ProjectSliceOption = {
  id: string;
  name: string;
  sequence: number;
};

export type GithubIssueRef = {
  id: string;
  number: number;
  title: string;
  url: string;
  repository: string;
};

export type GithubProject = {
  title: string;
  url: string;
  sliceOptions: ProjectSliceOption[];
  items: GithubIssue[];
};

export type Slice = {
  key: string;
  title: string;
  sequence: number | null;
  url?: string;
  source: "project-field" | "milestone";
};

export type Story = {
  issue: GithubIssue;
  sliceKey: string;
};

export type Task = {
  issue: GithubIssue;
  stories: Story[];
};

export type Activity = {
  issue: GithubIssue;
  tasks: Task[];
};

export type Diagnostic = {
  severity: "warning" | "info";
  message: string;
  url?: string;
};

export type StoryMap = {
  projectTitle: string;
  projectUrl: string;
  generatedAt: string;
  activities: Activity[];
  slices: Slice[];
  diagnostics: Diagnostic[];
};
