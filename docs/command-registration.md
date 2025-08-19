# Command Registration & Service Reference

```mermaid
graph TD
    Registry[Command Registry]
    Command[Command]
    Service[Service]
    APIProvider[API/Data Provider]

    Registry-->|Registers|Command
    Command-->|Uses|Service
    Service-->|Provides|APIProvider
```

This generalized diagram shows how commands are registered in the registry and reference services, which in turn may interact with external API/data providers. This supports modularity and extensibility without coupling documentation to specific implementations.
