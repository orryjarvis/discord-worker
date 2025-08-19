import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discordService } from '../../src/services/discordService';

let deployCommands: typeof import('../../scripts/deploy_commands').deployCommands;

describe('deploy_commands script', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.DISCORD_TOKEN = 'token';
    process.env.DISCORD_APPLICATION_ID = 'app-id';
    process.env.GUILD_ID = 'guild-id';
    // Dynamically import after env setup
    deployCommands = (await import('../../scripts/deploy_commands')).deployCommands;
  });

  it('calls discordService.upsertCommands and logs success', async () => {
    const mockResponse = { ok: true, text: async () => '' };
    vi.spyOn(discordService, 'upsertCommands').mockResolvedValue(mockResponse as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => void 0);
    await deployCommands();
    expect(discordService.upsertCommands).toHaveBeenCalledWith('app-id', 'token', expect.anything(), 'guild-id');
    expect(logSpy).toHaveBeenCalledWith('Registered all commands');
  });

  it('logs error if registration fails', async () => {
    const mockResponse = { ok: false, text: async () => 'fail' };
    vi.spyOn(discordService, 'upsertCommands').mockResolvedValue(mockResponse as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => void 0);
    await deployCommands();
    expect(errorSpy).toHaveBeenCalledWith('Error registering commands');
    expect(errorSpy).toHaveBeenCalledWith('fail');
  });
});
