import { Container } from '@cloudflare/containers';

export class BotContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '2m';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return new Response('worker ok\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    const container = env.BOT_CONTAINER.getByName('default');
    return container.fetch(request);
  },
};
