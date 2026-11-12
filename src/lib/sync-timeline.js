// Pure helpers behind the admin Studio editor's Recent timeline and the
// Sync now step panel. Kept dependency-free (no DOM) so they're unit
// testable and shared between admin.astro's bundled client script and
// (indirectly) the Vitest suite.

function timeValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

// True when two ISO-ish timestamps describe the same Goodreads sync. The
// admin API and the Pages-committed data file can disagree by a few
// seconds, so this treats anything within 5s as the same event.
export function sameSync(left, right) {
  const a = Date.parse(left || "");
  const b = Date.parse(right || "");
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 5000;
}

// The most recent known Goodreads activity timestamp. Used to tell whether
// a manual sync has produced a new Recent entry yet.
export function latestMark(data) {
  if (!data) return 0;
  const times = [data?.sync?.at];
  for (const event of data?.events || []) {
    if (event?.type === "goodreads") times.push(event.at);
  }
  let best = 0;
  for (const value of times) {
    const time = timeValue(value);
    if (time > best) best = time;
  }
  return best;
}

// Synthesizes a Recent timeline row from the current Cloudflare Pages build
// status, so the rebuild lifecycle (building -> live/failed) shows up
// alongside Goodreads/editor events instead of as a separate summary line.
export function eventFromSite(site) {
  if (!site?.at) return null;
  const failed = site.state === "failed";
  return {
    at: site.at,
    type: "site",
    ok: !failed,
    busy: Boolean(site.building),
    title: site.label || "Rebuild",
    detail: site.commitHash ? `Build ${site.commitHash.slice(0, 7)}` : "",
    by: site.trigger || "",
  };
}

// The headline shown once a manual sync's outcome is known.
export function syncOutcome(data) {
  const sync = data?.sync || {};
  if (!sync.ok) return "Goodreads sync had a problem. The previous shelf was kept.";
  const note = sync.warning ? ` ${sync.warning}` : "";
  if ((sync.changes || []).length) return `Goodreads shelf updated. A changed shelf goes live on the next publish.${note}`;
  return `Goodreads shelf is already up to date.${note}`;
}

// Builds the full Recent list: server-provided events + the synthetic site
// build row + (while a manual sync is pending and hasn't landed yet) a
// placeholder row, sorted newest-first.
export function mergeTimelineEvents(data, pending = {}) {
  const events = [...(data?.events || [])];
  const siteEvent = eventFromSite(data?.site || {});
  if (siteEvent) events.push(siteEvent);
  if (pending.active && latestMark(data) <= (pending.watchMark || 0)) {
    events.push({
      at: pending.at,
      type: "goodreads",
      ok: true,
      title: "Checking Goodreads…",
      detail: "",
      by: "",
    });
  }
  events.sort((left, right) => timeValue(right.at) - timeValue(left.at));
  return events;
}
