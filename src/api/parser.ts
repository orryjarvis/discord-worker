import 'reflect-metadata';
import { injectable } from 'tsyringe';
import type { ICommandInput, ICommandOutput, ICommandParser } from '../commanding';
import { CommandSchemaRegistry, defaultRegistry } from '../commanding/registry';
import { JsonResponse } from '../discord';

export type JsonApiPayload = {
  commandId: string;
  input?: Record<string, unknown>;
};

@injectable()
export class JsonApiCommandParser implements ICommandParser<JsonApiPayload, Response> {
  constructor(private registry: CommandSchemaRegistry = defaultRegistry) {}

  parse(payload: JsonApiPayload): ICommandInput {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid request body');
    }
    const { commandId, input } = payload as JsonApiPayload;
    if (!commandId || typeof commandId !== 'string') {
      throw new Error('Missing or invalid commandId');
    }

    const schema = this.registry.get(commandId);
    if (schema) {
      const cast = schema.safeParse(input ?? {});
      if (!cast.success) {
        const issues = cast.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new Error(`Validation failed for ${commandId}: ${issues}`);
      }
      return { commandId, input: cast.data } as any;
    }

    return { commandId, input: input ?? {} } as any;
  }

  toResponse(result: ICommandOutput): Response {
    // Return raw result JSON; do not wrap like Discord
    return new JsonResponse(result as unknown as Record<string, unknown>);
  }
}
