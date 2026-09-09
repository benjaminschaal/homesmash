// La garde commune a toutes les routes de donnees : pas de session valide,
// pas de reponse. Les identifiants Doinsport ne sont approches qu'apres ce
// filtre, jamais avant.

import { send } from './http.js'
import { readSession, sessionConfigError } from './session.js'
import { accessCodesConfigError, ROLES } from './accessCodes.js'
import { doinsportConfigError } from './doinsport.js'

// Une configuration incomplete doit se voir tout de suite et se lire, plutot
// que de produire un 500 opaque trois ecrans plus loin.
export function configError({ needsDoinsport = true } = {}) {
  return sessionConfigError() || accessCodesConfigError() || (needsDoinsport ? doinsportConfigError() : null)
}

export function withAuth(handler, { role } = {}) {
  return async (req, res) => {
    const problem = configError()
    if (problem) return send(res, 503, { error: 'not_configured', hint: problem })

    const session = readSession(req)
    if (!session) return send(res, 401, { error: 'unauthorized' })
    if (role === ROLES.ADMIN && session.r !== ROLES.ADMIN) {
      return send(res, 403, { error: 'forbidden' })
    }

    req.session = session
    try {
      return await handler(req, res)
    } catch (error) {
      // Le detail interne reste dans les traces Vercel ; le navigateur ne
      // recoit qu'un code, pour ne rien apprendre sur l'API en amont.
      console.error(`[${req.url}] echec pour ${session.u} :`, error?.message || error)
      return send(res, 502, { error: 'upstream_failed' })
    }
  }
}
