// Local stand-in for Vercel: serves the function on http://localhost:3999/api/responses
// with the in-memory store. Run alongside `python3 server.py` and point
// `endpoint` in content/availability.json at it to try the page end to end.
import { createServer } from 'node:http';
import handler from './api/responses.js';

const port = Number(process.env.PORT) || 3999;
createServer((req, res) => {
  if (!req.url.startsWith('/api/responses')) {
    res.statusCode = 404;
    return res.end();
  }
  handler(req, res).catch((e) => {
    console.error(e);
    res.statusCode = 500;
    res.end();
  });
}).listen(port, () => console.log(`availability api on http://localhost:${port}/api/responses`));
