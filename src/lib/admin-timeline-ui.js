// HTML string builders behind the admin editor's step panel (Save/Sync
// progress) and the Recent timeline. Kept dependency-free of the DOM so
// they're unit testable; callers inject the resulting HTML via
// innerHTML/set:html.
import { sameSync } from "./sync-timeline.js";
import { escapeHtml, formatTimeline, shortSyncProblem } from "./admin-format.js";

// Renders a vertical step tracker in a bordered card, styled like the
// Recent timeline (dot + connecting rail), so a multi-stage process (save
// or sync) reads as a single ongoing operation rather than a one-line
// status message.
export function progressSteps({ title, steps }) {
  const mark = (state) => {
    if (state === "done") {
      return `<span class="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage text-[11px] leading-none text-cream" aria-hidden="true">✓</span>`;
    }
    if (state === "error") {
      return `<span class="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] leading-none text-primary-foreground" aria-hidden="true">✕</span>`;
    }
    if (state === "busy") {
      return `<span class="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true"><span class="absolute h-3 w-3 animate-ping rounded-full bg-warning/60"></span><span class="relative h-2.5 w-2.5 rounded-full bg-warning"></span></span>`;
    }
    return `<span class="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card" aria-hidden="true"></span>`;
  };
  const labelClass = (state) =>
    state === "done"
      ? "text-foreground"
      : state === "error"
        ? "text-accent"
        : state === "busy"
          ? "text-warning"
          : "text-muted-foreground";
  const rows = steps
    .map(([state, label, detail], index) => {
      const rail =
        index < steps.length - 1
          ? `<span class="absolute left-1/2 top-5 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden="true"></span>`
          : "";
      return `<li class="relative flex gap-3 pb-4 last:pb-0"><div class="relative flex w-5 shrink-0 justify-center">${mark(state)}${rail}</div><div class="min-w-0 pt-0.5"><p class="text-sm font-medium ${labelClass(state)}">${label}</p>${detail ? `<p class="mt-0.5 text-xs text-muted-foreground">${detail}</p>` : ""}</div></li>`;
    })
    .join("");
  return `<div class="rounded-xl border border-border bg-card p-4"><p class="font-medium text-foreground">${title}</p><ol class="mt-3">${rows}</ol></div>`;
}

export function saveSteps({ title, editor, editorDetail, github, githubDetail, live, liveDetail }) {
  return progressSteps({
    title,
    steps: [
      [editor, "This editor", editorDetail],
      [github, "GitHub", githubDetail],
      [live, "Live site", liveDetail],
    ],
  });
}

export function syncSteps({
  title,
  request,
  requestDetail,
  github,
  githubDetail,
  live,
  liveDetail,
}) {
  return progressSteps({
    title,
    steps: [
      [request, "Sync request", requestDetail],
      [github, "GitHub", githubDetail],
      [live, "Live site", liveDetail],
    ],
  });
}

// The "Now reading / Up next / Changes" lines shown for a Goodreads sync,
// used by the Recent timeline when a row matches the current sync.
export function syncLines(sync) {
  const reading = (sync.reading || []).map((book) => {
    const percent = typeof book.progress === "number" ? ` (${book.progress}%)` : "";
    return `${book.title}${percent}`;
  });
  const next = (sync.upNext || []).map((book) => book.title).filter(Boolean);
  const lines = [
    "Now reading",
    ...(reading.length ? reading : ["None"]),
    "Up next",
    ...(next.length ? next : ["None"]),
  ];
  if (!sync.ok) {
    lines.push(
      shortSyncProblem(sync.warning || sync.error || "Goodreads shelf sync had a problem."),
    );
    return lines;
  }
  const changes = sync.changes || [];
  lines.push("Changes", ...(changes.length ? changes : ["No changes since the previous shelf."]));
  if (sync.warning) lines.push("Note", sync.warning);
  return lines;
}

// Shortens technical curl/HTTP failure text wherever it shows up in a
// Recent row's detail lines, not just the main sync summary.
export function presentLines(lines) {
  const blob = lines.join("\n");
  if (/Command failed: curl|curl: \(22\)/.test(blob)) return [shortSyncProblem(blob)];
  return lines.map((line) =>
    /returned error:\s*\d+|HTTP \d+/.test(line) ? shortSyncProblem(line) : line,
  );
}

export function activityDetail(lines, showAll) {
  if (!lines.length) return "";
  const labels = new Set(["Now reading", "Up next", "Changes"]);
  if (lines.length === 1 && !labels.has(lines[0])) {
    const detailClass = showAll
      ? "mt-1 text-muted-foreground"
      : "mt-1 line-clamp-2 text-muted-foreground";
    return `<p class="${detailClass}">${escapeHtml(lines[0])}</p>`;
  }
  return `<ul class="mt-1 space-y-0.5 text-muted-foreground">${lines
    .map((line) => {
      const label = labels.has(line);
      return `<li class="${label ? "mt-2 text-foreground first:mt-0" : ""}">${escapeHtml(line)}</li>`;
    })
    .join("")}</ul>`;
}

export function activityItem(event, time, placement, sync, showAll) {
  const failed = event.ok === false;
  const busy = Boolean(event.busy);
  const mark = busy
    ? "Rebuilding"
    : failed
      ? "Failed"
      : event.type === "goodreads"
        ? "Goodreads"
        : event.type === "site"
          ? "Site"
          : "Editor";
  const dotMark = busy
    ? `<span class="relative z-10 mt-1 flex h-2.5 w-2.5 items-center justify-center" aria-hidden="true"><span class="absolute h-3.5 w-3.5 animate-ping rounded-full bg-warning/60"></span><span class="relative h-2.5 w-2.5 rounded-full bg-warning"></span></span>`
    : `<span class="relative z-10 mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-background ${failed ? "border-2 border-accent bg-background" : "bg-sage"}" aria-hidden="true"></span>`;
  const rail =
    placement === "last" || placement === "only"
      ? ""
      : `<span class="absolute ${placement === "first" ? "top-3" : "top-0"} -bottom-2 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground" aria-hidden="true"></span>`;
  const by = event.by ? ` · ${escapeHtml(event.by)}` : "";
  const lines = presentLines(
    sync?.at && event.type === "goodreads" && sameSync(event.at, sync.at)
      ? syncLines(sync)
      : String(event.detail || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
  );
  return `<li class="group col-span-3 grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-3"><p class="pt-0.5 text-right text-xs text-muted-foreground tabular-nums">${escapeHtml(time)}</p><div class="relative flex justify-center">${rail}${dotMark}</div><div class="min-w-0 pb-7 group-last:pb-0"><p class="text-xs text-muted-foreground">${escapeHtml(mark)}${by}</p><p class="font-medium text-foreground">${escapeHtml(event.title)}</p>${activityDetail(lines, showAll)}</div></li>`;
}

export function activityLog(events, sync, showAll) {
  const groups = [];
  for (const event of events) {
    const stamp = formatTimeline(event.at);
    const last = groups.at(-1);
    if (!last || last.day !== stamp.day) groups.push({ day: stamp.day, items: [] });
    groups.at(-1).items.push({ event, time: stamp.time });
  }
  let index = 0;
  return groups
    .map((group, groupIndex) => {
      const rail =
        groupIndex > 0
          ? `<span class="absolute top-0 -bottom-2 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground" aria-hidden="true"></span>`
          : "";
      const heading = `<li class="col-span-3 grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-3"><div></div><div class="relative">${rail}</div><p class="${groupIndex === 0 ? "" : "pt-2"} pb-3 text-xs font-medium text-foreground">${escapeHtml(group.day)}</p></li>`;
      const rows = group.items
        .map((item) => {
          const placement =
            events.length === 1
              ? "only"
              : index === 0
                ? "first"
                : index === events.length - 1
                  ? "last"
                  : "middle";
          index += 1;
          return activityItem(item.event, item.time, placement, sync, showAll);
        })
        .join("");
      return heading + rows;
    })
    .join("");
}
