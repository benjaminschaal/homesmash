// Publication dans Google Chat.
//
// Le corps de la requete ne porte que deux choix : quel type de message et vers
// quel salon. Le texte lui-meme est reconstruit ici a partir des donnees
// fraiches -- un code d'acces ne permet donc pas d'ecrire ce qu'on veut dans le
// salon de l'equipe, seulement de declencher un message dont le serveur decide
// entierement le contenu.

import { send, methodNotAllowed, readJsonBody, intParam } from './_lib/http.js'
import { withAuth } from './_lib/guard.js'
import { ROLES } from './_lib/accessCodes.js'
import { hit } from './_lib/rateLimit.js'
import { getAvailability, getBookings, getCredits, bookingUrl } from './_lib/doinsport.js'
import { carteSondage, carteReservations, webhook, publier } from './_lib/chat.js'

// Le salon est partage avec des collegues : mieux vaut une limite basse qu'un
// bouton qu'on peut marteler.
const PAR_PERSONNE = { limit: 6, windowSeconds: 3600 }

export default withAuth(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const body = await readJsonBody(req)
  const type = body.type === 'reservations' ? 'reservations' : 'sondage'
  const test = body.test === true
  const admin = req.session.r === ROLES.ADMIN

  // Publier ses reservations, c'est publier ses donnees personnelles : seul le
  // titulaire du compte peut le faire.
  if (type === 'reservations' && !admin) return send(res, 403, { error: 'forbidden' })

  const quota = await hit(`announce:${req.session.u}`, PAR_PERSONNE)
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfter))
    return send(res, 429, { error: 'too_many_messages', retryAfter: quota.retryAfter })
  }

  const url = webhook(test)
  if (!url) {
    return send(res, 503, {
      error: 'webhook_absent',
      hint: `Variable ${test ? 'GOOGLE_CHAT_WEBHOOK_TEST' : 'GOOGLE_CHAT_WEBHOOK_PROD'} non renseignee.`
    })
  }

  // Les credits n'accompagnent le message que si un admin le declenche.
  const credits = admin ? await getCredits().catch(() => []) : []

  let payload
  if (type === 'sondage') {
    const weeks = intParam(body.weeks, { min: 1, max: 6, fallback: 2 })
    payload = carteSondage(await getAvailability(weeks), credits, bookingUrl())
  } else {
    payload = carteReservations((await getBookings(0)).aVenir, credits)
  }

  await publier(url, payload)
  console.log(`publication ${type} par ${req.session.u} (salon ${test ? 'test' : 'prod'})`)
  return send(res, 200, { ok: true, type, salon: test ? 'test' : 'prod' })
})
