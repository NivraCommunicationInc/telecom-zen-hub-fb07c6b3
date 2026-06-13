import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/**", "supabase/migrations/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "security": security,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": "warn",
      "prefer-const": "warn",
      "no-useless-escape": "warn",
      "no-case-declarations": "warn",
      "no-constant-binary-expression": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "security/detect-unsafe-regex": "warn",
      "no-control-regex": "warn",
      // Security rules
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "error",
      // Custom rule to warn about dangerouslySetInnerHTML usage (requires manual sanitization check)
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "SECURITY: dangerouslySetInnerHTML detected. Ensure content is sanitized with DOMPurify before use."
        },
        // Anti-regression: Forbid free-text address inputs (except line2/unit/apt)
        {
          selector: "JSXOpeningElement[name.name='Input'][attributes.length>0]:has(JSXAttribute[name.name='placeholder'][value.value=/(?:^|\\s)(adresse|address)(?!.*(?:apt|unit|suite|line2|appartement|unité)).*$/i])",
          message: "ADDRESS SECURITY: Free-text address inputs are forbidden. Use AddressAutocomplete, PortalAddressAutocomplete, or AdminAddressAutocomplete instead. Only Apt/Suite/Unit fields may use plain Input."
        },
        {
          selector: "JSXOpeningElement[name.name='Input'][attributes.length>0]:has(JSXAttribute[name.name='id'][value.value=/^(?:.*-)?address(?!.*(?:apartment|apt|unit|suite|line2)).*$/i]):not(:has(JSXAttribute[name.name='type'][value.value='hidden']))",
          message: "ADDRESS SECURITY: Input with 'address' id pattern detected. Use AddressAutocomplete components instead of plain Input for address fields."
        }
      ]
    },
  },
);
