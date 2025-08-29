/*
  Generic OpenAPI mock fetch for tests.
  - Given an OpenAPI 3.0 document and baseUrl, returns a `fetch` implementation
    that matches requests to operations and returns sampled response payloads.
  - Uses openapi-sampler for schema-driven data.
  - Provides simple heuristics to expand array results for more interesting data.
*/

import type { components as Components, paths as Paths } from '../generated/opendota';

type OpenAPIDoc = {
  openapi: string;
  info: unknown;
  servers?: Array<{ url: string }>;
  paths: Record<string, any>;
  components?: any;
};

type MockOptions = {
  baseUrl: string;
  // number of array items to generate when response schema is an array
  arrayItems?: number;
  // allow overrides for specific method+path routes
  overrides?: Record<string, (req: Request, ctx: { params: Record<string, string> }) => Promise<Response> | Response>;
};

function templateToRegex(template: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  const pattern = template
    .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') // escape regex
    .replace(/\\\{([^}]+)\\\}/g, (_m, name) => {
      names.push(name);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${pattern}$`), names };
}

async function sampleFromSchema(schema: any, doc: OpenAPIDoc): Promise<any> {
  const mod = await import('openapi-sampler');
  const sampleFn = (mod as any).sample ?? (mod as any).default?.sample;
  if (!sampleFn) throw new Error('openapi-sampler.sample not found');
  // deterministic sampling
  return sampleFn(schema, { skipReadOnly: false, skipNonRequired: false }, doc);
}

function deepMutateForIndex<T>(value: T, idx: number): T {
  if (Array.isArray(value)) return value.map((v) => deepMutateForIndex(v, idx)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (typeof v === 'number') out[k] = v + idx;
      else if (typeof v === 'string') out[k] = v + ` #${idx + 1}`;
      else out[k] = deepMutateForIndex(v as any, idx);
    }
    return out as unknown as T;
  }
  if (typeof value === 'number') return (value + idx) as unknown as T;
  if (typeof value === 'string') return (value + ` #${idx + 1}`) as unknown as T;
  return value;
}

export function createOpenApiMockFetch(doc: OpenAPIDoc, options: MockOptions): typeof fetch {
  const base = options.baseUrl.replace(/\/$/, '');
  const arrayItems = options.arrayItems ?? 5;
  const overrides = options.overrides ?? {};

  type Route = { method: string; template: string; regex: RegExp; names: string[]; op: any };
  const routes: Route[] = [];
  for (const [template, item] of Object.entries(doc.paths || {})) {
    const { regex, names } = templateToRegex(template);
    for (const method of Object.keys(item)) {
      const op = (item as any)[method];
      if (!op || typeof op !== 'object') continue;
      const m = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(m)) continue;
      routes.push({ method: m, template, regex, names, op });
    }
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input as any, init);
    const url = new URL(req.url);
    if (!url.href.startsWith(base)) {
      // pass through
      return fetch(req);
    }
    const path = url.pathname.replace(new RegExp(`^${base.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`), '') || url.pathname;
    const method = (req.method || 'GET').toUpperCase();

    const route = routes.find((r) => r.method === method && r.regex.test(path));
    if (!route) return new Response('Not Found', { status: 404 });
    const match = route.regex.exec(path)!;
    const params: Record<string, string> = {};
    route.names.forEach((n, i) => (params[n] = match[i + 1]));

    const overrideKey = `${method} ${route.template}`;
    const override = overrides[overrideKey];
    if (override) return await override(req, { params });

    // pick 200 or first 2xx response
    const responses = route.op.responses || {};
    const statusKey = responses['200'] ? '200' : Object.keys(responses).find((k) => /^2\d\d$/.test(k));
    if (!statusKey) return new Response('No success response defined', { status: 500 });
    const res = responses[statusKey];
    const content = res.content || {};
    const contentType = Object.keys(content).find((k) => k.startsWith('application/json'));
    if (!contentType) return new Response(null, { status: Number(statusKey) });
    const media = content[contentType];
    const schema = media.schema;
    let body = await sampleFromSchema(schema, doc);
    // Expand arrays to multiple items for more interesting mocks
    if (schema && (schema.type === 'array' || schema.items)) {
      const items = [] as any[];
      for (let i = 0; i < arrayItems; i++) {
        items.push(deepMutateForIndex(body[0] ?? body, i));
      }
      body = items;
    }
    return new Response(JSON.stringify(body), { status: Number(statusKey), headers: { 'content-type': 'application/json' } });
  };
}

// Convenience type exports for consumers wanting strong typing alongside the mock
export type OpenDotaPaths = Paths;
export type OpenDotaComponents = Components;
