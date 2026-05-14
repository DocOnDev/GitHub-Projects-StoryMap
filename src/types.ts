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
  parent: GithubIssueRef | null;
  subIssues: GithubIssue[];
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
  items: GithubIssue[];
};

export type Slice = {
  key: string;
  milestone: GithubMilestone;
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
