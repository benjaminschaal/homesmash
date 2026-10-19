import { send, methodNotAllowed, intParam, readQuery } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { getAvailability, bookingUrl } from './_lib/doinsport.js'
import { lireReglages } from './_lib/reglages.js'

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  // Borne haute assumee : au-dela, la fonction depasserait sa duree maximale
  // et Doinsport n'ouvre de toute facon pas ses creneaux si loin.
  const weeks = intParam(readQuery(req).weeks, { min: 1, max: 6, fallback: 2 })
  const { jours, plages } = await lireReglages()

  return send(res, 200, {
    weeks,
    // Renvoye pour que l'ecran dise ce qu'il a cherche, sans le deviner.
    reglages: { jours, plages },
    bookingUrl: bookingUrl(),
    jours: await getAvailability(weeks, { jours, plages })
  })
})
