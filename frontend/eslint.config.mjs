import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Desligada (dívida de lint registrada em docs/progress.md): a regra nova
      // do eslint-config-next 16 marca como erro o padrão legítimo de fetch no
      // mount de componentes client deste codebase (`useEffect(() => { void
      // load(); }, [load])`, onde `load` é async e só chama setState após
      // `await`). Reativar quando a busca de dados migrar para RSC/SWR.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
