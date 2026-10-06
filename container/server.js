const http = require('node:http');

const port = Number(process.env.PORT ?? '8080');

const server = http.createServer((request, response) => {
  const body = JSON.stringify(
    {
      message: 'hello from the discord-worker container',
      method: request.method,
      url: request.url,
    },
    null,
    2,
  );

  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(`${body}\n`);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`container listening on ${port}`);
});
