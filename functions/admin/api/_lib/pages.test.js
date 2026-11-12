import { describe, expect, it } from "vitest";
import { isBuildingDeployment, isSkippedDeployment, summarizeDeployments } from "./pages.js";

function deployment(overrides = {}) {
  return {
    id: "dep-1",
    created_on: "2026-11-12T10:00:00Z",
    latest_stage: {
      status: "success",
      started_on: "2026-11-12T10:00:00Z",
      ended_on: "2026-11-12T10:01:00Z",
    },
    deployment_trigger: {
      type: "github",
      metadata: { commit_hash: "abc1234567", commit_message: "Update" },
    },
    ...overrides,
  };
}

describe("isSkippedDeployment", () => {
  it("is false for a normal deployment", () => {
    expect(isSkippedDeployment(deployment())).toBe(false);
  });

  it("is true when the stage status is skipped", () => {
    expect(isSkippedDeployment(deployment({ latest_stage: { status: "skipped" } }))).toBe(true);
  });

  it("is true when the commit message contains a skip-ci marker", () => {
    expect(
      isSkippedDeployment(
        deployment({ deployment_trigger: { metadata: { commit_message: "docs [skip ci]" } } }),
      ),
    ).toBe(true);
  });

  it("is false for a missing deployment", () => {
    expect(isSkippedDeployment(null)).toBe(false);
  });
});

describe("isBuildingDeployment", () => {
  it.each(["active", "idle", "initialized", "queued"])("is true while status is %s", (status) => {
    expect(isBuildingDeployment(deployment({ latest_stage: { status } }))).toBe(true);
  });

  it("is false once the deployment has finished", () => {
    expect(isBuildingDeployment(deployment({ latest_stage: { status: "success" } }))).toBe(false);
  });

  it("is false for a skipped deployment even if its status looks active", () => {
    expect(
      isBuildingDeployment(deployment({ latest_stage: { status: "active" }, is_skipped: true })),
    ).toBe(false);
  });
});

describe("summarizeDeployments", () => {
  it("reports an unknown/no-deploys state for an empty list", () => {
    const summary = summarizeDeployments([]);
    expect(summary.state).toBe("unknown");
    expect(summary.live).toBe(false);
    expect(summary.building).toBe(false);
  });

  it("reports building while the deployment is in progress", () => {
    const summary = summarizeDeployments([deployment({ latest_stage: { status: "active" } })]);
    expect(summary.state).toBe("building");
    expect(summary.building).toBe(true);
    expect(summary.label).toMatch(/rebuild in progress/i);
  });

  it("reports live once the deployment succeeds", () => {
    const summary = summarizeDeployments([deployment()]);
    expect(summary.state).toBe("live");
    expect(summary.live).toBe(true);
    expect(summary.label).toMatch(/site is live/i);
  });

  it("reports failed for a failed deployment", () => {
    const summary = summarizeDeployments([deployment({ latest_stage: { status: "failure" } })]);
    expect(summary.state).toBe("failed");
    expect(summary.label).toMatch(/failed/i);
  });

  it("skips a skipped deployment and reports the next relevant one", () => {
    const skipped = deployment({ id: "dep-2", latest_stage: { status: "skipped" } });
    const real = deployment({ id: "dep-1", latest_stage: { status: "success" } });
    const summary = summarizeDeployments([skipped, real]);
    expect(summary.deployId).toBe("dep-1");
    expect(summary.live).toBe(true);
  });

  it("falls back to a skipped-only summary when every deployment is skipped", () => {
    const summary = summarizeDeployments([deployment({ latest_stage: { status: "skipped" } })]);
    expect(summary.state).toBe("skipped");
    expect(summary.live).toBe(false);
  });
});
