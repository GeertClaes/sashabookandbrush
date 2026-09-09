const API = "https://api.github.com";

function tokenFromEnv(env = process.env) {
  return env.ADMIN_GITHUB_TOKEN || env.GITHUB_TOKEN || "";
}

function branchFromEnv(env = process.env) {
  return env.GITHUB_BRANCH || "main";
}

async function github(env, apiPath, init = {}) {
  const repo = env.GITHUB_REPO;
  const token = tokenFromEnv(env);
  if (!repo) throw new Error("GITHUB_REPO is not set");
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const response = await fetch(`${API}/repos/${repo}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sashabookandbrush-build",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) throw new Error(data.message || `GitHub ${response.status}`);
  return data;
}

export async function commitFilesFromEnv(env, message, files) {
  const branch = branchFromEnv(env);
  const ref = await github(env, `/git/ref/heads/${branch}`);
  const commitSha = ref.object.sha;
  const commit = await github(env, `/git/commits/${commitSha}`);

  const treeItems = [];
  for (const file of files) {
    const blob = await github(env, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({
        content: file.content,
        encoding: file.encoding || "utf-8",
      }),
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await github(env, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: commit.tree.sha,
      tree: treeItems,
    }),
  });

  const next = await github(env, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [commitSha],
    }),
  });

  await github(env, `/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: next.sha }),
  });

  return next.sha;
}
