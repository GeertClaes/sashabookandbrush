// Save progress for the admin editor. Local and production sentences stay
// different: this computer versus a GitHub commit and a Cloudflare rebuild.
import { escapeHtml } from "./admin-format.js";
import { saveSteps } from "./admin-timeline-ui.js";

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createSaveUi({ isDev, call, renderActivity, setBanner, loadActivity }) {
  let saving = false;
  let saveWatch = 0;

  async function watchRebuild(label) {
    const id = ++saveWatch;
    for (let i = 0; i < 18; i++) {
      await wait(i === 0 ? 4000 : 8000);
      if (id !== saveWatch) return;
      try {
        const data = await call("/activity");
        renderActivity(data);
        const site = data.site || {};
        if (site.building) {
          setBanner(
            "busy",
            saveSteps({
              title: `Saved ${escapeHtml(label)}`,
              editor: "done",
              editorDetail: "This editor already has your edits.",
              github: "done",
              githubDetail: "Committed.",
              live: "busy",
              liveDetail:
                "Cloudflare is rebuilding. The public site still shows the old version until this finishes (usually about a minute).",
            }),
          );
          continue;
        }
        if (site.state === "failed") {
          setBanner(
            "error",
            saveSteps({
              title: `Saved ${escapeHtml(label)} to GitHub, but the rebuild failed.`,
              editor: "done",
              editorDetail: "This editor already has your edits.",
              github: "done",
              githubDetail: "Committed.",
              live: "error",
              liveDetail: "Try Save again, or check Cloudflare Pages.",
            }),
          );
          return;
        }
        if (site.live || site.deploymentsAvailable === false) {
          setBanner(
            "ok",
            saveSteps({
              title: `Saved ${escapeHtml(label)}`,
              editor: "done",
              editorDetail: "This editor already has your edits.",
              github: "done",
              githubDetail: "Committed.",
              live: site.deploymentsAvailable === false ? "busy" : "done",
              liveDetail:
                site.deploymentsAvailable === false
                  ? "GitHub has it. Refresh the public page in about a minute."
                  : "Live. Refresh the public page to see the change.",
            }),
          );
          if (site.live) return;
        }
      } catch {
        // Keep waiting — activity is best-effort.
      }
    }
    if (id !== saveWatch) return;
    setBanner(
      "ok",
      saveSteps({
        title: `Saved ${escapeHtml(label)} to GitHub`,
        editor: "done",
        editorDetail: "This editor already has your edits.",
        github: "done",
        githubDetail: "Committed.",
        live: "busy",
        liveDetail: "Cloudflare can take a couple of minutes. Refresh the public page shortly.",
      }),
    );
  }

  async function withSave(button, idleLabel, work) {
    if (saving) {
      setBanner("busy", "Already saving — wait for GitHub to finish this one.");
      return;
    }
    saving = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }
    setBanner(
      "busy",
      saveSteps({
        title: isDev
          ? "Saving on this computer…"
          : "Saving to GitHub… this can take a few seconds.",
        editor: "busy",
        editorDetail: "Writing your changes.",
        github: isDev ? "wait" : "busy",
        githubDetail: isDev ? "Skipped on this computer." : "Committing to the repository.",
        live: "wait",
        liveDetail: isDev
          ? "The public site on this computer updates after you refresh."
          : "Cloudflare rebuilds the live site after GitHub — usually about a minute.",
      }),
    );
    try {
      const result = await work();
      const label = result?.label || "changes";
      if (isDev) {
        setBanner(
          "ok",
          saveSteps({
            title: `Saved ${escapeHtml(label)}`,
            editor: "done",
            editorDetail: "Saved.",
            github: "wait",
            githubDetail: "Skipped on this computer.",
            live: "wait",
            liveDetail: result?.hint || "Refresh the site on this computer to see it.",
          }),
        );
      } else {
        setBanner(
          "ok",
          saveSteps({
            title: `Saved ${escapeHtml(label)} to GitHub`,
            editor: "done",
            editorDetail: "This editor already has your edits.",
            github: "done",
            githubDetail: "Committed.",
            live: "busy",
            liveDetail: "Cloudflare is rebuilding the live site — usually about a minute.",
          }),
        );
        watchRebuild(label);
      }
      loadActivity();
    } catch (error) {
      setBanner("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      saving = false;
      if (button) {
        button.disabled = false;
        button.textContent = idleLabel;
      }
    }
  }

  return { withSave };
}
