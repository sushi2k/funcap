/**
 * Funcap ESLint config — enforces the security rails from security.md §6.
 *
 *  - DAL-1 / SEC-1: @prisma/client and secret process.env reads only inside the DAL/config.
 *  - IN-2:          no $queryRawUnsafe.
 *  - IN-3:          no dangerouslySetInnerHTML.
 */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message:
          "process.env may only be read from src/server/config/** (SEC-1). Import the validated config object instead.",
      },
      {
        selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
        message: "$queryRawUnsafe is banned (IN-2). Use parameterised Prisma queries.",
      },
      {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: "dangerouslySetInnerHTML is banned (IN-3). Render text or use a sanitiser inside the DAL boundary.",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@prisma/client",
            message:
              "@prisma/client may only be imported from src/server/dal/** (DAL-1). Call the DAL from services.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["src/server/dal/**/*.{ts,tsx}", "src/server/config/**/*.{ts,tsx}", "prisma/**/*.ts"],
      rules: {
        "no-restricted-syntax": "off",
        "no-restricted-imports": "off",
      },
    },
    {
      // instrumentation.ts checks NEXT_RUNTIME — Next-internal, not a secret.
      files: ["instrumentation.ts"],
      rules: { "no-restricted-syntax": "off" },
    },
  ],
};
