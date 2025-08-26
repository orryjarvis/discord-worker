import 'reflect-metadata';
import { container } from 'tsyringe';
import { Env } from './types.js';
import { DiscordApplicationRouter } from './app.js';
import { Configuration } from './config.js';


const fetch = async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
        const childContainer = container.createChildContainer()
            .register<Configuration>(Configuration, { useFactory: () => new Configuration(env)})
        const application = childContainer.resolve(DiscordApplicationRouter);
    return await application.fetch(request, ctx);
    } catch (error) {
        console.error('Error occurred while processing request:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// Queue consumer stub; will be implemented once FOLLOWUP_QUEUE is provisioned
const queue = async (batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) => {
    // Intentionally left as a stub to be filled when queue migration lands.
    // Keeping the export enables wrangler to attach the consumer once configured.
    for (const _msg of batch.messages) {
        // no-op
    }
}

export default { fetch, queue }
