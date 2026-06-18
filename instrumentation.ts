// Next.js startup hook. Runs once per server boot, on whichever runtime the
// request hits. The scheduler is Node-only (node-cron uses child_process),
// so it lives in instrumentation.node.ts and is dynamically imported from
// the literal path Next's bundler recognises for runtime tree-shaking.

export async function register() {
  // eslint-disable-next-line no-restricted-syntax -- NEXT_RUNTIME is a Next-internal env, not a secret
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const mod = await import("./instrumentation.node");
    mod.init();
  }
}
