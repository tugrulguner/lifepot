import { projectSourceFiles, projectSourceRevision } from "./generated-content";

const repository = "https://github.com/tugrulguner/lifepot";

export function documentsFromSources(sources: Record<string, string>, revision = "main") {
  return [
    { slug: "readme", title: "Project README", sourcePath: "README.md", markdown: sources["README.md"], sourceUrl: `${repository}/blob/${revision}/README.md` },
    ...(sources["ROADMAP.md"] ? [{ slug: "roadmap", title: "Roadmap", sourcePath: "ROADMAP.md", markdown: sources["ROADMAP.md"], sourceUrl: `${repository}/blob/${revision}/ROADMAP.md` }] : []),
  ].filter((document) => Boolean(document.markdown));
}

export const publicDocuments = documentsFromSources(projectSourceFiles, projectSourceRevision);