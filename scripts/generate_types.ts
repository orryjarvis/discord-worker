/*
  Generalized OpenAPI -> TypeScript types generator for multiple providers.
  - Reads providers from scripts/openapi.providers.json
  - Fetches spec, converts to OAS3 if needed
  - Filters to allowlisted paths
  - Emits types via openapi-typescript CLI
*/

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

type Provider = {
    name: string;
    specUrl?: string; // URL or ENV:VARNAME to read from env (optional when preprocess is used)
    allowlist: string[]; // array of path templates
    output: string; // relative to repo root
    preprocess?: {
        module: string; // module path relative to repo root (ts/js supported via tsx)
        export?: string; // named export to call (default: default)
        config?: Record<string, unknown>; // arbitrary config passed to preprocessor
    };
};

type Config = {
    providers: Provider[];
};

type OpenAPISchema = {
    openapi?: string;
    swagger?: string;
    info: unknown;
    servers?: Array<{ url: string }>;
    basePath?: string;
    schemes?: string[];
    host?: string;
    paths: Record<string, any>;
    components?: any;
    definitions?: any;
};

const REPO_ROOT = path.resolve(process.cwd());
const CONFIG_PATH = path.resolve(REPO_ROOT, 'scripts', 'openapi.providers.json');

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

async function readJSON<T>(p: string): Promise<T> {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as T;
}

async function fetchWithRetry(url: string, attempts = 3, timeoutMs = 15000): Promise<OpenAPISchema> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const text = await res.text();
            return JSON.parse(text) as OpenAPISchema;
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
    }
    throw new Error(String(lastErr));
}

async function loadSpec(provider: Provider): Promise<OpenAPISchema> {
    // If a preprocess hook is configured, use it to obtain or synthesize an OpenAPI schema.
    if (provider.preprocess) {
        const modPath = path.resolve(REPO_ROOT, provider.preprocess.module);
        const expName = provider.preprocess.export ?? 'default';
        const mod = await import(modPath);
        const fn: ((p: Provider) => Promise<OpenAPISchema> | OpenAPISchema) | undefined = mod[expName];
        if (typeof fn !== 'function') {
            throw new Error(`Preprocess export '${expName}' not found or not a function in ${provider.preprocess.module}`);
        }
        const out = await fn({ ...provider });
        return out;
    }
    if (!provider.specUrl) throw new Error('No specUrl provided');
    return await fetchWithRetry(provider.specUrl);
}

function subsetSchema(schema: OpenAPISchema, pathsAllow: string[]): OpenAPISchema {
    const subsetPaths: Record<string, any> = {};
    for (const p of pathsAllow) if (schema.paths[p]) subsetPaths[p] = schema.paths[p];
    return {
        openapi: schema.openapi ?? '3.0.0',
        info: schema.info,
        servers: schema.servers,
        paths: subsetPaths,
        components: schema.components,
    };
}

async function convertToOAS3IfNeeded(schema: OpenAPISchema): Promise<OpenAPISchema> {
    if (schema.openapi) return schema;
    if (!schema.swagger) return schema;
    const s2o = await import('swagger2openapi');
    const convertObj = (s2o as any).convertObj ?? (s2o as any).default?.convertObj;
    const { openapi } = await convertObj(schema as any, { patch: true, warnOnly: true });
    return openapi as OpenAPISchema;
}

async function runOpenapiTypescriptCLI(inputPath: string, outputPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const cli = path.resolve(REPO_ROOT, 'node_modules', '.bin', 'openapi-typescript');
        const child = spawn(cli, [inputPath, '--output', outputPath], {
            cwd: REPO_ROOT,
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`openapi-typescript exit ${code}`))));
        child.on('error', reject);
    });
}

async function processProvider(p: Provider): Promise<void> {
    const outputPath = path.resolve(REPO_ROOT, p.output);
    const outputDir = path.dirname(outputPath);
    const tmpDir = path.resolve(REPO_ROOT, 'src/generated/.tmp');
    await ensureDir(tmpDir);
    await ensureDir(outputDir);

    const allow = p.allowlist;
    let spec = await loadSpec(p);
    spec = await convertToOAS3IfNeeded(spec);
    const subset = subsetSchema(spec, allow);
    const tmpFile = path.resolve(tmpDir, `${p.name}.subset.json`);
    await fs.writeFile(tmpFile, JSON.stringify(subset, null, 2), 'utf-8');
    await runOpenapiTypescriptCLI(tmpFile, outputPath);
    console.log(`Generated ${path.relative(REPO_ROOT, outputPath)}`);
}

async function writeApiClientsFacade(providers: Provider[]): Promise<void> {
    const outFile = path.resolve(REPO_ROOT, 'src', 'generated', 'apiClients.generated.ts');
    const outDir = path.dirname(outFile);
    await ensureDir(outDir);

    const displayName = (id: string) => {
        // Friendly casing for known providers; fallback to simple PascalCase
        if (id === 'opendota') return 'OpenDota';
        return id
            .replace(/(^|[\W_]+)([a-zA-Z0-9])/g, (_m, _g1, c) => String(c).toUpperCase())
            .replace(/\W/g, '');
    };

    const toPascal = (s: string) =>
        s
            .replace(/(^|[\W_]+)([a-zA-Z0-9])/g, (_m, _g1, c) => String(c).toUpperCase())
            .replace(/\W/g, '');

    const importLines: string[] = [
        `// AUTO-GENERATED FILE. Do not edit manually.`,
        `// Generated by scripts/generate_types.ts`,
        `import { registry, type DependencyContainer, type InjectionToken } from 'tsyringe';`,
        `import createClient, { type Client } from 'openapi-fetch';`,
        `import { BaseUrlProviderToken } from '../services/baseUrlProvider';`,
    ];

    const tokenEntries: string[] = [];
    const regEntries: string[] = [];
    const apiIds: string[] = [];

    for (const p of providers) {
        const id = p.name; // runtime id as in providers config
        apiIds.push(`'${id}'`);
        const pascal = displayName(id);
        const typeAlias = `${pascal}Paths`;
        let relImport = path
            .relative(path.dirname(outFile), path.resolve(REPO_ROOT, p.output))
            .replace(/\\/g, '/')
            .replace(/\.ts$/, '');
        if (!relImport.startsWith('.')) relImport = './' + relImport;

        importLines.push(`import type { paths as ${typeAlias} } from '${relImport}';`);
        tokenEntries.push(`  ${id}: Symbol.for('ApiClient:${id}') as InjectionToken<Client<${typeAlias}>>,`);
        regEntries.push(
            `  {`,
            `    token: ApiClientTokens.${id},`,
            `    useFactory: (c: DependencyContainer) => {`,
            `      const p = c.resolve(BaseUrlProviderToken);`,
            `      const baseUrl = p.getBaseUrl('${id}');`,
            `      return createClient<${typeAlias}>({ baseUrl, fetch });`,
            `    },`,
            `  },`
        );
    }

    const content = [
        ...importLines,
        ``,
        `export type ApiId = ${apiIds.join(' | ')};`,
        ``,
        `export const ApiClientTokens = {`,
        ...tokenEntries,
        `} as const;`,
        ``,
        `@registry([`,
        ...regEntries,
        `])`,
        `export class ApiClientRegistry {}`,
        ``,
    ].join('\n');

    await fs.writeFile(outFile, content, 'utf-8');
    console.log(`Generated ${path.relative(REPO_ROOT, outFile)}`);
}

async function main() {
    const cfg = await readJSON<Config>(CONFIG_PATH);
    const errors: string[] = [];
    const processed: Provider[] = [];
    for (const p of cfg.providers) {
        try {
            await processProvider(p);
            processed.push(p);
        } catch (e) {
            const msg = `[${p.name}] ${String(e)}`;

            console.error('ERROR', msg);
            errors.push(msg);
        }
    }
    if (!errors.length) {
        await writeApiClientsFacade(processed);
        await writeGeneratedIndex(processed);
    } else {
        throw new Error(`Failed providers:\n${errors.join('\n')}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

async function writeGeneratedIndex(providers: Provider[]): Promise<void> {
    const outFile = path.resolve(REPO_ROOT, 'src', 'generated', 'index.ts');
    const outDir = path.dirname(outFile);
    await ensureDir(outDir);

    const displayName = (id: string) => {
        if (id === 'opendota') return 'OpenDota';
        return id
            .replace(/(^|[\W_]+)([a-zA-Z0-9])/g, (_m, _g1, c) => String(c).toUpperCase())
            .replace(/\W/g, '');
    };

    const lines: string[] = [
        `// AUTO-GENERATED FILE. Do not edit manually.`,
        `// Generated by scripts/generate_types.ts`,
        `import type { Client } from 'openapi-fetch';`,
        ``,
        `export { ApiClientTokens } from './apiClients.generated';`,
        `export type { ApiId } from './apiClients.generated';`,
        ``,
    ];

    // Define and re-export API path types using inline import type aliases
    for (const p of providers) {
        const disp = displayName(p.name);
        const rel = './' + path.basename(p.output, '.ts');
        lines.push(`export type ${disp}API = import('${rel}').paths;`);
    }
    lines.push('');
    for (const p of providers) {
        const disp = displayName(p.name);
        const rel = './' + path.basename(p.output, '.ts');
        lines.push(`export type ${disp}Client = Client<import('${rel}').paths>;`);
    }
    lines.push('');

    await fs.writeFile(outFile, lines.join('\n'), 'utf-8');
    console.log(`Generated ${path.relative(REPO_ROOT, outFile)}`);
}
