import { methodNotAllowed, send } from './_lib/http.js'
import { clearSessionCookie } from './_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  clearSessionCookie(res)
  return send(res, 200, { ok: true })
}
