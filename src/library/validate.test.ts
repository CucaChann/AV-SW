import { describe, expect, it } from "vitest";
import { loadLibrary } from "./load";
import { isAiAgent, validateLibrary } from "./validate";

const proposed = { status: "proposed", proposedBy: "claude", proposedOn: "2026-09-25" };

function baseFile() {
  return {
    schemaVersion: 1,
    manufacturers: [{ id: "acme", name: "Acme" }],
    sources: [
      {
        id: "acme-sheet",
        kind: "spec-sheet",
        title: "Acme D600 spec sheet",
        publisher: "acme",
        url: "https://example.com/d600.pdf",
        accessedOn: "2026-09-20",
      },
    ],
    families: [
      {
        id: "acme-dimmers",
        manufacturerId: "acme",
        name: "Acme dimmers",
        category: "control.dimmer",
        source: { sourceId: "acme-sheet" },
        review: { ...proposed },
      },
    ],
    products: [
      {
        id: "acme-d600",
        manufacturerId: "acme",
        familyId: "acme-dimmers",
        model: "D600",
        name: "Acme 600 W dimmer",
        category: "control.dimmer",
        specs: {
          "dimming.ratedLoadIncandescentW": {
            value: 600,
            unit: "W",
            source: { sourceId: "acme-sheet", locator: "p. 2, Ratings" },
          },
        } as Record<string, unknown>,
        source: { sourceId: "acme-sheet" },
        review: { ...proposed } as Record<string, unknown>,
      },
    ],
    compatibility: [] as unknown[],
  };
}

function issuesFor(file: unknown, ...more: unknown[]) {
  const files = [file, ...more].map((data, i) => ({ path: `test-${i}.json`, data }));
  return validateLibrary(files).issues.map((issue) => issue.message);
}

describe("repository library data", () => {
  it("validates with no issues", () => {
    const { library, issues } = loadLibrary();
    expect(issues).toEqual([]);
    expect(library.manufacturers.map((m) => m.id)).toEqual(
      expect.arrayContaining(["lutron", "dmf", "savant"]),
    );
    expect(library.rules.map((r) => r.id)).toContain("dmf-dimmer-led-derating");
  });

  it("has no AI-verified records", () => {
    const { library } = loadLibrary();
    const records = [
      ...library.ecosystems,
      ...library.families,
      ...library.products,
      ...library.requirements,
      ...library.compatibility,
      ...library.alternatives,
      ...library.rules,
    ];
    for (const record of records) {
      if (record.review.status === "verified") {
        expect(isAiAgent(record.review.verifiedBy)).toBe(false);
      }
    }
  });
});

describe("validateLibrary", () => {
  it("accepts a well-formed file", () => {
    expect(issuesFor(baseFile())).toEqual([]);
  });

  it("reports schema errors with the file path", () => {
    const file = baseFile();
    delete (file.products[0] as Partial<(typeof file.products)[0]>).source;
    const { issues } = validateLibrary([{ path: "data/library/bad.json", data: file }]);
    expect(issues[0]).toMatchObject({ file: "data/library/bad.json", at: "products.0.source" });
  });

  it("rejects ids that are not kebab-case", () => {
    const file = baseFile();
    file.products[0].id = "Acme_D600";
    expect(issuesFor(file).join()).toMatch(/kebab-case/);
  });

  it("rejects unknown spec keys", () => {
    const file = baseFile();
    file.products[0].specs["dimming.maxWatts"] = {
      value: 600,
      unit: "W",
      source: { sourceId: "acme-sheet" },
    };
    expect(issuesFor(file)).toContain(
      'unknown spec "dimming.maxWatts"; add it to src/library/specs.ts first',
    );
  });

  it("rejects the wrong unit or type for a spec", () => {
    const wrongUnit = baseFile();
    wrongUnit.products[0].specs["dimming.ratedLoadIncandescentW"] = {
      value: 600,
      unit: "V",
      source: { sourceId: "acme-sheet" },
    };
    expect(issuesFor(wrongUnit).join()).toMatch(/must use unit W, got V/);

    const wrongType = baseFile();
    wrongType.products[0].specs["dimming.ratedLoadIncandescentW"] = {
      value: "600",
      unit: "W",
      source: { sourceId: "acme-sheet" },
    };
    expect(issuesFor(wrongType).join()).toMatch(/must be a number/);
  });

  it("rejects values outside a controlled vocabulary", () => {
    const file = baseFile();
    file.products[0].specs["dimming.methods"] = {
      value: ["forward-phase", "magic-dimming"],
      source: { sourceId: "acme-sheet" },
    };
    expect(issuesFor(file)).toContain('spec "dimming.methods" does not allow "magic-dimming"');
  });

  it("rejects references to undeclared sources", () => {
    const file = baseFile();
    file.products[0].source = { sourceId: "acme-missing" };
    expect(issuesFor(file)).toContain('unknown source "acme-missing"');
  });

  it("only lets a person verify a record", () => {
    const byAi = baseFile();
    byAi.products[0].review = {
      ...proposed,
      status: "verified",
      verifiedBy: "Claude Code",
      verifiedOn: "2026-09-26",
    };
    expect(issuesFor(byAi).join()).toMatch(/is an AI agent/);

    const byPerson = baseFile();
    byPerson.products[0].review = {
      ...proposed,
      status: "verified",
      verifiedBy: "Dennis Lopez",
      verifiedOn: "2026-09-26",
    };
    expect(issuesFor(byPerson)).toEqual([]);
  });

  it("requires sources of verified records to have been read", () => {
    const file = baseFile();
    delete (file.sources[0] as Partial<(typeof file.sources)[0]>).accessedOn;
    file.products[0].review = {
      ...proposed,
      status: "verified",
      verifiedBy: "Dennis Lopez",
      verifiedOn: "2026-09-26",
    };
    expect(issuesFor(file)).toContain(
      'verified record cites source "acme-sheet" with no accessedOn date',
    );
  });

  it("rejects duplicate ids across files", () => {
    const again = { schemaVersion: 1, manufacturers: [{ id: "acme", name: "Acme again" }] };
    expect(issuesFor(baseFile(), again).join()).toMatch(/duplicate id/);
  });

  it("rejects a product whose family belongs to another manufacturer", () => {
    const file = baseFile();
    file.manufacturers.push({ id: "other", name: "Other" });
    file.products[0].manufacturerId = "other";
    expect(issuesFor(file)).toContain('family "acme-dimmers" belongs to "acme"');
  });

  it("requires conditions or rules on conditional compatibility", () => {
    const file = baseFile();
    file.compatibility.push({
      id: "acme-d600-with-acme",
      a: { productId: "acme-d600" },
      b: { manufacturerId: "acme" },
      relation: "conditional",
      source: { sourceId: "acme-sheet" },
      review: { ...proposed },
    });
    expect(issuesFor(file)).toContain("conditional compatibility needs conditions or ruleIds");
  });
});
