import { send, methodNotAllowed, intParam } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { ROLES } from './_lib/accessCodes.js'
import { getBookings } from './_lib/doinsport.js'

// Comme les credits : ce sont les reservations du compte, pas celles du groupe.
export default withAuth(
  async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
    const history = intParam(req.query?.history, { min: 0, max: 52, fallback: 1 })
    return send(res, 200, { history, ...(await getBookings(history)) })
  },
  { role: ROLES.ADMIN }
)
