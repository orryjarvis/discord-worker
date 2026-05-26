import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

const PASTIFY_COMMAND = {
  name: 'pastify',
  description: 'Turn an idea into a Twitch-style copypasta',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const INSULT_COMMAND = {
  name: 'insult',
  description: 'Light-heartedly roast the selected user',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'target',
      description: 'Who should get roasted?',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const INSULT_USER_COMMAND = {
  name: 'insult',
  type: ApplicationCommandType.User,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const EIGHT_BALL_MESSAGE_COMMAND = {
  name: '8ball',
  type: ApplicationCommandType.Message,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const WOTD_COMMAND = {
  name: 'wotd',
  description: 'Queue a manual word-of-day post to the configured channel',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

async function deployCommands() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!applicationId || !botToken) {
    console.error('DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, and DISCORD_TOKEN are required');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify([PASTIFY_COMMAND, INSULT_COMMAND, INSULT_USER_COMMAND, EIGHT_BALL_MESSAGE_COMMAND, WOTD_COMMAND]),
  });

  if (response.ok) {
    console.log('Registered commands: pastify, insult (slash), insult (user), 8ball (message), wotd');
  } else {
    console.error('Error registering commands');
    console.error(await response.text());
  }
}

void deployCommands().catch((error: unknown) => {
  console.error('Failed to deploy commands', error);
  process.exitCode = 1;
});
