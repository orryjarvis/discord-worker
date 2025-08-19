# Setup & Deployment Guide

## Prerequisites
- Node.js (v16+ recommended)
- Cloudflare account
- Discord application with bot credentials
- Wrangler CLI (`npm install -g wrangler`)

## Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd discord-worker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration
- Update `wrangler.toml` with your Cloudflare account and worker details.
- Set Discord bot credentials in environment variables or `src/env.ts`.

## Running Locally
You can use Wrangler to run the worker locally:
```bash
wrangler dev
```

## Deploying to Cloudflare Workers
```bash
wrangler publish
```

## Outdated Practices & Modernization Notes
- **Wrangler v2+**: The project may use older Wrangler config syntax. Update to the latest [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/) for new features and syntax.
- **Secrets & Environment Variables**: Use `wrangler secret put <NAME>` for secure secrets management.
- **Discord Interactions**: Consider using Discord's newer interaction endpoints and webhooks for improved reliability.
- **TypeScript Support**: Ensure `tsconfig.json` and build scripts are compatible with current TypeScript standards.
- **Testing**: Expand tests in the `test/` directory for better coverage.

## Troubleshooting
- Check Cloudflare dashboard for worker logs and errors.
- Use Discord developer portal for bot diagnostics.

## References
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Discord Developer Portal](https://discord.com/developers/docs/intro)
