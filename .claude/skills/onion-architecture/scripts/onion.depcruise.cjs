/**
 * Onion Architecture import rules for `server/src` (dependency-cruiser 17).
 *
 * Run from `server/`:
 *   npx depcruise src --config ../.claude/skills/onion-architecture/scripts/onion.depcruise.cjs \
 *     --ignore-known ../.claude/skills/onion-architecture/scripts/known-violations.json \
 *     --output-type err-long
 *
 * Legacy violations live in `known-violations.json` (regenerate with `--baseline <file>`, see
 * ../rules/enforcement.md). The baseline only shrinks: never regenerate it to hide a new violation.
 *
 * Paths are matched against resolved paths relative to `server/` with forward slashes; pnpm
 * resolves packages to `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...`.
 */

/**
 * A package (or one of several) under node_modules. Unanchored, so it also matches pnpm's
 * `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/` (dependency-cruiser rejects regexes
 * with nested quantifiers as unsafe, so no optional `.pnpm` group).
 */
const pkg = (names) => `node_modules/(?:${names})/`;

/**
 * Framework and infrastructure packages (I/O, network, native tooling) that must stay in the
 * outer rings. Pure in-memory libraries (zod, graphology, p-queue) are not listed: they do no I/O.
 */
const HTTP_PKGS = pkg('fastify[^/]*|@fastify/[^/]+|light-my-request');
const DB_PKGS = pkg('drizzle-orm|postgres');
const SDK_PKGS = pkg(
  'octokit|@octokit/[^/]+|simple-git|openai|@anthropic-ai/[^/]+|@ast-grep/[^/]+|' +
    'dependency-cruiser|js-tiktoken|@vscode/ripgrep|dotenv',
);

/** Domain ring: files named by the skill's convention (`domain.ts`, `domain/**`, `ports.ts`). */
const DOMAIN = '^src/modules/[^/]+/(?:domain(?:\\.ts$|/)|ports\\.ts$)';
/** Every module file that is not an outer-ring adapter (routes, repositories, mappers). */
const MODULE_INNER = '^src/modules/[^/]+/';
const MODULE_OUTER = '(?:^src/modules/[^/]+/(?:routes|repository|mappers?)\\.ts$|/repository/)';

module.exports = {
  forbidden: [
    {
      name: 'shared-kernel-is-pure',
      comment:
        '@devdigest/shared (src/vendor/shared) is the innermost ring: contracts and ports only. ' +
        'It may import zod and itself — never server code or infrastructure packages. ' +
        'See rules/domain-core.md.',
      severity: 'error',
      from: { path: '^src/vendor/shared/' },
      to: {
        path: ['^src/(?!vendor/shared/)', HTTP_PKGS, DB_PKGS, SDK_PKGS],
      },
    },
    {
      name: 'domain-is-pure',
      comment:
        'Domain files (domain.ts, domain/**, ports.ts) hold pure rules and port interfaces. ' +
        'Allowed: @devdigest/shared, @devdigest/reviewer-core, zod, platform/errors.ts, sibling domain files. ' +
        'Move I/O behind a port and implement it in an adapter. See rules/domain-core.md.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        path: ['^src/(?:db|adapters|platform)/', '^src/modules/[^/]+/(?:routes|service|repository)', HTTP_PKGS, DB_PKGS, SDK_PKGS],
        pathNot: '^src/platform/errors\\.ts$',
      },
    },
    {
      name: 'inner-rings-no-framework-or-db',
      comment:
        'Application code (services, executors, helpers) must not import Fastify, Drizzle, the DB ' +
        'schema or SDKs. Take data from routes as plain values and persistence through a repository ' +
        'port. See rules/application-services.md.',
      severity: 'error',
      from: { path: MODULE_INNER, pathNot: [MODULE_OUTER, '^src/modules/_shared/context\\.ts$'] },
      to: { path: ['^src/db/', HTTP_PKGS, DB_PKGS, SDK_PKGS] },
    },
    {
      name: 'inner-rings-no-container',
      comment:
        'Services receive narrow ports through their constructor; only routes (the module wiring ' +
        'point) and the composition root touch the Container. See rules/composition-root.md.',
      severity: 'error',
      from: { path: MODULE_INNER, pathNot: [MODULE_OUTER, '^src/modules/_shared/context\\.ts$'] },
      to: { path: '^src/platform/container\\.ts$' },
    },
    {
      name: 'routes-no-persistence',
      comment:
        'Routes are a driving adapter: parse with Zod, resolve the context, call a service, shape ' +
        'the reply. No Drizzle, no db/schema, no mappers. A route may import its own repository ' +
        'class only to construct it for the service. See rules/http-fastify.md.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: ['^src/db/', DB_PKGS, '^src/modules/[^/]+/mappers?\\.ts$'] },
    },
    {
      name: 'adapters-only-via-composition-root',
      comment:
        'Concrete adapters (src/adapters/**) are constructed only in platform/container.ts. Modules ' +
        'depend on the port interface. See rules/ports-and-adapters.md.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/(?:adapters/|platform/container\\.ts$|app\\.ts$|server\\.ts$)' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'no-cross-module-internals',
      comment:
        'A module never imports another module\'s files. Share through @devdigest/shared, ' +
        'modules/_shared, a facade type (repo-intel/types.ts) or a repository exposed by the ' +
        'container. See rules/layers-and-dependency-rule.md.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: '^src/modules/(?:$1|_shared)/|^src/modules/repo-intel/types\\.ts$',
      },
    },
    {
      name: 'adapters-not-into-core',
      comment:
        'Adapters implement ports and point inward: they may import @devdigest/shared and ' +
        'platform utilities, never module services, routes or repositories.',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '^\\.\\./reviewer-core/'] },
    // Count `import type` too: a type-only import of an outer ring is still coupling.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.d.ts', '.json'],
    },
  },
};
