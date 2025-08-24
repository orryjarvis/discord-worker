import 'reflect-metadata';
import { container } from 'tsyringe';
import { Env } from './types.js';
import { DiscordApplicationRouter } from './app.js';

const application = container.resolve(DiscordApplicationRouter);

const fetch = async (request: Request, env: Env) => application.fetch(request, env)

export default { fetch }
