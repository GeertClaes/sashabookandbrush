function token(env) {
  return env.ADMIN_GITHUB_TOKEN || env.GITHUB_TOKEN || "";
}

function branch(env) {
  return env.GITHUB_BRANCH || "main";
}

export async function github(env, apiPath, init = {}) {
  const repo = env.GITHUB_REPO;
  if (!repo) throw new Error("GITHUB_REPO is not set");
  if (!token(env)) throw new Error("GITHUB_TOKEN is not set");

  const response = await fetch(`https://api.github.com/repos/${repo}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token(env)}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sashabookandbrush-admin",
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
  if (!response.ok) {
    throw new Error(data.message || `GitHub ${response.status}`);
  }
  return data;
}

export async function getTextFile(env, filePath) {
  const data = await github(env, `/contents/${filePath}?ref=${encodeURIComponent(branch(env))}`);
  const binary = atob(String(data.content || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function tryGetTextFile(env, filePath) {
  try {
    return await getTextFile(env, filePath);
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return null;
    throw error;
  }
}

export async function fileExists(env, filePath) {
  try {
    await github(env, `/contents/${filePath}?ref=${encodeURIComponent(branch(env))}`);
    return true;
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return false;
    throw error;
  }
}

export async function commitFiles(env, message, files) {
  const ref = await github(env, `/git/ref/heads/${branch(env)}`);
  const commitSha = ref.object.sha;
  const commit = await github(env, `/git/commits/${commitSha}`);

  const treeItems = [];
  for (const file of files) {
    if (file.delete) {
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: null,
      });
      continue;
    }
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

  await github(env, `/git/refs/heads/${branch(env)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: next.sha }),
  });

  return next.sha;
}
