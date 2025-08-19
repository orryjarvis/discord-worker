# Component Overview & Dependency Injection

```mermaid
graph TD
    Index[index.ts]
    Registry[Command Registry]
    Commands[Commands]
    Services[Services]
    APIProviders[API/Data Providers]

    Index-->|Initializes|Registry
    Index-->|Injects|Services
    Registry-->|Registers|Commands
    Commands-->|Use|Services
    Services-->|Query|APIProviders
```

This diagram highlights how the main entry point initializes the command registry and injects services, enabling modularity and extensibility through dependency injection.
