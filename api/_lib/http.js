// Helpers de reponse. Tout ce qui sort d'une fonction est `no-store` : ni le
// navigateur ni un cache intermediaire ne doit conserver un creneau, une
// reservation ou une reponse d'authentification.

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.status(status).json(body)
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  return send(res, 405, { error: 'method_not_allowed' })
}

// Vercel parse deja le JSON quand le Content-Type le dit, mais pas toujours :
// on accepte les deux formes plutot que de dependre de son humeur.
export function readJsonBody(req) {
  const body = req.body
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return typeof body === 'object' ? body : {}
}

// L'adresse vue par Vercel. Sert uniquement de cle de limitation de debit :
// elle est falsifiable en theorie, jamais utilisee pour autoriser quoi que ce soit.
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || 'inconnu'
}

// Un entier de requete borne, pour ne pas laisser un parametre d'URL decider
// du nombre d'appels que la fonction va passer a Doinsport.
export function intParam(value, { min, max, fallback }) {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
