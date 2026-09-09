import { send, methodNotAllowed } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { ROLES } from './_lib/accessCodes.js'
import { getCredits } from './_lib/doinsport.js'

// Le solde des packs est une donnee personnelle du titulaire du compte :
// reserve aux codes admin, pas aux collegues.
export default withAuth(
  async (req, res) => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
    return send(res, 200, { credits: await getCredits() })
  },
  { role: ROLES.ADMIN }
)
