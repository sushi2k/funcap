import "server-only";
import cron from "node-cron";
import { config } from "@/server/config";
import { finalizeAllDue, type FinalizeResult } from "@/server/dal/tournaments";

// Survive Next.js dev hot-reload: stash the started flag on globalThis so a
// module re-evaluation doesn't double-register the cron.
declare global {
  // eslint-disable-next-line no-var
  var __funcap_finalize_started: boolean | undefined;
}

// Manual runner — invoked by the scheduled job and exposed for tests/dev.
export async function runFinalize(now: number = Date.now()): Promise<FinalizeResult> {
  return finalizeAllDue(now);
}

export function startFinalizeScheduler(): void {
  if (globalThis.__funcap_finalize_started) return;
  globalThis.__funcap_finalize_started = true;

  const expr = config.FUNCAP_FINALIZE_CRON;
  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid FUNCAP_FINALIZE_CRON: ${expr}`);
    return;
  }

  cron.schedule(expr, async () => {
    try {
      const r = await runFinalize();
      if (r.finalizedTournamentIds.length > 0) {
        console.log(
          `[scheduler] finalized ${r.finalizedTournamentIds.length} tournament(s); auto-voided ${r.voidedMatchCount} match(es).`,
        );
      }
    } catch (err) {
      console.error("[scheduler] finalize failed:", err);
    }
  });

  console.log(`[scheduler] finalize cron registered: ${expr}`);
}
