# High-Level System Architecture

```mermaid
graph TD
    subgraph Cloudflare
        Worker[Discord Worker]
        CFServices[Cloudflare Services]
    end
    User((Discord User))
    DiscordAPI[Discord API]
    Reddit[Reddit API]
    OpenDota[OpenDota API]
    GitHub[GitHub]

    User-->|Sends Command|DiscordAPI
    DiscordAPI-->|Event|Worker
    Worker-->|Uses|Commands
    Worker-->|Uses|Services
    Commands-->|May Query|APIProviders
    Services-->|May Query|APIProviders
    Worker-->|Uses|CFServices
    APIProviders((API/Data Providers))
    APIProviders-->|Reddit|Reddit
    APIProviders-->|OpenDota|OpenDota
    APIProviders-->|Other|GitHub
```

This diagram shows the Discord Worker bot hosted on Cloudflare, interacting with Discord users via the Discord API, and using various API/data providers for command functionality. Cloudflare Services (such as KV and Durable Objects) are used by the bot's commands for state and data management.
