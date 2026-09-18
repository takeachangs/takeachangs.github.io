// Storage behind the availability function.
//
// On Vercel: Upstash Redis via the REST client, credentials injected by the
// Marketplace integration (UPSTASH_REDIS_REST_* or the older KV_REST_API_* names).
// Anywhere else without those vars: an in-memory hash, so `node server/dev.js`
// and the tests run with no account at all. Only the four hash commands the
// function uses are exposed.

let impl;

function memory() {
  const hashes = new Map();
  const hash = (key) => hashes.get(key) || hashes.set(key, new Map()).get(key);
  return {
    async hset(key, fields) {
      for (const [f, v] of Object.entries(fields)) hash(key).set(f, v);
      return Object.keys(fields).length;
    },
    async hgetall(key) {
      const h = hashes.get(key);
      return h && h.size ? Object.fromEntries(h) : null;
    },
    async hexists(key, field) {
      return hashes.get(key)?.has(field) ? 1 : 0;
    },
    async hlen(key) {
      return hashes.get(key)?.size || 0;
    },
  };
}

export async function getStore() {
  if (impl) return impl;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    const { Redis } = await import('@upstash/redis');
    impl = new Redis({ url, token });
  } else if (process.env.VERCEL) {
    throw new Error('No Redis credentials: connect Upstash Redis to this project in the Vercel dashboard.');
  } else {
    impl = memory();
  }
  return impl;
}
