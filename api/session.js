// "Qui suis-je ?" -- l'application appelle cette route au demarrage pour savoir
// s'il faut afficher l'ecran de deverrouillage ou l'application elle-meme.

import { send, methodNotAllowed } from './_lib/http.js'
import { readSession, sessionConfigError } from './_lib/session.js'
import { accessCodesConfigError } from './_lib/accessCodes.js'
import { doinsportConfigError } from './_lib/doinsport.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const problem = sessionConfigError() || accessCodesConfigError()
  if (problem) return send(res, 503, { error: 'not_configured', hint: problem })

  const session = readSession(req)
  if (!session) return send(res, 401, { error: 'unauthorized' })

  // Signale une configuration Doinsport incomplete apres connexion : l'ecran
  // d'accueil peut alors le dire clairement au lieu d'afficher une liste vide.
  return send(res, 200, {
    label: session.u,
    role: session.r,
    expiresAt: session.exp * 1000,
    doinsport: doinsportConfigError() ? 'incomplet' : 'ok'
  })
}
