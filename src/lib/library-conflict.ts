import type { BuildingProject, ProjectLibrary } from '../floorplan-types';
import { insertBuilding, parseLibrary } from './library';

/** A selection change does not constitute an edit to the project or its rooms. */
function projectContents(project: BuildingProject): string {
  return JSON.stringify({
    id: project.id,
    name: project.name,
    floors: project.floors.map(floor => ({
      id: floor.id,
      name: floor.name,
      workspace: {
        version: floor.workspace.version,
        rooms: floor.workspace.rooms,
        floorPlan: floor.workspace.floorPlan,
      },
    })),
  });
}

/** Compare validated contents without project, floor or room selections. */
export function sameLibraryContents(left: ProjectLibrary, right: ProjectLibrary): boolean {
  const leftProjects = parseLibrary(left).projects;
  const rightProjects = parseLibrary(right).projects;
  return leftProjects.length === rightProjects.length
    && leftProjects.every((project, index) => projectContents(project) === projectContents(rightProjects[index]));
}

function ownVersionName(name: string): string {
  const suffix = ' (eigene Fassung)';
  if (name.endsWith(suffix)) return name;
  const limit = 100 - suffix.length;
  let prefix = '';
  for (const character of name) {
    if (prefix.length + character.length > limit) break;
    prefix += character;
  }
  return prefix.trimEnd() + suffix;
}

/**
 * Retain the complete external state and add locally changed projects as copies.
 * Local deletions never delete external data. An unchanged project that was
 * removed externally is not resurrected by navigation in an older tab.
 * All inputs stay unchanged, including when the project limit rejects the merge.
 */
export function mergeLibraryConflict(local: ProjectLibrary, baseline: ProjectLibrary, external: ProjectLibrary): ProjectLibrary {
  const checkedLocal = parseLibrary(local);
  const checkedBaseline = parseLibrary(baseline);
  let merged = parseLibrary(external);
  const baselineContents = new Map(checkedBaseline.projects.map(project => [project.id, projectContents(project)]));
  const externalContents = new Map(merged.projects.map(project => [project.id, projectContents(project)]));

  for (const project of checkedLocal.projects) {
    const contents = projectContents(project);
    if (baselineContents.get(project.id) === contents) continue;
    if (externalContents.get(project.id) === contents) continue;

    const copy = externalContents.has(project.id)
      ? { ...project, name: ownVersionName(project.name) }
      : project;
    merged = insertBuilding(merged, copy);
  }
  return merged;
}
