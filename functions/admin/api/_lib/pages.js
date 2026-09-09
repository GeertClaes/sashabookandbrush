function token(env) {
  return env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || "";
}

function accountId(env) {
  return env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "";
}

function projectName(env) {
  return env.CF_PAGES_PROJECT || "sashabookandbrush";
}

export async function listDeployments(env) {
  const apiToken = token(env);
  const account = accountId(env);
  const project = projectName(env);
  if (!apiToken || !account) return { available: false, deployments: [] };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(project)}/deployments?per_page=8`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.message || `Cloudflare ${response.status}`);
  }
  return {
    available: true,
    deployments: Array.isArray(data.result) ? data.result : [],
  };
}

export function summarizeDeployments(deployments = []) {
  const latest = deployments[0];
  if (!latest) {
    return {
      state: "unknown",
      label: "The public site updates about a minute after a save or Goodreads cron.",
      at: "",
      trigger: "",
      live: false,
      building: false,
    };
  }

  const stage = latest.latest_stage || {};
  const status = String(stage.status || "").toLowerCase();
  const triggerType = String(latest.deployment_trigger?.type || "");
  const trigger =
    triggerType === "ad_hoc"
      ? "Goodreads cron / deploy hook"
      : triggerType === "github"
        ? "GitHub (admin save or push)"
        : triggerType || "rebuild";
  const at = stage.ended_on || stage.started_on || latest.created_on || "";
  const building = status === "active" || status === "idle" || status === "initialized";
  const failed = status === "failure" || status === "canceled";
  const live = status === "success";

  let label = "Rebuild";
  if (building) label = "Rebuild in progress — the public site still shows the last live version";
  else if (live) label = "Site is live";
  else if (failed) label = "Last rebuild failed";
  else if (status === "skipped") label = "Last rebuild was skipped";

  return {
    state: building ? "building" : live ? "live" : failed ? "failed" : status || "unknown",
    label,
    at,
    trigger,
    live,
    building,
    commit: latest.deployment_trigger?.metadata?.commit_message || "",
  };
}
