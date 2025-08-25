import { Lifecycle, registry } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';
import { ICommandHandler } from './types';

@registry([{
    token: CommandFactory,
    useFactory: (c) => new CommandFactory(c),
    options: { lifecycle: Lifecycle.Transient }
}])
export class CommandFactory {

    constructor(private container: DependencyContainer) { }

    getCommand(commandId: string): ICommandHandler | undefined {
        try {
            const commands = this.container.resolveAll<ICommandHandler>('ICommandHandler');
            return commands.find(command => command.commandId === commandId);
        } catch (error) {
            console.error('Error fetching commands:', error);
            return;
        }
    }
}
