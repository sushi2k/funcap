// Seed: first admin (+ optional sample data).
//
// Real implementation lands with issue #2 (auth/MFA). This stub keeps the
// `npm run seed` script wired so the scaffold acceptance criterion is met.

async function main() {
  console.log("[seed] no-op — first-admin creation lands in issue #2.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
