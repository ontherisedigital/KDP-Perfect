/**
 * Saved book projects: a named snapshot of everything about one book (the settings on every tab, the
 * Page designer document and the puzzle book). Images are referenced by id; a project file written for
 * sharing or backup carries the images too.
 */

export interface ProjectSnapshot {
  /** The app settings (book panel and every tab). */
  state: unknown;
  /** Page designer document. */
  design: unknown;
  /** Puzzle book. */
  puzzles: unknown;
}

export interface Project extends ProjectSnapshot {
  id: string;
  name: string;
  savedAt: string;
}

export interface ProjectImage {
  id: string;
  name: string;
  type: 'png' | 'jpg';
  widthPx: number;
  heightPx: number;
  /** Base64 bytes. */
  data: string;
}

export interface ProjectFile {
  format: 'selfpublisher-studio-project';
  version: 1;
  project: Project;
  images: ProjectImage[];
}

export const PROJECT_FORMAT = 'selfpublisher-studio-project';

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isProject(v: unknown): v is Project {
  return isRec(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.savedAt === 'string' && 'state' in v;
}

export function isProjectFile(v: unknown): v is ProjectFile {
  return (
    isRec(v) &&
    v.format === PROJECT_FORMAT &&
    v.version === 1 &&
    isProject(v.project) &&
    Array.isArray(v.images) &&
    v.images.every((i) => isRec(i) && typeof i.id === 'string' && typeof i.data === 'string' && (i.type === 'png' || i.type === 'jpg'))
  );
}

/** Which of the stored image ids a project uses (Page designer elements point at images by id). */
export function imagesUsed(project: ProjectSnapshot, ids: readonly string[]): string[] {
  const json = JSON.stringify(project.design ?? null);
  return ids.filter((id) => json.includes(`"${id}"`));
}

/** A name not already in the list: "My book", "My book (2)", ... */
export function uniqueName(name: string, taken: string[]): string {
  const base = name.trim() || 'Untitled book';
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base} (${i})`)) return `${base} (${i})`;
}

export function newProjectId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
