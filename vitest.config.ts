import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/_stubs/server-only.ts"),
      "@/app": path.resolve(__dirname, "app"),
      "@/domain": path.resolve(__dirname, "src/domain"),
      "@/application": path.resolve(__dirname, "src/application"),
      "@/server": path.resolve(__dirname, "src/server"),
      "@/shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    server: {
      // otplib ships CJS; vite's default external resolution returns an empty
      // namespace — inlining lets vite transform it correctly.
      deps: { inline: [/^otplib/, /^@otplib\//] },
    },
    globalSetup: ["./tests/_setup/migrate.ts"],
    env: {
      DATABASE_URL: "file:./test-only.db",
      SESSION_SECRET: "test-session-secret-padded-to-32-chars-xxxx",
      TOTP_ENCRYPTION_KEY: "test-totp-encryption-key-padded-to-32-yyy",
      NODE_ENV: "test",
    },
  },
});
