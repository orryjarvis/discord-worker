# High-Level System Architecture

```mermaid
graph TD
    subgraph Cloudflare
        Worker[Discord Worker]
    end
    User((Discord User))
    DiscordAPI[Discord API]
    Reddit[Reddit API]
    OpenDota[OpenDota API]
    GitHub[GitHub]
    CloudflareServices[Cloudflare Services]

    User-->|Sends Command|DiscordAPI
    DiscordAPI-->|Event|Worker
    Worker-->|Uses|Commands
    Worker-->|Uses|Services
    Worker-->|Deploys/Hosts|CloudflareServices
    Commands-->|May Query|APIProviders
    Services-->|May Query|APIProviders
    APIProviders((API/Data Providers))
    APIProviders-->|Reddit|Reddit
    APIProviders-->|OpenDota|OpenDota
    APIProviders-->|Other|GitHub
```

This diagram shows the Discord Worker bot hosted on Cloudflare, interacting with Discord users via the Discord API, and using various API/data providers for command functionality. Deployment and hosting are managed by Cloudflare services.
