import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { newDrawing, newProject } from "./projectFile";
import { newQtlRun } from "./projectTools";
import { clearRecovery, loadRecovery, saveRecovery } from "./recovery";

function projectWithDrawing() {
  const project = newProject("Beach House");
  const drawing = newDrawing("Level 1.dxf", new Uint8Array(readFileSync("samples/apartment_demo.dxf")));
  return {
    ...project,
    tools: { ...project.tools, qtlRuns: [{ ...newQtlRun(), room: "Kitchen" }] },
    drawings: [drawing],
    activeDrawingId: drawing.id,
  };
}

async function storedDrawingCount() {
  return new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("avsw");
    request.onsuccess = () => {
      const db = request.result;
      const count = db.transaction("drawings", "readonly").objectStore("drawings").count();
      count.onsuccess = () => {
        db.close();
        resolve(count.result);
      };
      count.onerror = () => reject(count.error);
    };
    request.onerror = () => reject(request.error);
  });
}

describe("recovery copy", () => {
  beforeEach(async () => {
    await clearRecovery();
  });

  it("is empty until something is saved", async () => {
    expect(await loadRecovery()).toBeNull();
  });

  it("restores the project, drawing bytes, path and unsaved state", async () => {
    const project = projectWithDrawing();
    expect(await saveRecovery({ project, path: "C:\\Jobs\\Beach House.avsw", dirty: true })).toBe(true);

    const recovered = await loadRecovery();
    expect(recovered?.project).toEqual(project);
    expect(recovered).toMatchObject({ path: "C:\\Jobs\\Beach House.avsw", dirty: true, repairs: [] });
  });

  it("keeps one stored copy per drawing and drops replaced drawings", async () => {
    const project = projectWithDrawing();
    await saveRecovery({ project, path: null, dirty: true });
    await saveRecovery({ project: { ...project, name: "Renamed" }, path: null, dirty: true });
    expect(await storedDrawingCount()).toBe(1);

    const replacement = newDrawing("Level 2.pdf", new Uint8Array([1, 2, 3]));
    await saveRecovery({
      project: { ...project, drawings: [replacement], activeDrawingId: replacement.id },
      path: null,
      dirty: true,
    });
    expect(await storedDrawingCount()).toBe(1);
    expect(Array.from((await loadRecovery())!.project.drawings[0].bytes)).toEqual([1, 2, 3]);
  });

  it("can be cleared", async () => {
    await saveRecovery({ project: projectWithDrawing(), path: null, dirty: true });
    await clearRecovery();
    expect(await loadRecovery()).toBeNull();
    expect(await storedDrawingCount()).toBe(0);
  });
});
