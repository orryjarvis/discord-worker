import 'reflect-metadata';
import { container } from 'tsyringe';
import { Env } from './env';
import { ApplicationRouter } from './app';


const fetch = async (request: Request, env: Env) => {
    try {
        const childContainer = container.createChildContainer()
            .register<Env>('Env', { useValue: env})
        const application = childContainer.resolve(ApplicationRouter);
        return await application.fetch(request);
    } catch (error) {
        console.error('Error occurred while processing request:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export default { fetch }
