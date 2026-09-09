// Limitation de debit : ce qui empeche de deviner un code d'acces a la chaine.
//
// Deux etages, du meilleur au moins bon :
//   1. Upstash Redis si le projet en a un (Vercel > Storage) : le compteur est
//      partage par toutes les instances serverless, donc reellement global.
//   2. Sinon, un compteur en memoire, valable pour la seule instance qui
//      repond. Un attaquant qui tombe sur des instances differentes obtient
//      plus d'essais -- c'est une gene, pas un mur. D'ou l'interet du 1.
//
// Dans les deux cas la reponse a un code faux est deliberement lente
// (voir api/login.js) : c'est ce qui rend l'attaque a grande echelle penible.

const STORE_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const STORE_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const backend = STORE_URL && STORE_TOKEN ? 'redis' : 'memoire'

const local = new Map()

function localHit(key, limit, windowSeconds) {
  const now = Date.now()
  const window = windowSeconds * 1000
  const hits = (local.get(key) || []).filter((t) => now - t < window)
  hits.push(now)
  local.set(key, hits)

  // Menage opportuniste : sans lui la Map grossit tant que l'instance vit.
  if (local.size > 500) {
    for (const [k, v] of local) if (v.every((t) => now - t >= window)) local.delete(k)
  }

  const allowed = hits.length <= limit
  return { allowed, retryAfter: allowed ? 0 : Math.ceil((window - (now - hits[0])) / 1000) }
}

async function redisHit(key, limit, windowSeconds) {
  const call = async (command) => {
    const response = await fetch(STORE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${STORE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000)
    })
    if (!response.ok) throw new Error(`store_${response.status}`)
    return (await response.json()).result
  }

  const count = Number(await call(['INCR', key]))
  if (count === 1) await call(['EXPIRE', key, windowSeconds])
  if (count <= limit) return { allowed: true, retryAfter: 0 }
  const ttl = Number(await call(['TTL', key]))
  return { allowed: false, retryAfter: ttl > 0 ? ttl : windowSeconds }
}

export async function hit(key, { limit, windowSeconds }) {
  if (backend === 'redis') {
    try {
      return await redisHit(`rl:${key}`, limit, windowSeconds)
    } catch {
      // Redis injoignable ne doit pas ouvrir la porte en grand : on retombe
      // sur le compteur local plutot que d'autoriser sans compter.
      return localHit(key, limit, windowSeconds)
    }
  }
  return localHit(key, limit, windowSeconds)
}
