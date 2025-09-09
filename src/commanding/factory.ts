import { Lifecycle, registry } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';
import type { ICommand } from './interfaces';

@registry([{
    token: CommandFactory,
    useFactory: (c) => new CommandFactory(c),
    options: { lifecycle: Lifecycle.Transient }
}])
export class CommandFactory {

    constructor(private container: DependencyContainer) { }

    getCommand(commandId: string): ICommand | undefined{
        try {
            const commands = this.container.resolveAll<ICommand>('ICommandHandler');
            return commands.find(command => command.commandId === commandId);
        } catch (error) {
            console.error('Error fetching commands:', error);
            return;
        }
    }
}
