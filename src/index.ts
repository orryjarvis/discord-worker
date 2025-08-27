import 'reflect-metadata';
import { container } from 'tsyringe';
import { Env } from './types.js';
import { DiscordApplicationRouter } from './app.js';


const fetch = async (request: Request, env: Env) => {
    try {
        const childContainer = container.createChildContainer()
            .register<Env>('Env', { useValue: env})
        const application = childContainer.resolve(DiscordApplicationRouter);
        return await application.fetch(request);
    } catch (error) {
        console.error('Error occurred while processing request:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export default { fetch }
