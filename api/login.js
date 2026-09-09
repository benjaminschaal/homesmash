// La porte d'entree. Seule route accessible sans session -- et donc la seule
// qu'il faut proteger contre l'essai en masse.

import { send, methodNotAllowed, readJsonBody, clientIp } from './_lib/http.js'
import { issue, setSessionCookie } from './_lib/session.js'
import { match } from './_lib/accessCodes.js'
import { hit } from './_lib/rateLimit.js'
import { configError } from './_lib/guard.js'

const PAR_ADRESSE = { limit: 8, windowSeconds: 15 * 60 }
const GLOBAL = { limit: 60, windowSeconds: 15 * 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  // Les identifiants Doinsport ne sont pas necessaires pour se connecter a
  // l'application : on ne bloque donc pas la porte s'ils manquent encore.
  const problem = configError({ needsDoinsport: false })
  if (problem) return send(res, 503, { error: 'not_configured', hint: problem })

  const adresse = await hit(`login:${clientIp(req)}`, PAR_ADRESSE)
  const global = await hit('login:global', GLOBAL)
  if (!adresse.allowed || !global.allowed) {
    const retryAfter = Math.max(adresse.retryAfter, global.retryAfter)
    res.setHeader('Retry-After', String(retryAfter))
    return send(res, 429, { error: 'too_many_attempts', retryAfter })
  }

  const identity = match((await readJsonBody(req)).code)
  if (!identity) {
    // Une reponse instantanee permet de tester des milliers de codes ; un
    // demi-quart de seconde impose rend l'exercice inutilisable, sans que la
    // personne qui se trompe une fois ne s'en apercoive vraiment.
    await new Promise((resolve) => setTimeout(resolve, 400))
    return send(res, 401, { error: 'invalid_code' })
  }

  setSessionCookie(res, issue({ label: identity.label, role: identity.role }))
  // Le code n'apparait nulle part dans les traces, seulement le prenom.
  console.log(`connexion : ${identity.label} (${identity.role})`)
  return send(res, 200, { label: identity.label, role: identity.role })
}
