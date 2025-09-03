/*
  Reddit OpenAPI preprocessor
  - Generates a minimal, OpenAPI 3.0 schema for the few endpoints we use
  - Uses OAuth token endpoint and listing endpoint shapes based on Reddit docs
  - This intentionally avoids hardcoding a distant copy of a spec file and instead
    synthesizes just enough surface for typegen.

  Contract:
  export default async function preprocess(provider: ProviderLike): Promise<OpenAPISchema>
*/

// Lightweight local copies of the types used by the generator to avoid circular imports
export type OpenAPISchema = {
  openapi?: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  paths: Record<string, any>;
  components?: any;
};

type ProviderLike = {
  name: string;
  allowlist: string[];
  preprocess?: { config?: Record<string, unknown> };
};

function buildSchema(): OpenAPISchema {
  // Minimal subset for our usage: token and hot listing
  // If allowlist later expands, we can extend here.
  return {
    openapi: '3.0.0',
    info: {
      title: 'Reddit API (synthesized) — minimal',
      version: '1.0.0',
      description: 'Generated at build time to support uniform API typing.',
    },
    servers: [
      { url: 'https://www.reddit.com' },
      { url: 'https://oauth.reddit.com' },
    ],
    paths: {
      '/api/v1/access_token': {
        post: {
          summary: 'Obtain OAuth2 access token (client credentials)',
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  properties: {
                    grant_type: { type: 'string', enum: ['client_credentials'] },
                  },
                  required: ['grant_type'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Access token response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      access_token: { type: 'string' },
                      token_type: { type: 'string' },
                      expires_in: { type: 'integer' },
                      scope: { type: 'string' },
                    },
                    required: ['access_token', 'token_type', 'expires_in'],
                  },
                },
              },
            },
          },
        },
      },
      '/r/{subreddit}/hot.json': {
        get: {
          summary: 'Get hot posts from a subreddit',
          parameters: [
            {
              name: 'subreddit',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'after', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Listing response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          children: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                is_gallery: { type: 'boolean' },
                                data: {
                                  type: 'object',
                                  properties: {
                                    url: { type: 'string', nullable: true },
                                    media: {
                                      type: 'object',
                                      nullable: true,
                                      properties: {
                                        reddit_video: {
                                          type: 'object',
                                          nullable: true,
                                          properties: {
                                            fallback_url: { type: 'string', nullable: true },
                                          },
                                        },
                                      },
                                    },
                                    secure_media: {
                                      type: 'object',
                                      nullable: true,
                                      properties: {
                                        reddit_video: {
                                          type: 'object',
                                          nullable: true,
                                          properties: {
                                            fallback_url: { type: 'string', nullable: true },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

async function trySampleListing(sampleSubreddit: string): Promise<unknown | null> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${encodeURIComponent(sampleSubreddit)}/hot.json?limit=5`, {
      headers: { 'User-Agent': 'discord-worker:1.0.0 (typegen preprocessor)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json as unknown;
  } catch {
    return null;
  }
}

function mergeSampleIntoSchema(base: OpenAPISchema, sample: any): OpenAPISchema {
  // Simple JSON -> OpenAPI schema inference to mirror the sample's shape.
  function inferSchema(value: unknown): any {
    if (value === null) return { nullable: true };
    const t = typeof value;
    if (t === 'string') return { type: 'string' };
    if (t === 'number') return { type: Number.isInteger(value as number) ? 'integer' : 'number' };
    if (t === 'boolean') return { type: 'boolean' };
    if (Array.isArray(value)) {
      const first = value.length ? value[0] : undefined;
      return { type: 'array', items: first !== undefined ? inferSchema(first) : {} };
    }
    if (t === 'object') {
      const obj = value as Record<string, unknown>;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) properties[k] = inferSchema(v);
      return { type: 'object', properties };
    }
    return {};
  }

  const inferred = inferSchema(sample);
  const updated = { ...base };
  // Replace the 200 response schema for listing with the inferred one
  const path = updated.paths['/r/{subreddit}/hot.json'];
  if (path?.get?.responses?.['200']?.content?.['application/json']) {
    path.get.responses['200'].content['application/json'].schema = inferred;
  }
  return updated;
}

export default async function preprocess(provider: ProviderLike): Promise<OpenAPISchema> {
  const base = buildSchema();
  const cfg = (provider.preprocess?.config as any) ?? {};
  const sampleSubreddit = cfg.sampleSubreddit as string | undefined;
  const inferFromSample = Boolean(cfg.inferFromSample);
  if (!sampleSubreddit) return base;
  const sample = await trySampleListing(sampleSubreddit);
  if (!sample) return base;
  return inferFromSample ? mergeSampleIntoSchema(base, sample) : base;
}
