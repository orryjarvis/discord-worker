import { COMMANDS } from "../src/commands.js";
import { APPLICATION_ID, GUILD_ID, TOKEN, upsertCommands } from "./api.js";

const creationResponse = await upsertCommands(APPLICATION_ID, TOKEN, COMMANDS, GUILD_ID);

if (creationResponse.ok) {
    console.log('Registered all commands');
} else {
    console.error('Error registering commands');
    const text = await creationResponse.text();
    console.error(text);
}