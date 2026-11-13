import { describe, expect, it } from "vitest";
import { syncFromLive } from "./sync-summary.js";

describe("syncFromLive", () => {
  it("uses a recorded sync when one is present", () => {
    const sync = syncFromLive({
      updated: "2026-11-01T00:00:00Z",
      currentlyReading: [{ title: "Old", progress: 10 }],
      lastSync: {
        at: "2026-11-12T00:00:00Z",
        ok: true,
        source: "github-actions",
        readingCount: 1,
        upNextCount: 1,
        changes: ["Started Fourth Wing"],
        warning: null,
        error: null,
        reading: [{ title: "Fourth Wing", progress: 40 }],
      },
      upNext: [{ title: "Iron Flame", progress: 0 }],
    });
    expect(sync).toMatchObject({
      at: "2026-11-12T00:00:00Z",
      ok: true,
      source: "github-actions",
      readingCount: 1,
      upNextCount: 1,
      changes: ["Started Fourth Wing"],
      warning: null,
      error: null,
      reading: [{ title: "Fourth Wing", progress: 40 }],
      upNext: [{ title: "Iron Flame" }],
    });
  });

  it("falls back to the current shelf when no sync list was stored", () => {
    const sync = syncFromLive({
      updated: "2026-11-12T00:00:00Z",
      currentlyReading: [{ title: "Fourth Wing", progress: 40 }],
      upNext: [{ title: "Iron Flame" }],
    });
    expect(sync.ok).toBe(true);
    expect(sync.reading).toEqual([{ title: "Fourth Wing", progress: 40 }]);
    expect(sync.upNext).toEqual([{ title: "Iron Flame" }]);
    expect(sync.readingCount).toBe(1);
    expect(sync.warning).toBeNull();
  });

  it("describes an empty shelf", () => {
    const sync = syncFromLive({});
    expect(sync).toMatchObject({
      at: "",
      ok: false,
      source: "file",
      readingCount: 0,
      upNextCount: 0,
      changes: [],
      warning: "No Goodreads sync has been recorded yet.",
      error: null,
      reading: [],
      upNext: [],
    });
    expect(syncFromLive({}, { source: "local" }).source).toBe("local");
  });
});
