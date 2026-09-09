// Helpers de reponse. Tout ce qui sort d'une fonction est `no-store` : ni le
// navigateur ni un cache intermediaire ne doit conserver un creneau, une
// reservation ou une reponse d'authentification.

const MAX_CORPS = 64 * 1024

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.status(status).json(body)
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  return send(res, 405, { error: 'method_not_allowed' })
}

function analyse(texte) {
  try {
    const valeur = JSON.parse(texte)
    return valeur && typeof valeur === 'object' ? valeur : {}
  } catch {
    return {}
  }
}

// Le corps arrive sous trois formes selon le runtime : objet deja analyse,
// chaine, ou Buffer brut. La version precedente rendait le Buffer tel quel
// (`typeof buffer === 'object'`), et l'appelant y lisait un champ absent : un
// code d'acces juste etait alors refuse comme invalide. On traite les trois
// formes, et on lit le flux nous-memes quand rien n'a ete pre-analyse.
export async function readJsonBody(req) {
  const body = req.body

  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return analyse(Buffer.from(body).toString('utf8'))
  }
  if (typeof body === 'string') return analyse(body)
  if (body && typeof body === 'object') return body

  if (!req.readable) return {}
  const morceaux = []
  let taille = 0
  for await (const morceau of req) {
    taille += morceau.length
    // Une borne, pour qu'un corps geant ne remplisse pas la memoire.
    if (taille > MAX_CORPS) return {}
    morceaux.push(morceau)
  }
  return morceaux.length ? analyse(Buffer.concat(morceaux).toString('utf8')) : {}
}

// Meme prudence pour la chaine de requete : `req.query` est fourni par Vercel,
// mais on ne veut pas qu'un runtime qui ne le fournit pas fasse silencieusement
// retomber toutes les routes sur leurs valeurs par defaut.
export function readQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query
  try {
    return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
  } catch {
    return {}
  }
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
