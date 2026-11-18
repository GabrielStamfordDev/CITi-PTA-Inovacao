import fs from "fs";
import path from "path";

/**
 * Resolves a project-root-relative path reliably in both development
 * (running from `src/`) and production builds (compiled inside `dist/src/`).
 */
export function resolveProjectPath(...segments: string[]): string {
  const rootCandidates = [
    path.resolve(__dirname, "..", ".."),
    path.resolve(__dirname, "..", "..", ".."),
    process.cwd(),
  ];

  for (const root of rootCandidates) {
    const candidate = path.resolve(root, ...segments);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), ...segments);
}
