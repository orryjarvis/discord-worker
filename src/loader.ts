import { injectable, registry, Lifecycle } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';

@registry([
  {
    token: CommandLoader,
    useFactory: (c) => new CommandLoader(c),
    options: { lifecycle: Lifecycle.Transient },
  },
])
@injectable()
export class CommandLoader {
  constructor(private container: DependencyContainer) {}

  async loadCommand(commandId: string): Promise<void> {
    try {
      const mod = await import(`./commands/${commandId}.ts`);
      // Register any exported class with a handle() method as an ICommandHandler in this container
      for (const val of Object.values(mod)) {
        if (typeof val === 'function' && val.prototype && typeof val.prototype.handle === 'function') {
          // Register under the token used by CommandFactory
          this.container.register('ICommandHandler', { useClass: val as any });
        }
      }
    } catch (error) {
      console.error(`Failed to load command ${commandId}:`, error);
    }
  }
}
