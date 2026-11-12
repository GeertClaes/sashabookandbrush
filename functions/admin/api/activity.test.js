import { describe, expect, it } from "vitest";
import { chooseLive, mergeActivityEvents } from "./activity.js";

describe("chooseLive", () => {
  it("prefers the committed git copy when it is at least as new", () => {
    const git = { lastSync: { at: "2026-11-12T12:00:00Z" } };
    const deployed = { lastSync: { at: "2026-11-11T12:00:00Z" } };
    expect(chooseLive(deployed, git)).toBe(git);
  });

  it("falls back to the deployed copy when git has nothing recorded yet", () => {
    const deployed = { lastSync: { at: "2026-11-11T12:00:00Z" } };
    expect(chooseLive(deployed, {})).toBe(deployed);
  });

  it("prefers the deployed copy when it is newer than the committed git copy", () => {
    const git = { lastSync: { at: "2026-11-10T12:00:00Z" } };
    const deployed = { lastSync: { at: "2026-11-12T12:00:00Z" } };
    expect(chooseLive(deployed, git)).toBe(deployed);
  });

  it("returns an empty object when neither source has anything", () => {
    expect(chooseLive(null, null)).toEqual({});
  });
});

describe("mergeActivityEvents", () => {
  const sync = {
    at: "2026-11-12T12:00:00Z",
    ok: true,
    source: "github-actions",
    changes: [],
    reading: [{ title: "Fourth Wing", progress: 50 }],
    upNext: [],
  };

  it("adds a synthesized Goodreads event when the log doesn't already have it", () => {
    const events = mergeActivityEvents([], sync);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "goodreads", ok: true, title: "Goodreads shelf sync" });
  });

  it("does not duplicate an event already recorded for the same sync", () => {
    const logEvents = [
      { at: "2026-11-12T12:00:02Z", type: "goodreads", title: "Goodreads shelf sync" },
    ];
    const events = mergeActivityEvents(logEvents, sync);
    expect(events).toHaveLength(1);
  });

  it("sorts events newest first", () => {
    const logEvents = [
      { at: "2026-11-10T00:00:00Z", type: "editor", title: "Saved a book" },
      { at: "2026-11-13T00:00:00Z", type: "editor", title: "Saved another book" },
    ];
    const events = mergeActivityEvents(logEvents, sync);
    expect(events.map((e) => e.title)).toEqual([
      "Saved another book",
      "Goodreads shelf sync",
      "Saved a book",
    ]);
  });

  it("skips the synthesized event entirely when there is no sync timestamp", () => {
    const events = mergeActivityEvents(
      [{ at: "2026-11-10T00:00:00Z", type: "editor", title: "Saved" }],
      {},
    );
    expect(events).toHaveLength(1);
  });
});
