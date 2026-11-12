import { describe, expect, it } from "vitest";
import {
  activityDetail,
  activityItem,
  activityLog,
  presentLines,
  progressSteps,
  saveSteps,
  syncLines,
  syncSteps,
} from "./admin-timeline-ui.js";

describe("progressSteps", () => {
  it("renders a done step with a check mark and a busy step as pulsing", () => {
    const html = progressSteps({
      title: "Saving",
      steps: [
        ["done", "This editor", "Saved."],
        ["busy", "Live site", "Rebuilding."],
      ],
    });
    expect(html).toContain("Saving");
    expect(html).toContain("This editor");
    expect(html).toContain("✓");
    expect(html).toContain("animate-ping");
    expect(html).toContain("Rebuilding.");
  });

  it("renders a failed step with a cross mark", () => {
    const html = progressSteps({ title: "Saving", steps: [["error", "GitHub", "Save failed."]] });
    expect(html).toContain("✕");
    expect(html).toContain("Save failed.");
  });

  it("renders a pending step as an empty circle with no detail paragraph", () => {
    const html = progressSteps({ title: "Saving", steps: [["pending", "Live site", ""]] });
    expect(html).not.toContain("✓");
    expect(html).not.toContain("✕");
    expect(html).not.toContain("animate-ping");
  });
});

describe("saveSteps / syncSteps", () => {
  it("saveSteps labels its three stages: editor, GitHub, live site", () => {
    const html = saveSteps({ title: "Saved", editor: "done", github: "done", live: "busy" });
    expect(html).toContain("This editor");
    expect(html).toContain("GitHub");
    expect(html).toContain("Live site");
  });

  it("syncSteps labels its three stages: sync request, GitHub, live site", () => {
    const html = syncSteps({ title: "Syncing", request: "done", github: "busy", live: "pending" });
    expect(html).toContain("Sync request");
    expect(html).toContain("GitHub");
    expect(html).toContain("Live site");
  });
});

describe("syncLines", () => {
  it("lists currently-reading progress and up-next titles", () => {
    const lines = syncLines({
      ok: true,
      reading: [{ title: "Fourth Wing", progress: 50 }],
      upNext: [{ title: "Hollow Bones" }],
      changes: ["Started Fourth Wing"],
    });
    expect(lines).toEqual([
      "Now reading",
      "Fourth Wing (50%)",
      "Up next",
      "Hollow Bones",
      "Changes",
      "Started Fourth Wing",
    ]);
  });

  it("falls back to 'None' and 'No changes' placeholders when empty", () => {
    const lines = syncLines({ ok: true, reading: [], upNext: [], changes: [] });
    expect(lines).toEqual([
      "Now reading",
      "None",
      "Up next",
      "None",
      "Changes",
      "No changes since the previous shelf.",
    ]);
  });

  it("appends a shortened problem line instead of changes when the sync failed", () => {
    const lines = syncLines({ ok: false, reading: [], upNext: [], error: "HTTP 503" });
    expect(lines.at(-1)).toBe("Goodreads returned HTTP 503. The previous shelf was kept.");
  });
});

describe("presentLines", () => {
  it("collapses a curl failure blob into a single shortened line", () => {
    expect(presentLines(["Command failed: curl returned error: 503", "extra detail"])).toEqual([
      "Goodreads returned HTTP 503. The previous shelf was kept.",
    ]);
  });

  it("shortens individual HTTP-error lines while leaving others untouched", () => {
    expect(presentLines(["All good", "Request failed with HTTP 404"])).toEqual([
      "All good",
      "Goodreads returned HTTP 404. The previous shelf was kept.",
    ]);
  });
});

describe("activityDetail", () => {
  it("returns an empty string for no lines", () => {
    expect(activityDetail([], false)).toBe("");
  });

  it("renders a single freeform line as a paragraph, clamped when not showing all", () => {
    expect(activityDetail(["Painting saved."], false)).toContain("line-clamp-2");
    expect(activityDetail(["Painting saved."], true)).not.toContain("line-clamp-2");
  });

  it("renders labelled sections as a list", () => {
    const html = activityDetail(["Now reading", "Fourth Wing", "Up next", "Hollow Bones"], false);
    expect(html).toContain("<ul");
    expect(html).toContain("Fourth Wing");
  });
});

describe("activityItem", () => {
  const event = {
    type: "editor",
    title: "Updated Garden bridge",
    detail: "Painting saved.",
    ok: true,
  };

  it("renders the event title and a dot without a failure style when ok", () => {
    const html = activityItem(event, "17:09", "middle", {}, false);
    expect(html).toContain("Updated Garden bridge");
    expect(html).not.toContain("border-accent");
  });

  it("marks a failed event with the accent ring and 'Failed' label", () => {
    const html = activityItem({ ...event, ok: false }, "17:09", "middle", {}, false);
    expect(html).toContain("Failed");
    expect(html).toContain("border-accent");
  });

  it("shows a pulsing dot for a busy (rebuilding) event", () => {
    const html = activityItem({ ...event, busy: true }, "17:09", "middle", {}, false);
    expect(html).toContain("Rebuilding");
    expect(html).toContain("animate-ping");
  });

  it("substitutes live sync lines when the event matches the current sync timestamp", () => {
    const syncEvent = {
      type: "goodreads",
      title: "Goodreads shelf sync",
      at: "2026-11-12T12:00:00Z",
    };
    const sync = { at: "2026-11-12T12:00:00Z", ok: true, reading: [], upNext: [], changes: [] };
    const html = activityItem(syncEvent, "12:00", "middle", sync, false);
    expect(html).toContain("No changes since the previous shelf.");
  });

  it("omits the connecting rail for the only/last item", () => {
    const only = activityItem(event, "17:09", "only", {}, false);
    const first = activityItem(event, "17:09", "first", {}, false);
    expect(only).not.toContain("w-0.5");
    expect(first).toContain("w-0.5");
  });
});

describe("activityLog", () => {
  it("groups events under day headings in order", () => {
    const html = activityLog(
      [
        { type: "editor", title: "First", at: "2026-11-12T12:00:00Z", detail: "" },
        { type: "editor", title: "Second", at: "2026-11-11T12:00:00Z", detail: "" },
      ],
      {},
      false,
    );
    const firstIndex = html.indexOf("First");
    const secondIndex = html.indexOf("Second");
    const laterHeading = html.indexOf("12 Nov 2026");
    const earlierHeading = html.indexOf("11 Nov 2026");
    expect(laterHeading).toBeGreaterThanOrEqual(0);
    expect(earlierHeading).toBeGreaterThan(laterHeading);
    expect(firstIndex).toBeLessThan(earlierHeading);
    expect(secondIndex).toBeGreaterThan(earlierHeading);
  });

  it("returns an empty string for no events", () => {
    expect(activityLog([], {}, false)).toBe("");
  });
});
