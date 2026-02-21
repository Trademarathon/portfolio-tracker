import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Project-specific ignores:
    "terminal-dashboard/**",
    "src-tauri/target/**",
  ]),
  // Custom rule overrides to reduce noise
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      // Allow unused vars with underscore prefix or when they match common patterns
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      // Allow explicit any - many APIs return any type
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unescaped entities - they render fine in React
      "react/no-unescaped-entities": "off",
      // Allow @ts-ignore when needed
      "@typescript-eslint/ban-ts-comment": "off",
      // Allow setState in effects for hydration patterns
      "react-hooks/set-state-in-effect": "off",
      // Allow anonymous components (memo, forwardRef, etc.)
      "react/display-name": "off",
      // Disable empty object type rule
      "@typescript-eslint/no-empty-object-type": "off",
      // Disable React Compiler rules (Next.js 16 experimental)
      "react-compiler/react-compiler": "off",
      // Allow accessing refs during render (common pattern)
      "react-hooks/refs": "off",
      // Allow creating components during render (common pattern)
      "react-hooks/static-components": "off",
      // Allow impure function calls during render
      "react-hooks/impure-functions": "off",
      // Allow memoization patterns
      "react-hooks/memoization": "off",
      // Allow purity issues
      "react-hooks/purity": "off",
      // Allow variable access order issues
      "react-hooks/declaration-order": "off",
      // Allow memoization patterns (preserve-manual)
      "react-hooks/preserve-manual-memoization": "off",
      // Allow hoisting patterns
      "react-hooks/hoisting": "off",
      // Allow immutability patterns
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
