import type { ProjectLocator } from "./types.js";

export function parseProjectUrl(value: string): ProjectLocator {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid GitHub Project URL: ${value}`);
  }

  if (url.hostname !== "github.com") {
    throw new Error(`Expected a github.com Project URL, received: ${value}`);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const [kind, owner, projects, projectNumber] = parts;

  if ((kind !== "users" && kind !== "orgs") || !owner || projects !== "projects" || !projectNumber) {
    throw new Error(
      "Expected a Project URL like https://github.com/users/OWNER/projects/NUMBER or https://github.com/orgs/OWNER/projects/NUMBER",
    );
  }

  const number = Number(projectNumber);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid Project number in URL: ${projectNumber}`);
  }

  return {
    ownerKind: kind === "users" ? "user" : "org",
    owner,
    number,
  };
}
