import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchProject } from "./github.js";
import { parseProjectUrl } from "./projectUrl.js";
import { renderHtml } from "./renderHtml.js";
import { buildStoryMap } from "./storymap.js";

type CliOptions = {
  projectUrl: string;
  outputPath: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const locator = parseProjectUrl(options.projectUrl);
  const project = await fetchProject(locator);
  const storyMap = buildStoryMap(project);
  const html = renderHtml(storyMap);
  const outputPath = resolve(options.outputPath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(
    `Rendered ${storyMap.activities.length} activities, ${storyMap.slices.length} slices, ${storyMap.diagnostics.length} diagnostics.`,
  );
}

function parseArgs(args: string[]): CliOptions {
  const [projectUrl] = args;
  let outputPath = "out/storymap.html";

  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === "--out") {
      outputPath = args[index + 1] ?? "";
      index += 1;
    }
  }

  if (!projectUrl || projectUrl === "-h" || projectUrl === "--help") {
    printHelp();
    process.exit(projectUrl ? 0 : 1);
  }

  if (!outputPath) {
    throw new Error("Missing output path after --out");
  }

  return { projectUrl, outputPath };
}

function printHelp() {
  console.log(`Usage:
  npm run storymap -- PROJECT_URL [--out out/storymap.html]

Example:
  npm run storymap -- https://github.com/users/DocOnDev/projects/8 --out out/storymap.html
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
