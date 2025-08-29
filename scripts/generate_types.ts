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
    const tmpDir = path.resolve(REPO_ROOT, '.tmp');
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

async function main() {
    const cfg = await readJSON<Config>(CONFIG_PATH);
    const errors: string[] = [];
    for (const p of cfg.providers) {
        try {
            await processProvider(p);
        } catch (e) {
            const msg = `[${p.name}] ${String(e)}`;

            console.error('ERROR', msg);
            errors.push(msg);
        }
    }
    if (errors.length) {
        throw new Error(`Failed providers:\n${errors.join('\n')}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
