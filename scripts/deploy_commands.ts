type DeployCommandsEnv = {
    readonly DISCORD_APPLICATION_ID?: string;
    readonly DISCORD_GUILD_ID?: string;
    readonly DISCORD_TOKEN?: string;
};

const COMMANDS = [
    {
        name: 'reddit',
        description: 'Show the currently trending thread for a subreddit.',
        options: [
            {
                name: 'subreddit',
                description: 'The subreddit to inspect.',
                type: 3,
                required: true,
            },
        ],
    },
];

export async function deployCommands(env: DeployCommandsEnv = process.env as DeployCommandsEnv) {
    const applicationId = env.DISCORD_APPLICATION_ID;
    const token = env.DISCORD_TOKEN;
    const guildId = env.DISCORD_GUILD_ID;

    if (!applicationId || !token) {
        throw new Error('DISCORD_APPLICATION_ID and DISCORD_TOKEN are required to deploy commands.');
    }

    const endpoint = guildId
        ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
        : `https://discord.com/api/v10/applications/${applicationId}/commands`;

    const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(COMMANDS),
    });

    if (response.ok) {
        console.log('Registered all commands');
        return;
    }

    console.error('Error registering commands');
    console.error(await response.text());
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('deploy_commands.js')) {
    void deployCommands();
}
