// Vitest stub for the 'server-only' package. In Next.js the bundler aliases
// 'server-only' to an empty module for the server build; in raw Node/vitest
// the default entry throws, so we alias to this empty file from vitest.config.
export {};
