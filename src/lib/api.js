// Toutes les requetes passent par ici. `credentials: 'same-origin'` suffit :
// l'application ne parle qu'a ses propres fonctions, et le cookie de session
// est HttpOnly -- ce fichier ne le voit jamais, il se contente de l'accompagner.

class ErreurApi extends Error {
  constructor(status, corps) {
    super(corps?.hint || corps?.error || `HTTP ${status}`)
    this.status = status
    this.code = corps?.error
    this.retryAfter = corps?.retryAfter
  }
}

// Une session peut mourir avant l'heure : SESSION_SECRET change, code retire.
// Le compte a rebours de l'interface ne le voit pas ; un 401 en cours de route,
// si.
let surRefus = () => {}
export const auRefus = (rappel) => {
  surRefus = rappel
}

async function appel(chemin, options = {}) {
  const reponse = await fetch(chemin, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  })

  let corps = null
  try {
    corps = await reponse.json()
  } catch {
    /* reponse sans corps lisible : le status suffit */
  }

  if (!reponse.ok) {
    // /api/session et /api/login repondent 401 en fonctionnement normal :
    // les signaler ferait boucler l'ecran d'entree sur lui-meme.
    if (reponse.status === 401 && !chemin.startsWith('/api/session') && !chemin.startsWith('/api/login')) {
      surRefus()
    }
    throw new ErreurApi(reponse.status, corps)
  }
  return corps
}

export const api = {
  session: () => appel('/api/session'),
  connexion: (code) => appel('/api/login', { method: 'POST', body: JSON.stringify({ code }) }),
  deconnexion: () => appel('/api/logout', { method: 'POST' }),
  dispos: (weeks) => appel(`/api/availability?weeks=${weeks}`),
  reservations: (history) => appel(`/api/bookings?history=${history}`),
  credits: () => appel('/api/credits'),
  publier: (payload) => appel('/api/announce', { method: 'POST', body: JSON.stringify(payload) })
}

export { ErreurApi }

// Messages destines a l'ecran, en francais et sans jargon HTTP.
export function messageErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) return 'Connexion impossible. Reessaie dans un instant.'
  switch (erreur.code) {
    case 'invalid_code':
      return 'Code incorrect.'
    case 'too_many_attempts':
      return `Trop de tentatives. Réessaie dans ${Math.ceil((erreur.retryAfter || 900) / 60)} minutes.`
    case 'too_many_messages':
      return `Trop de messages publiés. Réessaie dans ${Math.ceil((erreur.retryAfter || 3600) / 60)} minutes.`
    case 'forbidden':
      return 'Ton code ne donne pas accès à cette partie.'
    case 'unauthorized':
      return 'Session expirée. Reconnecte-toi.'
    case 'not_configured':
    case 'webhook_absent':
      return erreur.message
    case 'upstream_failed':
      return 'Doinsport ne répond pas correctement. Réessaie dans un instant.'
    default:
      return erreur.message || 'Une erreur est survenue.'
  }
}
