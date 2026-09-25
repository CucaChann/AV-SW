import { validateLibrary, type RawLibraryFile } from "./validate";

const modules = import.meta.glob("/data/library/*.json", {
  eager: true,
  import: "default",
});

export function libraryFiles(): RawLibraryFile[] {
  return Object.entries(modules)
    .map(([path, data]) => ({ path: path.replace(/^\//, ""), data }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** The bundled library, validated. Callers should surface `issues`. */
export function loadLibrary() {
  return validateLibrary(libraryFiles());
}
