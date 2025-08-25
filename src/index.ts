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

export default { fetch }
