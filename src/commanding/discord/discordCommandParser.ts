import 'reflect-metadata';
import { z } from 'zod';
import { injectable } from 'tsyringe';
import {
  APIInteraction,
  InteractionType,
  ApplicationCommandType,
  InteractionResponseType,
} from 'discord-api-types/v10';
import type { ICommandParser } from '../parser.js';
import type { Interaction, InteractionResponse } from '../contracts.js';

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

export type NativeCommandRequest = Interaction;

// Registry of per-command zod schemas to validate and cast input
export class CommandSchemaRegistry {
  private schemas: Record<string, z.ZodTypeAny> = {};

  register<T extends z.ZodTypeAny>(command: string, schema: T) {
    this.schemas[command] = schema;
  }

  get(command: string) {
    return this.schemas[command];
  }
}

// Shared default registry so registrations apply across app & tests
export const defaultRegistry = new CommandSchemaRegistry();

// Map our InteractionResponse union to Discord wire format
export function toDiscordResponse(result: InteractionResponse) {
  switch (result.kind) {
    case 'content':
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: result.text,
          flags: result.ephemeral ? 64 : undefined,
        },
      };
    case 'embed':
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: result.title,
              description: result.description,
              fields: result.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
            },
          ],
          flags: result.ephemeral ? 64 : undefined,
        },
      };
    case 'deferred':
      return {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: {
          flags: result.ephemeral ? 64 : undefined,
        },
      };
  }
}

@injectable()
export class DiscordCommandParser implements ICommandParser<APIInteraction, Response> {
  constructor(private registry: CommandSchemaRegistry = defaultRegistry) {}

  parse(interaction: APIInteraction): Interaction {
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
        // Throw here; router can convert this to an ephemeral validation message if desired
        const issues = cast.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        throw new Error(`Validation failed for /${data.name}: ${issues}`);
      }
      return { commandId: data.name, input: cast.data };
    }

    return { commandId: data.name, input };
  }

  toResponse(result: InteractionResponse): Response {
    return new Response(JSON.stringify(toDiscordResponse(result)), {
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    });
  }
}
