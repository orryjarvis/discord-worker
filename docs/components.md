# Component Overview & Dependency Injection

```mermaid
graph TD
    Index[index.ts]
    Registry[Command Registry]
    Commands[Commands]
    Services[Services]
    DiscordService[DiscordService]
    RedditService[RedditService]
    DotaService[DotaService]
    ReactService[ReactService]

    Index-->|Initializes|Registry
    Index-->|Injects|Services
    Registry-->|Registers|Commands
    Commands-->|Use|Services
    Services-->|API Calls|API/Data Providers
    Services-->|Dependency Injection|Injected
```

This diagram highlights how the main entry point initializes the command registry and injects services, enabling modularity and extensibility through dependency injection.
