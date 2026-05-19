import { ApplicationCommandType, type RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';

const TEST_COMMAND = {
  name: 'test',
  description: 'Open a button and modal flow that stores text',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

async function deployCommands() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!applicationId || !botToken) {
    console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN (or DISCORD_TOKEN) are required');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ''}commands`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify([TEST_COMMAND]),
  });

  if (response.ok) {
    console.log('Registered command: test');
  } else {
    console.error('Error registering commands');
    console.error(await response.text());
  }
}

deployCommands();
