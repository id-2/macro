import { exec, execSync } from 'node:child_process';
import { unwatchFile, watchFile } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import tailwind from '@tailwindcss/vite';
import { Features } from 'lightningcss';
import type { Plugin, Rolldown, UserConfigFn } from 'vite';
import solid from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';
import wasm from 'vite-plugin-wasm';
import tsconfigpaths from 'vite-tsconfig-paths';
// @ts-ignore
import { browserslist, version } from './package.json';
import { devCompression } from './scripts/dev-compression';
import { devHttps } from './scripts/dev-https';
import { devExternalSourcemaps } from './scripts/dev-sourcemaps';
import { hostedDevProxy } from './scripts/hosted-dev-proxy';
import { keepImportMetaDev } from './scripts/keep-import-meta-dev';
import { localDevServer } from './scripts/local-dev-server';

function readShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

const shortSha = readShortSha();
const appVersion = `${version}+${shortSha}`;
/** Orders builds: a newer build takes the local cache over from older tabs. */
const appBuildTime = Date.now();

function readGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch {
    return '';
  }
}

function readGitBranchAsync(): Promise<string> {
  return new Promise((res) => {
    exec('git rev-parse --abbrev-ref HEAD', (err, stdout) => {
      res(err ? '' : stdout.trim());
    });
  });
}

function gitBranchHmrPlugin(): Plugin {
  return {
    name: 'git-branch-hmr',
    apply: 'serve',
    configureServer(server) {
      let gitDir: string;
      try {
        gitDir = execSync('git rev-parse --absolute-git-dir').toString().trim();
      } catch {
        return;
      }
      const headPath = resolve(gitDir, 'HEAD');
      const sendBranch = async () => {
        const branch = await readGitBranchAsync();
        server.ws.send({
          type: 'custom',
          event: 'git-branch:update',
          data: branch,
        });
      };
      const emit = () => {
        sendBranch().catch((error) =>
          server.config.logger.error(`git-branch-hmr: ${String(error)}`)
        );
      };
      watchFile(headPath, { interval: 100 }, emit);
      server.ws.on('connection', emit);
      server.httpServer?.once('close', () => unwatchFile(headPath));
    },
  };
}

/**
 * Orval's generated schemas are top-level `zod.object(...)` chains. The
 * bundler cannot prove those calls are side-effect free, so every schema (≈700
 * for the storage service alone) stayed in the entry chunk and was constructed
 * at startup, used or not. Annotating each one pure lets the bundler drop the
 * unused ones; the annotation is applied at build time so regenerated files keep it.
 */
function pureGeneratedZodSchemas(): Plugin {
  return {
    name: 'pure-generated-zod-schemas',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]generated[\\/]zod\.ts$/.test(id)) return;
      return {
        code: code.replace(
          /^(export const [\w$]+ = )(zod\b)/gm,
          '$1/* @__PURE__ */ $2'
        ),
        map: null,
      };
    },
  };
}

/**
 * Vite writes imported videos to `web-hosted/` instead of `assets/`. The web
 * deploy publishes that directory with the rest of `dist`, but every native
 * bundle deletes it (`build-tauri`, the OTA archive in `infra/stacks/web-app`,
 * the desktop derivation in `nix/tauri-desktop.nix`): the tutorial videos
 * alone added 105 MB to each app binary and OTA download. The apps load these
 * files from the web origin instead (`webHostedUrl`).
 */
const WEB_HOSTED_FILE = /\.(mp4|webm|mov)$/i;

// Hosted names keep their hash even in NO_MINIFY builds: a native bundle
// always loads the web deploy's copy, which is hashed.
function assetFileNames(bundledPattern: string) {
  return (asset: Rolldown.PreRenderedAsset) =>
    asset.names.some((name) => WEB_HOSTED_FILE.test(name))
      ? 'web-hosted/[name]-[hash][extname]'
      : `assets/${bundledPattern}`;
}

/**
 * CloudFront compresses responses of at most 10,000,000 bytes and serves
 * anything larger raw. The entry chunk once crossed that limit and every
 * visitor downloaded 11.9 MB uncompressed instead of ~3 MB, so fail the build
 * rather than ship that again. (Cache WASM is precompressed at deploy.)
 */
function cloudFrontCompressionLimit(): Plugin {
  const limitBytes = 10_000_000;
  return {
    name: 'cloudfront-compression-limit',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Local launch only. A production build still fails above the limit.
      if (process.env.SITE_BUILD_LOCAL === '1') return;
      const oversized = Object.values(bundle)
        .filter((file) => /\.(js|css|html|json|svg)$/.test(file.fileName))
        .map((file) => ({
          name: file.fileName,
          bytes:
            file.type === 'chunk'
              ? Buffer.byteLength(file.code)
              : typeof file.source === 'string'
                ? Buffer.byteLength(file.source)
                : file.source.byteLength,
        }))
        .filter((file) => file.bytes > limitBytes);
      if (oversized.length === 0) return;
      this.error(
        `These files exceed CloudFront's ${limitBytes}-byte compression limit and would be served uncompressed: ${oversized
          .map((file) => `${file.name} (${file.bytes} bytes)`)
          .join(', ')}. Split them behind lazy() boundaries.`
      );
    },
  };
}

/**
 * PostHog symbolicates every platform's stack frames by fetching the public
 * `.map` next to each chunk, and gives up on maps over 25,000,000 bytes. The
 * entry chunk's map once crossed that and every frame in it stayed minified,
 * so fail the build on a missing or oversized map.
 *
 * Rolldown emits each map as a `<chunk>.map` asset and none for a chunk that
 * renders no source code: a facade that only re-exports another chunk, or its
 * own runtime and Vite's preload polyfill (virtual `\0` modules). Those have
 * no frames to symbolicate, so only a chunk with source code needs a map.
 */
function posthogSourceMapLimit(): Plugin {
  const limitBytes = 25_000_000;
  const rendersSource = (chunk: Rolldown.OutputChunk) =>
    Object.entries(chunk.modules).some(
      ([id, module]) => !id.startsWith('\0') && module.renderedLength > 0
    );
  return {
    name: 'posthog-source-map-limit',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Local launch only. A production build still fails on a missing or oversized map.
      if (process.env.SITE_BUILD_LOCAL === '1') return;
      const problems = Object.values(bundle).flatMap((file) => {
        if (file.type === 'chunk') {
          const mapped =
            bundle[`${file.fileName}.map`] !== undefined ||
            !rendersSource(file);
          return mapped ? [] : [`${file.fileName} has no source map`];
        }
        if (!file.fileName.endsWith('.map')) return [];
        const bytes =
          typeof file.source === 'string'
            ? Buffer.byteLength(file.source)
            : file.source.byteLength;
        return bytes > limitBytes ? [`${file.fileName} is ${bytes} bytes`] : [];
      });
      if (problems.length === 0) return;
      this.error(
        `PostHog cannot symbolicate these chunks (source maps are required and must be at most ${limitBytes} bytes): ${problems.join(', ')}. Split the chunk behind lazy() boundaries or in startupChunks().`
      );
    },
  };
}

/**
 * A chain of chunks the entries load statically that leads back to its start,
 * or undefined. In such a cycle a module can read a binding of another before
 * it is initialized. Dynamic imports are left out: one cannot close a cycle
 * among chunks the entries load statically. Cycles among lazy chunks alone are
 * not checked.
 */
export function startupChunkCycle(
  chunks: readonly Pick<
    Rolldown.OutputChunk,
    'fileName' | 'imports' | 'isEntry'
  >[]
): string[] | undefined {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const finished = new Set<string>();
  for (const entry of chunks) {
    if (!entry.isEntry || finished.has(entry.fileName)) continue;
    const path: string[] = [entry.fileName];
    const next: number[] = [0];
    const onPath = new Map([[entry.fileName, 0]]);
    while (path.length > 0) {
      const name = path[path.length - 1];
      const imports = byName.get(name)?.imports ?? [];
      const index = next[next.length - 1];
      if (index >= imports.length) {
        finished.add(name);
        onPath.delete(name);
        path.pop();
        next.pop();
        continue;
      }
      next[next.length - 1] = index + 1;
      const imported = imports[index];
      const open = onPath.get(imported);
      if (open !== undefined) return [...path.slice(open), imported];
      if (finished.has(imported) || !byName.has(imported)) continue;
      onPath.set(imported, path.length);
      path.push(imported);
      next.push(0);
    }
  }
  return undefined;
}

/** Fails the build if startup chunks import each other in a cycle. */
function acyclicStartupChunks(): Plugin {
  return {
    name: 'acyclic-startup-chunks',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (file): file is Rolldown.OutputChunk => file.type === 'chunk'
      );
      const cycle = startupChunkCycle(chunks);
      if (!cycle) return;
      this.error(
        `Startup chunks import each other in a cycle, so a module could read a binding before it is initialized: ${cycle.join(' -> ')}. Check the groups in startupChunks().`
      );
    },
  };
}

const isNodeModule = (id: string) => id.includes('/node_modules/');
const isGeneratedSource = (id: string) =>
  !isNodeModule(id) && /\/generated\//.test(id);

/** The startup chunk a module moves to, and the group that captures it. */
type StartupPart = { name: string; rank: number };

/**
 * Module code per startup chunk, before minification. Smaller chunks start the
 * app sooner: Chrome compiles each one as it arrives while later ones
 * download, and V8 re-parses a whole chunk on the main thread the first time
 * code in it builds a stack trace, which some libraries do as they load.
 * 800 KB parts beat 2 MB parts on a slow CPU, and both beat one chunk per kind.
 * A single module, or modules that import each other in a cycle, stay in one
 * chunk however large, such as the generated GraphQL client.
 */
export const STARTUP_PART_CODE_BYTES = 800_000;
/** Groups available to startup chunks; the plan fails the build if it needs more. */
const STARTUP_PART_GROUPS = 48;

/** A module being visited and the next of its imports to visit. */
type ImportFrame = { id: string; imports: readonly string[]; next: number };

/**
 * Positions of modules in an order where every module comes after the modules
 * it imports. Modules that import each other in a cycle share one position.
 * This is Tarjan's strongly connected components algorithm, which finishes a
 * component only after every component it reaches. It keeps its own stack so
 * a long import chain cannot overflow the call stack.
 */
export function dependencyFirstPositions(
  ids: Iterable<string>,
  importsOf: (id: string) => readonly string[]
): Map<string, number> {
  const visitIndex = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const open = new Set<string>();
  const openStack: string[] = [];
  const positions = new Map<string, number>();
  let visited = 0;

  for (const root of ids) {
    if (visitIndex.has(root)) continue;
    const frames: ImportFrame[] = [];
    const enter = (id: string) => {
      visitIndex.set(id, visited);
      lowLink.set(id, visited);
      visited += 1;
      openStack.push(id);
      open.add(id);
      frames.push({ id, imports: importsOf(id), next: 0 });
    };
    const lower = (id: string, value: number | undefined) => {
      if (value !== undefined && value < (lowLink.get(id) ?? value)) {
        lowLink.set(id, value);
      }
    };

    enter(root);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame.next < frame.imports.length) {
        const imported = frame.imports[frame.next];
        frame.next += 1;
        if (!visitIndex.has(imported)) enter(imported);
        else if (open.has(imported)) lower(frame.id, visitIndex.get(imported));
        continue;
      }

      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent) lower(parent.id, lowLink.get(frame.id));
      if (lowLink.get(frame.id) !== visitIndex.get(frame.id)) continue;

      const position = positions.size;
      let member = openStack.pop();
      while (member !== undefined) {
        open.delete(member);
        positions.set(member, position);
        if (member === frame.id) break;
        member = openStack.pop();
      }
    }
  }
  return positions;
}

/**
 * Cuts modules sorted by dependency-first position into parts of at least
 * STARTUP_PART_CODE_BYTES of code (the last part may be smaller), never
 * between modules that share a position because they import each other.
 */
export function cutIntoParts(
  ids: readonly string[],
  positionOf: (id: string) => number,
  bytesOf: (id: string) => number
): string[][] {
  const parts: string[][] = [[]];
  let partBytes = 0;
  for (const [index, id] of ids.entries()) {
    const startsComponent =
      index === 0 || positionOf(ids[index - 1]) !== positionOf(id);
    if (partBytes >= STARTUP_PART_CODE_BYTES && startsComponent) {
      parts.push([]);
      partBytes = 0;
    }
    parts[parts.length - 1].push(id);
    partBytes += bytesOf(id);
  }
  return parts;
}

/**
 * Splits the code the HTML entries load at startup into chunks of about
 * STARTUP_PART_CODE_BYTES of module code, so each source map stays well under
 * PostHog's limit (one map with every startup module was 44 MB, most of it
 * library code and the embedded text of generated API clients), startup stays
 * fast, and index.html preloads a known set of files.
 * Left alone, Rolldown splits startup code that lazy chunks also import into
 * hundreds of small chunks, and index.html preloads every one.
 *
 * Only modules an entry already imports statically move, so startup loads the
 * same code and lazy code stays lazy:
 * - libraries go to `vendor-<n>`;
 * - generated API modules go to `api-schemas-<n>`, but only if they import
 *   nothing but libraries and other generated modules;
 * - the rest of the app's code goes to `startup-<entries>-<n>` for the set of
 *   entries that loads it, except the modules an entry imports directly, which
 *   stay in its entry chunk.
 *
 * Chunks must never import each other in a cycle, or a module could read a
 * binding before it is initialized. Each kind's modules are cut into parts
 * along an order where a module follows everything it imports, and each part
 * gets its own group: parts earlier in that order, libraries, and code for more
 * entries (a module's static imports load with at least the same entries) get
 * a higher priority. A group also captures the not yet captured modules its
 * modules import, so a chunk only ever imports chunks captured before it.
 * (Rolldown's own `maxSize` splits a group without that order and its parts
 * import each other in cycles.)
 */
function startupChunks(
  entries: Record<string, string>
): Rolldown.CodeSplittingOptions {
  const entryIds = new Set(Object.values(entries));
  const entryCount = entryIds.size;
  const planChunks = (
    context: Rolldown.ChunkingContext
  ): Map<string, StartupPart> => {
    const imports = (id: string) =>
      context.getModuleInfo(id)?.importedIds ?? [];
    const loadedBy = new Map<string, string[]>();
    const direct = new Set<string>();
    for (const [entry, entryId] of Object.entries(entries)) {
      for (const id of imports(entryId)) direct.add(id);
      const seen = new Set<string>();
      const pending = [entryId];
      for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
        if (seen.has(id)) continue;
        seen.add(id);
        loadedBy.set(id, [...(loadedBy.get(id) ?? []), entry]);
        pending.push(...imports(id));
      }
    }

    const schemas = new Set([...loadedBy.keys()].filter(isGeneratedSource));
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of schemas) {
        const importsAppCode = imports(id).some(
          (imported) => !isNodeModule(imported) && !schemas.has(imported)
        );
        if (importsAppCode) {
          schemas.delete(id);
          changed = true;
        }
      }
    }

    // Each moving module's kind, ranked so a kind only imports earlier kinds.
    const kinds = new Map<string, { order: number; ids: string[] }>();
    const addToKind = (kind: string, order: number, id: string) => {
      const members = kinds.get(kind) ?? { order, ids: [] };
      members.ids.push(id);
      kinds.set(kind, members);
    };
    for (const [id, loaders] of loadedBy) {
      if (isNodeModule(id)) addToKind('vendor', 0, id);
      else if (schemas.has(id)) addToKind('api-schemas', 1, id);
      else if (!entryIds.has(id) && !direct.has(id)) {
        addToKind(
          `startup-${loaders.join('-')}`,
          2 + entryCount - loaders.length,
          id
        );
      }
    }

    // Cut each kind into parts along the import order, never inside a cycle.
    const positions = dependencyFirstPositions(loadedBy.keys(), (id) =>
      imports(id).filter((imported) => loadedBy.has(imported))
    );
    const positionOf = (id: string) => positions.get(id) ?? 0;
    const plan = new Map<string, StartupPart>();
    let rank = 0;
    const ordered = [...kinds].sort(([, a], [, b]) => a.order - b.order);
    for (const [kind, { ids }] of ordered) {
      ids.sort((a, b) => positionOf(a) - positionOf(b));
      const parts = cutIntoParts(
        ids,
        positionOf,
        (id) => context.getModuleInfo(id)?.code?.length ?? 0
      );
      for (const [index, part] of parts.entries()) {
        const name = parts.length === 1 ? kind : `${kind}-${index + 1}`;
        for (const id of part) plan.set(id, { name, rank });
        rank += 1;
      }
    }
    if (rank > STARTUP_PART_GROUPS) {
      throw new Error(
        `startupChunks() planned ${rank} startup chunks but has ${STARTUP_PART_GROUPS} groups; raise STARTUP_PART_GROUPS or STARTUP_PART_CODE_BYTES.`
      );
    }
    return plan;
  };
  // Rolldown reuses one context for every call of a chunking pass.
  const plans = new WeakMap<
    Rolldown.ChunkingContext,
    Map<string, StartupPart>
  >();
  const planFor = (context: Rolldown.ChunkingContext) => {
    let plan = plans.get(context);
    if (!plan) {
      plan = planChunks(context);
      plans.set(context, plan);
    }
    return plan;
  };
  return {
    groups: Array.from(
      { length: STARTUP_PART_GROUPS },
      (_, rank): Rolldown.CodeSplittingGroup => ({
        debugName: `startup chunk ${rank + 1}`,
        name: (id, context) => {
          const part = planFor(context).get(id);
          return part?.rank === rank ? part.name : null;
        },
        tags: ['$initial'],
        priority: STARTUP_PART_GROUPS - rank,
        // Rolldown's default, spelled out: the group also takes the modules its
        // modules import that no group claimed, such as Vite's preload helper.
        // acyclicStartupChunks() checks on every build that startup chunks
        // still import each other in one direction.
        includeDependenciesRecursively: true,
      })
    ),
  };
}

/**
 * Vite 8 builds with Rolldown and reads `build.rolldownOptions`, including the
 * `codeSplitting` groups startupChunks() returns. An older Vite builds with
 * Rollup: it knows neither option, so the entry chunk keeps every module the
 * entries import statically — 11,471,512 bytes of generated API clients and
 * the Zod runtime, above CloudFront's 10,000,000-byte compression limit and
 * under one 55 MB source map, above PostHog's 25 MB one.
 */
const usesRolldown = (() => {
  try {
    createRequire(import.meta.url).resolve('rolldown');
    return true;
  } catch {
    return false;
  }
})();

/** Generated API code of a service client, such as `service-storage/generated/zod.ts`. */
const SERVICE_CLIENT_GENERATED =
  /[\\/]service-clients[\\/][^\\/]+[\\/].*[\\/]generated[\\/]/;

/**
 * Code bytes per module. Rollup calls `output.manualChunks` before it renders
 * module code, so the size-ordered plan in rollupStartupChunks() reads sizes
 * recorded while the module graph was parsed.
 */
const moduleCodeBytes = new Map<string, number>();

/** Fills moduleCodeBytes for the Rollup chunking plan. */
function recordModuleCodeBytes(): Plugin {
  return {
    name: 'record-module-code-bytes',
    moduleParsed(info) {
      moduleCodeBytes.set(info.id, info.code?.length ?? 0);
    },
  };
}

/** A module of Rollup's module graph, as `output.manualChunks` sees it. */
type RollupModuleInfo = {
  isEntry?: boolean;
  importedIds?: readonly string[];
} | null;

/** The second argument Rollup passes to `output.manualChunks`. */
type RollupChunkingContext = {
  getModuleIds: () => Iterable<string>;
  getModuleInfo: (id: string) => RollupModuleInfo;
};

/**
 * Rollup's equivalent of startupChunks(): Rollup reads `output.manualChunks`
 * instead of `codeSplitting` groups, so the same plan is cut into chunk names
 * here. Only modules an entry imports statically are grouped, in the same
 * kinds and dependency-first order: libraries, then generated API modules,
 * then the app's code. A chunk therefore imports only chunks captured before
 * it, and the build fails in acyclicStartupChunks() if that ever stops being
 * true. Lazy code keeps Rollup's own placement.
 */
function rollupStartupChunks() {
  let plan: Map<string, string> | undefined;
  const planChunks = (context: RollupChunkingContext) => {
    plan = new Map<string, string>();
    const imports = (id: string) => context.getModuleInfo(id)?.importedIds ?? [];
    const entryIds = new Set(
      [...context.getModuleIds()].filter(
        (id) => context.getModuleInfo(id)?.isEntry
      )
    );
    const loaded = new Set<string>();
    // An entry's own module and the modules it imports directly stay in its
    // entry chunk, as they do under Rolldown above; moving the entry module
    // itself would leave the chunk that index.html runs empty.
    const direct = new Set<string>();
    for (const entryId of entryIds) {
      for (const id of imports(entryId)) direct.add(id);
      const pending = [entryId];
      for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
        if (loaded.has(id)) continue;
        loaded.add(id);
        pending.push(...imports(id));
      }
    }

    // Each moving module's kind, ranked so a kind only imports earlier kinds.
    // A generated API module moves out only if its imports are libraries, so
    // it can never import the app code that stays in the entry chunk.
    const kinds = new Map<string, { order: number; ids: string[] }>();
    const addToKind = (kind: string, order: number, id: string) => {
      const members = kinds.get(kind) ?? { order, ids: [] };
      members.ids.push(id);
      kinds.set(kind, members);
    };
    for (const id of loaded) {
      if (entryIds.has(id) || direct.has(id)) continue;
      // Bundler-generated modules (Rollup's `\0commonjsHelpers`, Vite's
      // preload helper) are imported from every kind and import nothing, so
      // they belong below all of them; any other placement makes a kind
      // import the next one in a cycle.
      if (isNodeModule(id) || id.startsWith('\0')) addToKind('vendor', 0, id);
      else if (
        SERVICE_CLIENT_GENERATED.test(id) &&
        imports(id).every(isNodeModule)
      ) {
        addToKind(
          /[\\/]service-storage[\\/]graphql[\\/]generated[\\/]/.test(id)
            ? 'api-graphql'
            : 'api-schemas',
          1,
          id
        );
      } else addToKind('startup', 2, id);
    }

    // Cut each kind into parts along the import order, never inside a cycle.
    const positions = dependencyFirstPositions(loaded, (id) =>
      imports(id).filter((imported) => loaded.has(imported))
    );
    const positionOf = (id: string) => positions.get(id) ?? 0;
    const ordered = [...kinds].sort(([, a], [, b]) => a.order - b.order);
    for (const [kind, { ids }] of ordered) {
      ids.sort((a, b) => positionOf(a) - positionOf(b));
      const parts = cutIntoParts(
        ids,
        positionOf,
        (id) => moduleCodeBytes.get(id) ?? 0
      );
      for (const [index, part] of parts.entries()) {
        const name = parts.length === 1 ? kind : `${kind}-${index + 1}`;
        for (const id of part) plan.set(id, name);
      }
    }
    return plan;
  };
  return (id: string, context: RollupChunkingContext) =>
    (plan ?? planChunks(context)).get(id);
}

/**
 * loro-crdt's `browser` export downloads its 3 MB WASM with a synchronous
 * XMLHttpRequest and compiles it on the main thread, freezing startup for the
 * whole download. Builds use the `bundler` export that dev already resolves
 * through the `development` condition: vite-plugin-wasm streams and compiles it
 * off the main thread (htmlPreloads starts its download with the HTML).
 */
function loroAsyncWasm(): Plugin {
  return {
    name: 'loro-async-wasm',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer, options) {
      if (source !== 'loro-crdt') return null;
      return this.resolve('loro-crdt/bundler', importer, {
        ...options,
        skipSelf: true,
      });
    },
  };
}

const ESBUILD_BROWSERS: Record<string, string> = {
  safari: 'safari',
  ios_saf: 'ios',
  chrome: 'chrome',
  and_chr: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
};

/** Converts the `browser >= version` floors in package.json `browserslist` to esbuild targets. */
function esbuildTargets(queries: readonly string[]): string[] {
  return queries.map((query) => {
    const match = /^(\w+) >= (\d+(?:\.\d+)?)$/.exec(query);
    const browser = match ? ESBUILD_BROWSERS[match[1]] : undefined;
    if (!match || !browser) {
      throw new Error(`Unsupported browserslist query for esbuild: ${query}`);
    }
    return `${browser}${match[2]}`;
  });
}

/** Hashed assets the first screen needs; index.html requests them while it parses. */
const HTML_PRELOADS = [
  // The app waits for Loro to initialize before rendering.
  {
    file: /(^|\/)loro_wasm_bg-[\w-]+\.wasm$/,
    as: 'fetch',
    type: 'application/wasm',
  },
  // The UI font; otherwise it starts downloading only once text renders.
  {
    file: /(^|\/)inter-latin-wght-normal-[\w-]+\.woff2$/,
    as: 'font',
    type: 'font/woff2',
  },
] as const;

/**
 * Adds `<link rel="preload">` for HTML_PRELOADS, so their downloads start with
 * the HTML instead of after the entry runs.
 */
function htmlPreloads(): Plugin {
  let base = '/';
  return {
    name: 'html-preloads',
    apply: 'build',
    configResolved(config) {
      base = config.base.endsWith('/') ? config.base : `${config.base}/`;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        return HTML_PRELOADS.flatMap((preload) => {
          const file = files.find((fileName) => preload.file.test(fileName));
          if (!file) return [];
          return [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                href: `${base}${file}`,
                as: preload.as,
                type: preload.type,
                crossorigin: '',
              },
              injectTo: 'head' as const,
            },
          ];
        });
      },
    },
  };
}

/** The app's pages; each loads its own startup code (see startupChunks). */
const HTML_ENTRIES = {
  app: resolve(__dirname, 'index.html'),
  pipedreamConnect: resolve(__dirname, 'pipedream-connect.html'),
  canvasRender: resolve(__dirname, 'canvas-render.html'),
};

export const createAppViteConfig = (): UserConfigFn => {
  return ({ command, mode }) => {
    const ENV_MODE = process.env.MODE ?? mode;
    const NO_MINIFY = process.env.NO_MINIFY === 'true';

    return {
      base: command === 'serve' ? '/' : '/app',
      assetsInclude: ['**/*.glb'],
      css: {
        preprocessorMaxWorkers: true,
        transformer: 'lightningcss',
        lightningcss: {
          include: Features.VendorPrefixes,
        },
      },
      plugins: [
        devHttps(),
        devCompression(),
        devExternalSourcemaps(),
        hostedDevProxy(),
        // solidDevtools({ autoname: true }),
        pureGeneratedZodSchemas(),
        // Vite 8 chunks through startupChunks() and needs no size bookkeeping.
        ...(usesRolldown ? [] : [recordModuleCodeBytes()]),
        solid(),
        wasm(),
        loroAsyncWasm(),
        htmlPreloads(),
        tailwind(),
        solidSvg({
          defaultAsComponent: true,
          svgo: {
            enabled: true,
            svgoConfig: {
              plugins: [
                {
                  name: 'preset-default',
                  params: {
                    overrides: {
                      // CSS-sized SVGs need their original coordinate system;
                      // raster-backed marks otherwise show only a blank corner.
                      removeViewBox: false,
                    },
                  },
                },
              ],
            },
          },
        }),
        tsconfigpaths({
          root: './',
        }),
        gitBranchHmrPlugin(),
        cloudFrontCompressionLimit(),
        posthogSourceMapLimit(),
        acyclicStartupChunks(),
      ],
      define: defineEnv(ENV_MODE, command),
      clearScreen: false,
      worker: {
        format: 'es',
        plugins: () => [
          tsconfigpaths({
            root: './',
          }),
          posthogSourceMapLimit(),
        ],
        rolldownOptions: {
          output: {
            format: 'es',
            chunkFileNames: '[name]-[hash].js',
            entryFileNames: '[name]-[hash].js',
          },
        },
      },
      mode: ENV_MODE,
      build: {
        cssMinify: 'lightningcss',
        // target older safari to avoid lightningcss using text-decoration shorthand:
        // https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration#browser_compatibility
        cssTarget: ['esnext', 'safari15'],
        target: esbuildTargets(browserslist),
        outDir: 'dist',
        // Local builds keep the previous files: vite empties `dist` at start,
        // and the proxy serves it live, so emptying it takes the site down for
        // every build. Hosted builds still start clean.
        emptyOutDir: !process.env.SITE_BUILD_LOCAL,
        minify: !NO_MINIFY,
        // The gzip-size console report re-compresses every chunk, adding ~20 s
        // to each build; nothing reads it.
        reportCompressedSize: false,
        ...(usesRolldown
          ? {
              rolldownOptions: {
                input: HTML_ENTRIES,
                // KaTeX and PDF.js are now reachable through lazy boundaries.
                // Let Rolldown place them naturally; forcing lazy code into
                // named chunks hoists shared CommonJS helpers into those chunks
                // and makes the entry preload otherwise-lazy code.
                output: NO_MINIFY
                  ? {
                      // remove hashes from output paths
                      // https://github.com/vitejs/vite/issues/378
                      entryFileNames: `assets/[name].js`,
                      chunkFileNames: `assets/[name].js`,
                      assetFileNames: assetFileNames('[name].[ext]'),
                      codeSplitting: startupChunks(HTML_ENTRIES),
                    }
                  : {
                      format: 'es',
                      chunkFileNames: '[name]-[hash].js',
                      entryFileNames: '[name]-[hash].js',
                      assetFileNames: assetFileNames('[name]-[hash][extname]'),
                      codeSplitting: startupChunks(HTML_ENTRIES),
                    },
              },
            }
          : {
              rollupOptions: {
                input: HTML_ENTRIES,
                // Rollup has no `codeSplitting`: the same plan becomes chunk
                // names through `manualChunks`.
                output: NO_MINIFY
                  ? {
                      entryFileNames: `assets/[name].js`,
                      chunkFileNames: `assets/[name].js`,
                      assetFileNames: assetFileNames('[name].[ext]'),
                      manualChunks: rollupStartupChunks(),
                    }
                  : {
                      format: 'es',
                      chunkFileNames: '[name]-[hash].js',
                      entryFileNames: '[name]-[hash].js',
                      assetFileNames: assetFileNames('[name]-[hash][extname]'),
                      manualChunks: rollupStartupChunks(),
                    },
              },
            }),
        assetsInlineLimit: (filePath) => {
          if (filePath.includes('.wasm')) return false;
          if (filePath.includes('/lok/')) return false;
        },
        sourcemap: true,
      },
      oxc: {
        jsx: {
          runtime: 'automatic',
          importSource: 'solid-js',
        },
      },
      optimizeDeps: {
        include: [
          'vscode-textmate',
          'vscode-oniguruma',
          // 'solid-devtools/setup',
          'libheif-js/wasm-bundle',
          // Prebundle lazy spreadsheet worker dependencies before the first
          // use, which would otherwise reload the page and discard its draft.
          '@ironcalc/wasm',
          'exceljs',
          'fflate',
          'saxes',
        ],
        // loro-crdt is a wasm singleton. The app imports it directly (the dep
        // optimizer pre-bundles a copy) while the linked `@loro-mirror/core` workspace
        // source imports it through vite-plugin-wasm — two module evaluations,
        // two wasm memories. A LoroDoc from one instance handed to a Mirror on
        // the other yields cross-instance container handles → `index out of
        // bounds` panics in dev only. Excluding it from pre-bundling collapses
        // everyone onto the single plugin-handled instance.
        exclude: ['loro-crdt'],
        rolldownOptions: {
          transform: {
            target: 'esnext',
          },
        },
      },
      resolve: {
        alias: [
          // Nix injects its Tauri API alias here inside the sandboxed build.
          // NIX_TAURI_ALIAS
        ],
        dedupe: [
          // Keep Loro resolution here: tsconfig path aliases cache a versioned
          // URL that goes stale when Vite rebuilds dependencies, splitting the
          // app and workspace packages across separate WASM instances.
          'loro-crdt',
          'solid-js',
          '@codingame/monaco-vscode-api',
          '@codingame/monaco-vscode-*-common',
        ],
      },
      server: {
        port: Number(process.env.PORT || 3000),
        host: '0.0.0.0',
        strictPort: true,
        ...localDevServer(process.env),
        cors: true,
        watch: {
          ignored: /(^|[\\/])target([\\/]|$)/,
        },
        fs: {
          allow: [
            // Allow serving files from the workspace root
            resolve(__dirname, '../..'),
          ],
        },
      },
      preview: {
        port: Number(process.env.PORT || 3000),
        host: '0.0.0.0',
        strictPort: true,
        allowedHosts: true,
        cors: true,
        // The static preview has no gateway of its own. Continue and the other
        // local calls use these prefixes; send them to the local stack.
        proxy: localGatewayProxy(),
      },
    };
  };
};

/** Path prefixes the local gateway owns. A preview must not swallow these. */
const LOCAL_GATEWAY_PREFIXES = [
  'auth',
  'connection-gateway',
  'contacts',
  'dss',
  'email',
  'calendar',
  'notification',
  'unfurl',
  'image-proxy',
  'agent-harness',
  'agent-git',
  'preview',
  'scheduled-action',
  'cognition',
  'mcp',
  'websocket',
  'sync',
  'i',
  'lexical',
  'ai-editing',
  'local-storage',
  'static-file',
] as const;

function localGatewayProxy() {
  const target = 'https://localhost:24209';
  return Object.fromEntries(
    LOCAL_GATEWAY_PREFIXES.map((prefix) => [
      // Match the prefix itself and its children, not a longer name.
      `^/${prefix}(?:/|\\?|$)`,
      {
        target,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    ])
  );
}


function getAssetsPath(mode: string, command: string): string {
  // Every build is served by the proxy under /app; only `vite serve` keeps a
  // mode-specific folder. A bare '/' turned `%ASSETS_PATH%/rox-mark.png` into
  // the protocol-relative `//rox-mark.png`, read as a host named rox-mark.png.
  if (command === 'build') return '/app';
  switch (mode) {
    case 'development':
      return command === 'serve' ? '/local' : '/dev';
    case 'staging':
      return '/staging';
    default:
      // The built app is served under /app; a bare '/' here turned
      // `%ASSETS_PATH%/rox-mark.png` into the protocol-relative
      // `//rox-mark.png`, which the browser reads as a host named
      // rox-mark.png.
      return '/app';
  }
}

function defineEnv(mode: string, command: string) {
  // `vite build` compiles DEV from NODE_ENV, not MODE. Local-backend static
  // bundles already set VITE_LOCAL_BACKEND_ORIGIN (stack up);
  // keep DEV so those artifacts match `just run_local` (vite serve). Hosted
  // `just build-dev` does not set the origin, so DEV stays false.
  const keepDev = keepImportMetaDev({
    command,
    mode,
    localBackendOrigin: process.env.VITE_LOCAL_BACKEND_ORIGIN,
  });
  // A bundle built for one backend origin talks to that origin alone, so the
  // preconnect must not warm a gateway it never calls. `same-origin` resolves
  // at runtime, so there is no URL to preconnect to and the gateway stays.
  const localBackendOrigin = process.env.VITE_LOCAL_BACKEND_ORIGIN?.trim();
  const gatewayOrigin =
    localBackendOrigin && localBackendOrigin !== 'same-origin'
      ? localBackendOrigin
      : mode === 'development'
        ? 'https://dev-gateway.rox.one'
        : 'https://gateway.rox.one';
  return {
    'import.meta.env.__APP_VERSION__': JSON.stringify(appVersion),
    'import.meta.env.__APP_BUILD_TIME__': JSON.stringify(appBuildTime),
    'import.meta.env.ASSETS_PATH': JSON.stringify(getAssetsPath(mode, command)),
    // index.html preconnects to the API gateway; keep in sync with servers.ts.
    'import.meta.env.GATEWAY_ORIGIN': JSON.stringify(gatewayOrigin),
    'import.meta.env.__LOCAL_DOCKER__': process.env.LOCAL_DOCKER === 'true',
    'import.meta.env.__LOCAL_JWT__': JSON.stringify(process.env.LOCAL_JWT),
    'import.meta.env.__GIT_BRANCH__': JSON.stringify(
      command === 'serve' ? readGitBranch() : ''
    ),
    ...(keepDev
      ? {
          'import.meta.env.DEV': true,
          'import.meta.env.PROD': false,
        }
      : {}),
  };
}
