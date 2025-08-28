/*
  Script: generate_opendota_types.ts
  - Downloads OpenDota OpenAPI spec from https://api.opendota.com/api
  - Filters to a whitelist of paths
  - Runs openapi-typescript to generate TS types for that subset
*/

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_URL = 'https://api.opendota.com/api';
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = ROOT; // project root (where package.json lives)
const ALLOWLIST_PATH = path.resolve(__dirname, 'opendota.allowlist.json');
const OUTPUT_DIR = path.resolve(REPO_ROOT, 'src', 'generated');
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, 'opendota.ts');

type OpenAPISchema = {
  openapi?: string;
  swagger?: string; // some specs still use swagger 2.0
  info: any;
  servers?: Array<{ url: string }>; 
  basePath?: string; // swagger 2.0
  schemes?: string[]; // swagger 2.0
  host?: string; // swagger 2.0
  paths: Record<string, any>;
  components?: any;
  definitions?: any; // swagger 2.0
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchSpec(): Promise<OpenAPISchema> {
  // Optional overrides for CI/offline
  const localPath = process.env.OPENDOTA_SPEC_PATH;
  if (localPath) {
    const raw = await fs.readFile(path.resolve(localPath), 'utf-8');
    return JSON.parse(raw) as OpenAPISchema;
  }

  const primary = process.env.OPENDOTA_SPEC_URL || SPEC_URL;
  const candidates = [
    primary,
    // fallbacks that often host specs
    'https://api.opendota.com/api/openapi.json',
    'https://api.opendota.com/api/swagger.json',
    'https://api.opendota.com/api/docs.json'
  ];

  const attempts = Number(process.env.FETCH_RETRIES ?? 3);
  const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS ?? 15000);

  let lastErr: unknown;
  for (const url of candidates) {
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
        const text = await res.text();
        const json = JSON.parse(text) as OpenAPISchema;
        return json;
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw new Error(`Unable to download OpenDota spec from candidates. Set OPENDOTA_SPEC_PATH to a local file to bypass network. Last error: ${String(lastErr)}`);
}

async function readAllowlist(): Promise<string[]> {
  const raw = await fs.readFile(ALLOWLIST_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { paths: string[] };
  return parsed.paths;
}

function subsetSchema(schema: OpenAPISchema, pathsAllow: string[]): OpenAPISchema {
  const subsetPaths: Record<string, any> = {};
  for (const p of pathsAllow) {
    if (schema.paths[p]) subsetPaths[p] = schema.paths[p];
  }

  // Always return an OAS3 document (openapi field). If input already OAS3, keep it.
  const result: OpenAPISchema = {
    openapi: schema.openapi ?? '3.0.0',
    info: schema.info,
    servers: schema.servers,
    paths: subsetPaths,
    components: schema.components
  };

  return result;
}

async function writeTempSpec(spec: OpenAPISchema): Promise<string> {
  const tmpDir = path.resolve(REPO_ROOT, '.tmp');
  await ensureDir(tmpDir);
  const file = path.resolve(tmpDir, 'opendota.subset.json');
  await fs.writeFile(file, JSON.stringify(spec, null, 2), 'utf-8');
  return file;
}

async function runOpenapiTypescriptCLI(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cli = path.resolve(REPO_ROOT, 'node_modules', '.bin', 'openapi-typescript');
    const child = spawn(cli, [inputPath, '--output', outputPath], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`openapi-typescript exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const [schema, allow] = await Promise.all([fetchSpec(), readAllowlist()]);
  // If schema is Swagger 2.0, convert to OAS3 first
  let oas3: OpenAPISchema;
  if (schema.swagger && !schema.openapi) {
    const s2oMod = await import('swagger2openapi');
    const convertObj = (s2oMod as any).convertObj ?? (s2oMod as any).default?.convertObj;
    if (!convertObj) throw new Error('Failed to load swagger2openapi.convertObj');
    const { openapi } = await convertObj(schema as any, { patch: true, warnOnly: true });
    oas3 = openapi as OpenAPISchema;
  } else {
    oas3 = schema;
  }

  const subset = subsetSchema(oas3, allow);
  await ensureDir(OUTPUT_DIR);
  // Write temp and invoke CLI to generate directly to output
  const tmp = await writeTempSpec(subset);
  await runOpenapiTypescriptCLI(tmp, OUTPUT_FILE);
  console.log(`Generated types: ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
