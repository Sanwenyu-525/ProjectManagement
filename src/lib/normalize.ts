/**
 * Parse techStack from database format (JSON string or already-parsed array) to string array.
 */
export function parseTechStack(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normalize a project object from the Rust backend.
 * Converts JSON string fields to proper JS types.
 */
export function normalizeProject(project: Record<string, any>): Record<string, any> {
  if (!project) return project;
  return {
    ...project,
    techStack: parseTechStack(project.techStack),
  };
}

/**
 * Normalize an array of projects.
 */
export function normalizeProjects(projects: any[]): any[] {
  if (!Array.isArray(projects)) return [];
  return projects.map(normalizeProject);
}
