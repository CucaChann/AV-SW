import { describe, expect, it } from "vitest";
import { MAX_RECENTS, withoutRecent, withRecent, type RecentProject } from "./recents";

const entry = (path: string, name = path): RecentProject => ({
  path,
  name,
  openedAt: "2026-09-25T00:00:00Z",
});

describe("recent projects", () => {
  it("puts the latest first and keeps one entry per path", () => {
    let list: RecentProject[] = [];
    list = withRecent(list, entry("C:\\Jobs\\A.avsw"));
    list = withRecent(list, entry("C:\\Jobs\\B.avsw"));
    list = withRecent(list, entry("c:\\jobs\\a.avsw", "A renamed"));
    expect(list.map((item) => item.name)).toEqual(["A renamed", "C:\\Jobs\\B.avsw"]);
  });

  it(`keeps at most ${MAX_RECENTS}`, () => {
    let list: RecentProject[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) list = withRecent(list, entry(`/p/${i}.avsw`));
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].path).toBe(`/p/${MAX_RECENTS + 2}.avsw`);
  });

  it("removes a missing file", () => {
    const list = [entry("/p/a.avsw"), entry("/p/b.avsw")];
    expect(withoutRecent(list, "/P/A.avsw").map((item) => item.path)).toEqual(["/p/b.avsw"]);
  });
});
