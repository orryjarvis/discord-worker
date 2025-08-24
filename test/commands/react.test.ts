import { describe, it, expect } from 'vitest';
import "../setup";
import { ReactCommand } from '../../src/commands/react';
import { createEnv, createMockReactService } from '../setup';

describe('React Command', () => {
  it('should react to a message', async () => {
    const interaction = {
      data: {
        type: 1, // ApplicationCommandType.ChatInput
        options: [{ name: 'emote', value: 'pog', type: 3 }], // type: ApplicationCommandOptionType.String
      }
    };
    const env = createEnv();
  const command = new ReactCommand(createMockReactService());
    const res = await command.handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toMatch(/pog/);
  });
});
