import { runCliApp } from '@/apps/shared/createApp';

const output = await runCliApp({
  argv: process.argv.slice(2),
});

if (output) {
  console.log(output);
}
