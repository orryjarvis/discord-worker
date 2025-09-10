import { z } from 'zod';
import type { ZodTypeAny, ZodObject, ZodEffects, ZodOptional, ZodNullable, ZodDefault } from 'zod';
import { defaultRegistry } from './registry';

import { APIApplicationCommand } from 'discord-api-types/v10';

type SlashConfig = {
  name: string;
  description: string;
  input?: ZodObject<any>;
  output?: ZodTypeAny;
};

type DiscordChoice = { name: string; value: string | number };
type DiscordOption = {
  type: 3 | 4 | 5 | 10; // String | Integer | Boolean | Number
  name: string;
  description: string;
  required?: boolean;
  choices?: DiscordChoice[];
};

type DiscordSlashDefinition = {
  name: string;
  description: string;
  type: 1; // CHAT_INPUT
  options?: DiscordOption[];
};

// Exported list for deploy scripts to consume
export const slashCommandDefinitions: DiscordSlashDefinition[] = [];

// Helper to unwrap wrappers to the inner base type
function unwrap(type: ZodTypeAny): ZodTypeAny {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (type instanceof z.ZodEffects) {
      type = (type as ZodEffects<any>)._def.schema;
      continue;
    }
    if (type instanceof z.ZodOptional) {
      type = (type as ZodOptional<any>)._def.innerType;
      continue;
    }
    if (type instanceof z.ZodNullable) {
      type = (type as ZodNullable<any>)._def.innerType;
      continue;
    }
    if (type instanceof z.ZodDefault) {
      type = (type as ZodDefault<any>)._def.innerType;
      continue;
    }
    break;
  }
  return type;
}

function isIntegerNumber(znum: z.ZodNumber): boolean {
  const def: any = (znum as any)._def;
  const checks: Array<{ kind: string }> = def?.checks ?? [];
  return checks.some((c) => c.kind === 'int');
}

function buildChoices(inner: ZodTypeAny): DiscordChoice[] | undefined {
  if (inner instanceof z.ZodEnum) {
    return inner.options.map((v: string) => ({ name: String(v), value: v }));
  }
  if (inner instanceof z.ZodNativeEnum) {
    const values = Object.values(inner.enum).filter((v) => typeof v === 'string' || typeof v === 'number') as Array<string | number>;
    const unique = Array.from(new Set(values));
    return unique.map((v) => ({ name: String(v), value: v }));
  }
  if (inner instanceof z.ZodUnion) {
    const opts = (inner as z.ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>)._def.options;
    const literals = opts.filter((o) => o instanceof z.ZodLiteral) as z.ZodLiteral<any>[];
    if (literals.length === opts.length) {
      return literals.map((lit) => ({ name: String(lit.value), value: lit.value }));
    }
  }
  return undefined;
}

function toDiscordType(inner: ZodTypeAny): DiscordOption['type'] | undefined {
  if (inner instanceof z.ZodString) return 3;
  if (inner instanceof z.ZodBoolean) return 5;
  if (inner instanceof z.ZodNumber) return isIntegerNumber(inner) ? 4 : 10;
  if (inner instanceof z.ZodEnum || inner instanceof z.ZodNativeEnum) {
    // Decide based on value type; default to string
    // Native enums may be number or string; we’ll map numbers to Integer
    const values = inner instanceof z.ZodEnum ? inner.options : Object.values((inner as z.ZodNativeEnum<any>).enum);
    const sample = values.find((v: any) => typeof v === 'number' || typeof v === 'string');
    if (typeof sample === 'number') return 4;
    return 3;
  }
  if (inner instanceof z.ZodUnion) {
    const opts = (inner as z.ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>)._def.options;
    const literals = opts.filter((o) => o instanceof z.ZodLiteral) as z.ZodLiteral<any>[];
    if (literals.length === opts.length) {
      const sample = literals.find((l) => typeof l.value === 'number' || typeof l.value === 'string');
      if (sample && typeof sample.value === 'number') return 4;
      return 3;
    }
  }
  return undefined;
}

function isOptional(schema: ZodTypeAny): boolean {
  // Optional if the top-level type is ZodOptional or ZodDefault (which implies a default value when omitted)
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return true;
  // Effects can wrap optional; unwrap and check again
  if (schema instanceof z.ZodEffects) return isOptional((schema as ZodEffects<any>)._def.schema as ZodTypeAny);
  return false;
}

function buildDiscordOptionsFromSchema(input: ZodObject<any>): DiscordOption[] {
  const options: DiscordOption[] = [];
  const shape = (input as z.ZodObject<any>).shape;

  for (const [name, schema] of Object.entries(shape)) {
    const inner = unwrap(schema as ZodTypeAny);
    const type = toDiscordType(inner);
    if (!type) continue; // skip unsupported types for now

    const desc = (inner as any)._def?.description ?? 'No description';
    const required = !isOptional(schema as ZodTypeAny);
    const rawChoices = buildChoices(inner);
    const choices: DiscordChoice[] | undefined = Array.isArray(rawChoices)
      ? (rawChoices as any[]).map((v) => (typeof v === 'object' && v && 'name' in v && 'value' in v ? v as DiscordChoice : { name: String(v), value: v as any }))
      : undefined;

    options.push({
      type,
      name: name,
      description: desc,
      required,
      ...(choices && choices.length ? { choices } : {}),
    });
  }

  return options;
}

export function Slash(cfg: SlashConfig) {
  return function (target: object) {
    const finalize = () => {
      // Register input schema in the parser's registry for validation/casting
      if (cfg.input) {
        defaultRegistry.register(cfg.name, cfg.input);
      }
      const options = cfg.input ? buildDiscordOptionsFromSchema(cfg.input) : undefined;
      // Push a deploy-ready command definition (dedupe by name)
      const def: DiscordSlashDefinition = {
        name: cfg.name,
        description: cfg.description,
        type: 1,
        ...(options && options.length ? { options } : {}),
      };
      for (let i = slashCommandDefinitions.length - 1; i >= 0; i--) {
        if (slashCommandDefinitions[i].name === def.name) slashCommandDefinitions.splice(i, 1);
      }
      slashCommandDefinitions.push(def);
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(finalize);
    else setTimeout(finalize, 0);
  };
}
