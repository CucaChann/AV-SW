import { invoke, isTauri } from "@tauri-apps/api/core";
import { PROJECT_FILE_EXTENSION } from "./projectFile";

/**
 * Platform file access. The desktop app uses native dialogs and the
 * read_user_file / write_project_file commands (src-tauri/src/files.rs);
 * browser development mode falls back to file inputs and downloads.
 */

export type OpenedFile = {
  name: string;
  /** Absolute path in the desktop app; null in the browser. */
  path: string | null;
  bytes: Uint8Array;
};

export type FileFilter = { name: string; extensions: string[] };

export const PROJECT_FILTER: FileFilter = {
  name: "AV-SW Project",
  extensions: [PROJECT_FILE_EXTENSION],
};
export const DRAWING_FILTER: FileFilter = { name: "Drawing", extensions: ["pdf", "dxf"] };

export function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export async function readPath(path: string): Promise<OpenedFile> {
  const buffer = await invoke<ArrayBuffer>("read_user_file", { path });
  return { name: fileNameFromPath(path), path, bytes: new Uint8Array(buffer) };
}

function pickInBrowser(filter: FileFilter): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = filter.extensions.map((extension) => `.${extension}`).join(",");
    input.addEventListener("cancel", () => resolve(null));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
    });
    input.click();
  });
}

/** Shows an open dialog and reads the chosen file, or returns null if cancelled. */
export async function pickAndReadFile(filter: FileFilter): Promise<OpenedFile | null> {
  if (!isTauri()) return pickInBrowser(filter);

  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ multiple: false, directory: false, filters: [filter] });
  if (!selected || Array.isArray(selected)) return null;
  return readPath(selected);
}

function withProjectExtension(path: string) {
  return path.toLowerCase().endsWith(`.${PROJECT_FILE_EXTENSION}`)
    ? path
    : `${path}.${PROJECT_FILE_EXTENSION}`;
}

/**
 * Saves project bytes. Uses `currentPath` unless it is null or `chooseLocation`
 * is set, in which case a save dialog asks where. Returns the saved path
 * (null in the browser, where the file is downloaded), or undefined if the
 * user cancelled.
 */
export async function saveProjectBytes(
  bytes: Uint8Array,
  options: { suggestedName: string; currentPath: string | null; chooseLocation: boolean },
): Promise<{ path: string | null; name: string } | undefined> {
  const fileName = withProjectExtension(options.suggestedName);

  if (!isTauri()) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { path: null, name: fileName };
  }

  let target = options.chooseLocation ? null : options.currentPath;
  if (!target) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const chosen = await save({
      defaultPath: options.currentPath ?? fileName,
      filters: [PROJECT_FILTER],
    });
    if (!chosen) return undefined;
    target = withProjectExtension(chosen);
  }

  await invoke("write_project_file", bytes, {
    headers: { "x-avsw-path": encodeURIComponent(target) },
  });
  return { path: target, name: fileNameFromPath(target) };
}

export type UnsavedChoice = "save" | "discard" | "cancel";

/** Asks what to do with unsaved changes before they would be lost. */
export async function askUnsavedChanges(projectName: string): Promise<UnsavedChoice> {
  const question = `Save changes to "${projectName}" before continuing?`;

  if (!isTauri()) {
    // Browser dialogs have no three-way choice: OK saves, Cancel asks whether to discard.
    if (window.confirm(`${question}\n\nOK saves the project. Cancel lets you discard the changes.`)) {
      return "save";
    }
    return window.confirm("Discard the unsaved changes?") ? "discard" : "cancel";
  }

  const { message } = await import("@tauri-apps/plugin-dialog");
  const buttons = { yes: "Save", no: "Don't Save", cancel: "Cancel" };
  const result = await message(question, {
    title: "AV-SW",
    kind: "warning",
    buttons,
  });
  if (result === buttons.yes || result === "Yes") return "save";
  if (result === buttons.no || result === "No") return "discard";
  return "cancel";
}

/** A two-choice question; resolves true for `yes`. */
export async function askYesNo(question: string, yes: string, no: string): Promise<boolean> {
  if (!isTauri()) return window.confirm(`${question}\n\nOK: ${yes}\nCancel: ${no}`);
  const { message } = await import("@tauri-apps/plugin-dialog");
  const result = await message(question, { title: "AV-SW", kind: "info", buttons: { ok: yes, cancel: no } });
  return result === yes || result === "Ok";
}

export async function showError(text: string) {
  if (!isTauri()) {
    window.alert(text);
    return;
  }
  const { message } = await import("@tauri-apps/plugin-dialog");
  await message(text, { title: "AV-SW", kind: "error" });
}

export async function showWarning(text: string) {
  if (!isTauri()) {
    window.alert(text);
    return;
  }
  const { message } = await import("@tauri-apps/plugin-dialog");
  await message(text, { title: "AV-SW", kind: "warning" });
}

export async function setWindowTitle(title: string) {
  document.title = title;
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}
