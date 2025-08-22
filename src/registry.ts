import { injectable, injectAll } from 'tsyringe';
import { ICommandHandler } from './types';

@injectable()
export class CommandRegistry {

  constructor(@injectAll('ICommandHandler') private commands: ICommandHandler[]) { }

  getCommand(commandId: string): ICommandHandler | undefined {
    return this.commands.find(command => command.commandId === commandId);
  }
}
