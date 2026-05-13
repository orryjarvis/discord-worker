import { runCliApp } from '../shared/createApp.js';

const output = await runCliApp({
  argv: process.argv.slice(2),
});

if (output) {
  console.log(output);
}
