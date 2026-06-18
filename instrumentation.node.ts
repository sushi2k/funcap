// Node-only instrumentation. Lives in its own file so Webpack tree-shakes it
// out of the Edge bundle (node-cron uses child_process and can't survive
// Edge compilation).

import { startFinalizeScheduler } from "@/server/scheduler/finalize";

export function init(): void {
  startFinalizeScheduler();
}
