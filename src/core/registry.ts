import { CommandDefinition } from './command';

export class CommandRegistry<TDependencies> {
  private readonly definitions = new Map<string, CommandDefinition<TDependencies, unknown, unknown, unknown>>();

  register<TInput, TOutput, TRawEvent>(definition: CommandDefinition<TDependencies, TInput, TOutput, TRawEvent>): this {
    this.definitions.set(definition.path.join(' '), definition as CommandDefinition<TDependencies, unknown, unknown, unknown>);
    return this;
  }

  get(path: readonly string[]): CommandDefinition<TDependencies, unknown, unknown, unknown> | undefined {
    return this.definitions.get(path.join(' '));
  }

  list(): readonly CommandDefinition<TDependencies, unknown, unknown, unknown>[] {
    return [...this.definitions.values()];
  }
}
