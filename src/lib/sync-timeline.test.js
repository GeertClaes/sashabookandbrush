import { describe, expect, it } from "vitest";
import {
  eventFromSite,
  latestMark,
  mergeTimelineEvents,
  sameSync,
  syncOutcome,
} from "./sync-timeline.js";

describe("sameSync", () => {
  it("treats timestamps within 5 seconds as the same sync", () => {
    expect(sameSync("2026-11-12T12:00:00Z", "2026-11-12T12:00:04Z")).toBe(true);
  });

  it("treats timestamps more than 5 seconds apart as different syncs", () => {
    expect(sameSync("2026-11-12T12:00:00Z", "2026-11-12T12:00:06Z")).toBe(false);
  });

  it("is false for missing or unparsable timestamps", () => {
    expect(sameSync("", "2026-11-12T12:00:00Z")).toBe(false);
    expect(sameSync("not a date", "2026-11-12T12:00:00Z")).toBe(false);
  });
});

describe("latestMark", () => {
  it("returns 0 for missing data", () => {
    expect(latestMark(null)).toBe(0);
    expect(latestMark({})).toBe(0);
  });

  it("uses the sync timestamp when there are no goodreads events", () => {
    expect(latestMark({ sync: { at: "2026-11-12T12:00:00Z" }, events: [] })).toBe(
      Date.parse("2026-11-12T12:00:00Z"),
    );
  });

  it("picks the newest of the sync timestamp and any goodreads events", () => {
    const data = {
      sync: { at: "2026-11-10T00:00:00Z" },
      events: [
        { type: "goodreads", at: "2026-11-12T12:00:00Z" },
        { type: "editor", at: "2026-11-13T00:00:00Z" },
      ],
    };
    expect(latestMark(data)).toBe(Date.parse("2026-11-12T12:00:00Z"));
  });
});

describe("eventFromSite", () => {
  it("returns null when the site has no build timestamp yet", () => {
    expect(eventFromSite({})).toBeNull();
    expect(eventFromSite(null)).toBeNull();
  });

  it("synthesizes a successful, non-busy event for a live build", () => {
    const event = eventFromSite({
      at: "2026-11-12T12:00:00Z",
      state: "live",
      label: "Site is live",
      commitHash: "abc1234567",
      trigger: "GitHub",
    });
    expect(event).toMatchObject({
      ok: true,
      busy: false,
      title: "Site is live",
      detail: "Build abc1234",
    });
  });

  it("marks a building deployment as busy and still ok", () => {
    const event = eventFromSite({ at: "2026-11-12T12:00:00Z", building: true });
    expect(event).toMatchObject({ ok: true, busy: true });
  });

  it("marks a failed deployment as not ok", () => {
    const event = eventFromSite({ at: "2026-11-12T12:00:00Z", state: "failed" });
    expect(event.ok).toBe(false);
  });
});

describe("syncOutcome", () => {
  it("reports a problem when the sync did not succeed", () => {
    expect(syncOutcome({ sync: { ok: false } })).toMatch(/had a problem/);
  });

  it("reports an update when there were shelf changes", () => {
    expect(syncOutcome({ sync: { ok: true, changes: ["Started Fourth Wing"] } })).toMatch(
      /updated/,
    );
  });

  it("reports already up to date when there were no changes", () => {
    expect(syncOutcome({ sync: { ok: true, changes: [] } })).toMatch(/already up to date/);
  });

  it("appends a warning note when present", () => {
    expect(syncOutcome({ sync: { ok: true, changes: [], warning: "Careful!" } })).toContain(
      "Careful!",
    );
  });
});

describe("mergeTimelineEvents", () => {
  it("includes a synthesized site row alongside the server-provided events", () => {
    const data = {
      events: [{ at: "2026-11-10T00:00:00Z", type: "editor", title: "Saved" }],
      site: { at: "2026-11-12T12:00:00Z", state: "live", label: "Site is live" },
    };
    const events = mergeTimelineEvents(data);
    expect(events.map((e) => e.title)).toEqual(["Site is live", "Saved"]);
  });

  it("adds a Checking Goodreads placeholder while a sync is pending and hasn't landed", () => {
    const data = { events: [], sync: { at: "" } };
    const events = mergeTimelineEvents(data, {
      active: true,
      watchMark: 0,
      at: "2026-11-12T12:00:00Z",
    });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Checking Goodreads…");
  });

  it("omits the placeholder once a newer event has landed", () => {
    const data = {
      events: [{ at: "2026-11-12T12:01:00Z", type: "goodreads", title: "Goodreads shelf sync" }],
      sync: { at: "2026-11-12T12:01:00Z" },
    };
    const watchMark = Date.parse("2026-11-12T12:00:00Z");
    const events = mergeTimelineEvents(data, {
      active: true,
      watchMark,
      at: "2026-11-12T12:00:30Z",
    });
    expect(events.map((e) => e.title)).toEqual(["Goodreads shelf sync"]);
  });

  it("sorts newest first across server events and the synthesized site row", () => {
    const data = {
      events: [{ at: "2026-11-12T10:00:00Z", type: "editor", title: "Earlier" }],
      site: { at: "2026-11-12T11:00:00Z", state: "live", label: "Later" },
    };
    expect(mergeTimelineEvents(data).map((e) => e.title)).toEqual(["Later", "Earlier"]);
  });
});
