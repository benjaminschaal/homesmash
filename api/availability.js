import { send, methodNotAllowed, intParam } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { getAvailability, bookingUrl, HEURES_CIBLES } from './_lib/doinsport.js'

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  // Borne haute assumee : au-dela, la fonction depasserait sa duree maximale
  // et Doinsport n'ouvre de toute facon pas ses creneaux si loin.
  const weeks = intParam(req.query?.weeks, { min: 1, max: 6, fallback: 2 })

  return send(res, 200, {
    weeks,
    heuresCibles: HEURES_CIBLES,
    bookingUrl: bookingUrl(),
    jours: await getAvailability(weeks)
  })
})
