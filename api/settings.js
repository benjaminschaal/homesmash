// Les creneaux surveilles par l'application : les lire, les enregistrer,
// revenir au parametrage par defaut. Reserve aux codes admin -- le reglage
// vaut pour tout le monde, ecran des dispos comme sondage publie sur Chat.

import { send, methodNotAllowed, readJsonBody } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { ROLES } from './_lib/accessCodes.js'
import {
  lireReglages,
  enregistrerReglages,
  retablirDefaut,
  valider,
  persistance,
  PAR_DEFAUT,
  MAX_PLAGES
} from './_lib/reglages.js'

async function etat() {
  const { jours, plages, personnalise, majPar, majLe } = await lireReglages()
  return {
    reglages: { jours, plages },
    defaut: PAR_DEFAUT,
    maxPlages: MAX_PLAGES,
    personnalise,
    majPar,
    majLe,
    persistance
  }
}

export default withAuth(
  async (req, res) => {
    if (req.method === 'GET') return send(res, 200, await etat())
    if (req.method !== 'PUT' && req.method !== 'DELETE') {
      return methodNotAllowed(res, ['GET', 'PUT', 'DELETE'])
    }

    if (persistance === 'aucune') {
      return send(res, 503, {
        error: 'store_absent',
        hint: 'Enregistrement impossible sans stockage partagé : ajoute Upstash Redis au projet (Vercel › Storage), puis redéploie.'
      })
    }

    let action = retablirDefaut
    let resume = 'parametrage par defaut'
    if (req.method === 'PUT') {
      const { reglages, erreur } = valider(await readJsonBody(req))
      if (erreur) return send(res, 400, { error: 'invalid_settings', hint: erreur })
      action = () => enregistrerReglages(reglages, req.session.u)
      resume = `jours ${reglages.jours.join(',')}, ${reglages.plages.map((p) => `${p.debut}-${p.fin}`).join(' ')}`
    }

    // Un Redis qui ne repond pas n'a rien a voir avec Doinsport : on ne le
    // laisse pas remonter jusqu'au 502 generique de withAuth.
    try {
      await action()
    } catch (error) {
      console.error('reglages non enregistres :', error?.message || error)
      return send(res, 503, { error: 'store_failed' })
    }

    console.log(`creneaux suivis modifies par ${req.session.u} : ${resume}`)
    return send(res, 200, await etat())
  },
  { role: ROLES.ADMIN }
)
