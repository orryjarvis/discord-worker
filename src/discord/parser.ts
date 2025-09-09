import 'reflect-metadata';
import { z } from 'zod';
import { injectable } from 'tsyringe';
import {
  APIInteraction,
  InteractionType,
  ApplicationCommandType,
  InteractionResponseType,
} from 'discord-api-types/v10';
import type { ICommandInput, ICommandOutput, ICommandParser } from '../commanding/interfaces.js';
import { CommandSchemaRegistry, defaultRegistry } from '../commanding/registry.js';

// Minimal schema focusing on Chat Input interactions only (extend later as needed)
const optionSchema = z.object({
  name: z.string(),
  type: z.number(),
  // Discord sends value typed depending on option type; we accept unknown and
  // rely on per-command schema to refine.
  value: z.unknown().optional(),
});

const chatInputSchema = z.object({
  type: z.literal(InteractionType.ApplicationCommand),
  data: z.object({
    type: z.literal(ApplicationCommandType.ChatInput),
    name: z.string(),
    options: z.array(optionSchema).optional(),
  }),
});

export type NativeCommandRequest = APIInteraction;

// Map our InteractionResponse union to Discord wire format
export function toDiscordResponse(result: ICommandOutput) {
  const anyRes: any = result as any;
  let content: string;
  if (typeof anyRes?.content === 'string') content = anyRes.content;
  else if (typeof anyRes?.url === 'string') content = anyRes.url;
  else content = typeof anyRes === 'string' ? anyRes : JSON.stringify(anyRes);
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content },
  };
}

export class JsonResponse extends Response {
  constructor(body: Record<string, unknown>, init?: RequestInit | Request) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

@injectable()
export class DiscordCommandParser implements ICommandParser<APIInteraction, Response> {
  constructor(private registry: CommandSchemaRegistry = defaultRegistry) {}

  parse(interaction: APIInteraction): ICommandInput {
    const res = chatInputSchema.safeParse(interaction);
    if (!res.success) {
      throw new Error('Unsupported or malformed interaction');
    }
    const { data } = res.data;

    const input = Object.fromEntries(
      (data.options ?? []).map((o) => [o.name, o.value])
    );

    const schema = this.registry.get(data.name);
    if (schema) {
      const cast = schema.safeParse(input);
      if (!cast.success) {
        const issues = cast.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new Error(`Validation failed for /${data.name}: ${issues}`);
      }
      return { commandId: data.name, input: cast.data } as any;
    }

    return { commandId: data.name, input } as any;
  }

  toResponse(result: ICommandOutput): Response {
    return new JsonResponse(toDiscordResponse(result));
  }
}
