import { inject, injectable } from 'tsyringe';
import type { ICommandHandler } from '../commanding';
import { CommandLoader, CommandFactory } from '../commanding';
import { JsonApiCommandParser, JsonApiPayload } from './parser';

@injectable()
export class JsonApiCommandHandler implements ICommandHandler<JsonApiPayload, Response> {
  constructor(
    @inject(JsonApiCommandParser) private parser: JsonApiCommandParser,
    @inject(CommandLoader) private loader: CommandLoader,
    @inject(CommandFactory) private factory: CommandFactory,
  ) {}

  async handle(payload: JsonApiPayload): Promise<Response> {
    const parsed = this.parser.parse(payload);
    const commandId = (parsed as any).commandId as string;
    await this.loader.loadCommand(commandId);
    const command = this.factory.getCommand(commandId);
    if (!command) {
      return new Response('Unknown Command', { status: 400 });
    }
    const output = await command.execute((parsed as any).input ?? (parsed as any));
    return this.parser.toResponse(output);
  }
}
