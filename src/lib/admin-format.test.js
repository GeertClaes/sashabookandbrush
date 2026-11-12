import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatTimeline,
  formatWhen,
  shortSyncProblem,
  toBase64,
} from "./admin-format.js";

describe("escapeHtml", () => {
  it("escapes ampersands, angle brackets, and quotes", () => {
    expect(escapeHtml(`Tom & "Jerry" <script>`)).toBe("Tom &amp; &quot;Jerry&quot; &lt;script>");
  });

  it("coerces non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("formatWhen", () => {
  it("returns 'not yet' for a missing value", () => {
    expect(formatWhen(null)).toBe("not yet");
    expect(formatWhen("")).toBe("not yet");
  });

  it("returns the raw value when it cannot be parsed as a date", () => {
    expect(formatWhen("not a date")).toBe("not a date");
  });

  it("formats a valid date using the British locale and London timezone", () => {
    expect(formatWhen("2026-11-12T12:00:00Z")).toBe("12 Nov 2026, 12:00");
  });
});

describe("formatTimeline", () => {
  it("returns an unknown-date placeholder for a missing or unparsable value", () => {
    expect(formatTimeline("")).toEqual({ day: "Unknown date", time: "" });
    expect(formatTimeline("not a date")).toEqual({ day: "Unknown date", time: "" });
  });

  it("splits a valid date into a day heading and a time", () => {
    expect(formatTimeline("2026-11-12T12:00:00Z")).toEqual({ day: "12 Nov 2026", time: "12:00" });
  });
});

describe("shortSyncProblem", () => {
  it("shortens a 'returned error: NNN' message to a plain-English line", () => {
    expect(shortSyncProblem("Command failed: curl returned error: 503")).toBe(
      "Goodreads returned HTTP 503. The previous shelf was kept.",
    );
  });

  it("shortens an 'HTTP NNN' message", () => {
    expect(shortSyncProblem("Request failed with HTTP 404")).toBe(
      "Goodreads returned HTTP 404. The previous shelf was kept.",
    );
  });

  it("returns the text unchanged when it has no recognisable status code", () => {
    expect(shortSyncProblem("Network timeout")).toBe("Network timeout");
  });

  it("handles a missing/falsy value", () => {
    expect(shortSyncProblem(undefined)).toBe("");
  });
});

describe("toBase64", () => {
  it("encodes an ArrayBuffer to a base64 string", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(toBase64(bytes.buffer)).toBe(btoa("hello"));
  });

  it("handles an empty buffer", () => {
    expect(toBase64(new ArrayBuffer(0))).toBe("");
  });
});
