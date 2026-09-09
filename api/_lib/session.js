// Session de l'application : un cookie signe, rien de plus.
//
// Le cookie ne contient qu'un prenom, un role et une date d'expiration, le tout
// signe en HMAC-SHA256 avec SESSION_SECRET. Il ne porte aucun identifiant
// Doinsport : meme vole, il ne donne acces qu'a ce que l'application expose
// deja, et il expire tout seul. Changer SESSION_SECRET deconnecte tout le monde
// instantanement -- c'est le bouton d'arret d'urgence.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE_NAME = 'hs_session'
export const TTL_SECONDS = 12 * 3600

const b64url = (input) => Buffer.from(input).toString('base64url')

// On refuse de fonctionner plutot que de signer avec un secret faible : une
// session signee avec "changeme" est une session forgeable par n'importe qui.
export function sessionConfigError() {
  const secret = process.env.SESSION_SECRET || ''
  if (secret.length < 32) {
    return 'SESSION_SECRET est absent ou fait moins de 32 caracteres. Genere-le avec `openssl rand -base64 48` puis ajoute-le aux variables d environnement Vercel.'
  }
  return null
}

function sign(payloadB64) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(payloadB64).digest('base64url')
}

export function issue({ label, role }) {
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(JSON.stringify({ u: label, r: role, iat: now, exp: now + TTL_SECONDS }))
  return `${payload}.${sign(payload)}`
}

export function verify(token) {
  if (typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot < 1) return null

  const payloadB64 = token.slice(0, dot)
  const given = Buffer.from(token.slice(dot + 1), 'base64url')
  const expected = Buffer.from(sign(payloadB64), 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null
  if (typeof payload.u !== 'string' || typeof payload.r !== 'string') return null
  return payload
}

function parseCookies(header) {
  const jar = {}
  if (typeof header !== 'string') return jar
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    jar[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return jar
}

export function readSession(req) {
  return verify(parseCookies(req.headers.cookie)[COOKIE_NAME])
}

// HttpOnly : le JavaScript de la page ne peut pas lire le cookie, donc une
// faille XSS ne l'exfiltre pas. SameSite=Strict : aucun autre site ne peut
// declencher d'appel authentifie a notre place. Secure : jamais en clair.
// Sur Vercel tout est en HTTPS, `Secure` ne coute donc rien meme en preversion.
export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL_SECONDS}`
  )
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
}
