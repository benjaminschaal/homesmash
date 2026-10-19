// Upstash Redis, par son API REST : un simple fetch, aucun client a embarquer.
//
// Facultatif. Vercel > Storage > Upstash for Redis pose ces variables tout
// seul. Il sert a deux choses : un compteur de limitation de debit commun a
// toutes les instances, et le parametrage des creneaux choisi par un admin.

const STORE_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const STORE_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const redisDisponible = Boolean(STORE_URL && STORE_TOKEN)

export async function redis(command) {
  const response = await fetch(STORE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STORE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000)
  })
  if (!response.ok) throw new Error(`store_${response.status}`)
  return (await response.json()).result
}
