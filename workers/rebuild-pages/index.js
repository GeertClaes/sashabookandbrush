export default {
  async scheduled(_event, env) {
    const hook = env.CLOUDFLARE_PAGES_DEPLOY_HOOK;
    if (!hook) throw new Error("CLOUDFLARE_PAGES_DEPLOY_HOOK is not set");
    const response = await fetch(hook, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Deploy hook failed (${response.status})`);
    }
  },
};
