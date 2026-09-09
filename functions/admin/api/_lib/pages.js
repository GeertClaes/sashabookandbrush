function token(env) {
  return env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || "";
}

function accountId(env) {
  return env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "";
}

function projectName(env) {
  return env.CF_PAGES_PROJECT || "sashabookandbrush";
}

function stageStatus(deployment) {
  return String(deployment?.latest_stage?.status || "").toLowerCase();
}

function commitMessage(deployment) {
  return String(deployment?.deployment_trigger?.metadata?.commit_message || "");
}

function triggerLabel(deployment) {
  const triggerType = String(deployment?.deployment_trigger?.type || "");
  if (triggerType === "ad_hoc") return "Goodreads cron / deploy hook";
  if (triggerType === "github" || triggerType === "github:push" || triggerType === "github:pull_request") {
    return "GitHub (admin save or push)";
  }
  return triggerType || "rebuild";
}

export function isSkippedDeployment(deployment) {
  if (!deployment) return false;
  if (deployment.is_skipped) return true;
  if (stageStatus(deployment) === "skipped") return true;
  return /\[(?:ci[- ]skip|skip[- ]ci|cf-pages-skip)\]/i.test(commitMessage(deployment));
}

export function isBuildingDeployment(deployment) {
  if (!deployment || isSkippedDeployment(deployment)) return false;
  const status = stageStatus(deployment);
  return status === "active" || status === "idle" || status === "initialized" || status === "queued";
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
  const relevant = deployments.find((item) => !isSkippedDeployment(item));
  if (!relevant) {
    return {
      state: latest ? "skipped" : "unknown",
      label: latest
        ? "Latest GitHub event was skipped — the public site is unchanged"
        : "The public site updates about a minute after a save or Goodreads cron.",
      at: latest?.created_on || "",
      trigger: triggerLabel(latest),
      live: false,
      building: false,
      commit: commitMessage(latest),
    };
  }

  const stage = relevant.latest_stage || {};
  const status = stageStatus(relevant);
  const at = stage.ended_on || stage.started_on || relevant.created_on || "";
  const building = isBuildingDeployment(relevant);
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
    trigger: triggerLabel(relevant),
    live,
    building,
    commit: commitMessage(relevant),
  };
}
