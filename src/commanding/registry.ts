import { z } from 'zod';

// Generic registry for per-command input schemas, decoupled from any platform parser.
export class CommandSchemaRegistry {
  private schemas: Record<string, z.ZodTypeAny> = {};

  register<T extends z.ZodTypeAny>(command: string, schema: T) {
    this.schemas[command] = schema;
  }

  get(command: string) {
    return this.schemas[command];
  }
}

// Shared default registry so registrations apply across app & tests.
export const defaultRegistry = new CommandSchemaRegistry();
