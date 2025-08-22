import { injectable } from 'tsyringe';

@injectable()
export class CommandLoader {
  async loadCommand(commandId: string): Promise<void> {
    try {
      await import(`./commands/${commandId}.ts`);
    } catch (error) {
      console.error(`Failed to load command ${commandId}:`, error);
    }
  }
}
