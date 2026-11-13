import { describe, expect, it } from "vitest";
import { MAX_EVENTS as coreMaxEvents } from "../../functions/admin/api/_lib/activity.js";
import {
  MAX_EVENTS,
  appendActivity,
  describeReadingChanges,
  describeUpNextChanges,
  formatSyncDetail,
  parseActivityLog,
} from "./activity.mjs";

describe("MAX_EVENTS", () => {
  it("is the same cap in the shared core and the script module", () => {
    expect(MAX_EVENTS).toBe(40);
    expect(coreMaxEvents).toBe(MAX_EVENTS);
  });
});

describe("parseActivityLog", () => {
  it("returns an empty events list for missing or invalid input", () => {
    expect(parseActivityLog("")).toEqual({ events: [] });
    expect(parseActivityLog("not json")).toEqual({ events: [] });
  });

  it("parses a valid log and ignores a non-array events field", () => {
    expect(parseActivityLog('{"events":[{"title":"x"}]}')).toEqual({ events: [{ title: "x" }] });
    expect(parseActivityLog('{"events":"nope"}')).toEqual({ events: [] });
  });
});

describe("appendActivity", () => {
  it("adds the new entry at the front and fills in defaults", () => {
    const log = appendActivity({ events: [] }, { type: "goodreads", title: "Synced" });
    expect(log.events).toHaveLength(1);
    expect(log.events[0]).toMatchObject({
      type: "goodreads",
      title: "Synced",
      ok: true,
      detail: "",
      by: "",
    });
    expect(log.events[0].at).toBeTruthy();
  });

  it("keeps newest-first order and caps the log at MAX_EVENTS (40)", () => {
    let log = { events: [] };
    for (let i = 0; i < 45; i += 1) {
      log = appendActivity(log, {
        type: "goodreads",
        title: `Event ${i}`,
        at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      });
    }
    expect(log.events).toHaveLength(40);
    expect(log.events[0].title).toBe("Event 44");
  });
});

describe("describeReadingChanges", () => {
  it("reports a newly started book", () => {
    const changes = describeReadingChanges(
      [],
      [{ goodreadsId: "1", title: "Fourth Wing", progress: 10 }],
    );
    expect(changes).toEqual(["Started Fourth Wing"]);
  });

  it("reports progress movement for an existing book", () => {
    const previous = [{ goodreadsId: "1", title: "Fourth Wing", progress: 10 }];
    const next = [{ goodreadsId: "1", title: "Fourth Wing", progress: 50 }];
    expect(describeReadingChanges(previous, next)).toEqual(["Fourth Wing: 10% → 50%"]);
  });

  it("reports a book that left the currently-reading shelf", () => {
    const previous = [{ goodreadsId: "1", title: "Fourth Wing", progress: 10 }];
    expect(describeReadingChanges(previous, [])).toEqual(["Left currently reading: Fourth Wing"]);
  });

  it("reports nothing when nothing changed", () => {
    const books = [{ goodreadsId: "1", title: "Fourth Wing", progress: 10 }];
    expect(describeReadingChanges(books, books)).toEqual([]);
  });
});

describe("describeUpNextChanges", () => {
  it("reports additions and removals", () => {
    const previous = [{ goodreadsId: "1", title: "Book A" }];
    const next = [{ goodreadsId: "2", title: "Book B" }];
    const changes = describeUpNextChanges(previous, next);
    expect(changes).toContain("Up next: Book B");
    expect(changes).toContain("Left up next: Book A");
  });

  it("reports a reorder when the same books change order", () => {
    const previous = [
      { goodreadsId: "1", title: "Book A" },
      { goodreadsId: "2", title: "Book B" },
    ];
    const next = [
      { goodreadsId: "2", title: "Book B" },
      { goodreadsId: "1", title: "Book A" },
    ];
    expect(describeUpNextChanges(previous, next)).toEqual(["Up next order changed."]);
  });

  it("reports nothing when the list is unchanged", () => {
    const books = [{ goodreadsId: "1", title: "Book A" }];
    expect(describeUpNextChanges(books, books)).toEqual([]);
  });
});

describe("formatSyncDetail", () => {
  it("formats a successful sync with reading progress and changes", () => {
    const detail = formatSyncDetail({
      currentlyReading: [{ title: "Fourth Wing", progress: 50 }],
      upNext: [{ title: "Iron Flame" }],
      changes: ["Started Fourth Wing"],
      ok: true,
    });
    expect(detail).toContain("Now reading");
    expect(detail).toContain("Fourth Wing (50%)");
    expect(detail).toContain("Up next");
    expect(detail).toContain("Iron Flame");
    expect(detail).toContain("Started Fourth Wing");
  });

  it("falls back to 'None' and a no-changes note when nothing is set", () => {
    const detail = formatSyncDetail({ ok: true });
    expect(detail).toContain("None");
    expect(detail).toContain("No changes since the previous shelf.");
  });

  it("formats a failed sync, keeping mention of the previous shelf", () => {
    const detail = formatSyncDetail({
      ok: false,
      error: "Could not reach Goodreads.",
      currentlyReading: [{ title: "Fourth Wing" }],
    });
    expect(detail).toBe("Could not reach Goodreads.\nThe previous shelf was kept.");
  });
});
