// Client de l'API Doinsport. Ne tourne que dans une fonction serverless :
// le mot de passe du compte qui reserve n'est jamais compile dans le paquet
// envoye au navigateur, et le jeton Bearer ne quitte jamais le serveur.
//
// Difference notable avec l'ancienne version Python : les certificats sont
// verifies. `verify=False` desactivait le seul controle qui distingue le vrai
// api-v3.doinsport.club d'un intermediaire qui se ferait passer pour lui --
// autrement dit, le mot de passe partait dans un tunnel que n'importe quel
// reseau hostile pouvait ouvrir. fetch verifie par defaut, on n'y touche pas.

import { JOURS_SEMAINE } from './reglages.js'

const BASE = 'https://api-v3.doinsport.club'
const TIMEOUT_MS = 12000

const HEADERS = {
  'User-Agent': 'HomeSmash/1.0 (+https://github.com/benjaminschaal/homesmash)',
  Origin: 'https://badsclub.doinsport.club',
  Referer: 'https://badsclub.doinsport.club/',
  Accept: 'application/json, text/plain, */*',
  'X-Locale': 'fr',
  'Content-Language': 'fr'
}

export function config() {
  return {
    login: process.env.DOINSPORT_LOGIN || '',
    password: process.env.DOINSPORT_PASSWORD || '',
    clubId: process.env.DOINSPORT_CLUB_ID || '',
    activityId: process.env.DOINSPORT_ACTIVITY_ID || '',
    categoryId: process.env.DOINSPORT_CATEGORY_ID || '',
    whiteLabelId: process.env.DOINSPORT_WHITE_LABEL_ID || '802abea3-acbe-4f4f-aec7-3e36ee18a0e5'
  }
}

export function doinsportConfigError() {
  const c = config()
  const missing = Object.entries({
    DOINSPORT_LOGIN: c.login,
    DOINSPORT_PASSWORD: c.password,
    DOINSPORT_CLUB_ID: c.clubId,
    DOINSPORT_ACTIVITY_ID: c.activityId
  })
    .filter(([, value]) => !value)
    .map(([name]) => name)
  return missing.length ? `Variables d environnement manquantes : ${missing.join(', ')}.` : null
}

export function bookingUrl() {
  const c = config()
  const q = new URLSearchParams({
    guid: `"${c.clubId}"`,
    from: 'sport',
    activitySelectedId: `"${c.activityId}"`,
    categoryId: `"${c.categoryId}"`
  })
  return `https://badsclub.doinsport.club/select-booking?${q}`
}

async function call(path, { params, token, method = 'GET', accept } = {}) {
  const url = new URL(path, BASE)
  if (params) for (const [key, value] of Object.entries(params)) url.searchParams.append(key, value)

  const headers = { ...HEADERS }
  if (token) headers.Authorization = `Bearer ${token}`
  if (accept) headers.Accept = accept

  const response = await fetch(url, { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${method} ${path} -> HTTP ${response.status}`)
  return response.json()
}

// Le jeton est garde en memoire d'instance et reutilise : sans cela, chaque
// consultation de l'ecran d'accueil rejouerait une authentification complete.
let cached = { token: null, expiresAt: 0 }

function tokenLifetime(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    // On se reserve une minute de marge pour ne pas utiliser un jeton qui
    // expire pendant l'appel suivant.
    if (typeof claims.exp === 'number') return claims.exp * 1000 - 60_000
  } catch {
    /* jeton non lisible : on retombe sur la duree courte ci-dessous */
  }
  return Date.now() + 15 * 60 * 1000
}

export async function authenticate() {
  if (cached.token && cached.expiresAt > Date.now()) return cached.token

  const c = config()
  const username = c.login.startsWith('0') ? `+33${c.login.slice(1)}` : c.login

  const response = await fetch(new URL('/client_login_check', BASE), {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: c.password,
      club: `/clubs/${c.clubId}`,
      clubWhiteLabel: `/clubs/white-labels/${c.whiteLabelId}`,
      origin: 'white_label_app'
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })

  if (!response.ok) throw new Error(`authentification Doinsport refusee (HTTP ${response.status})`)
  const token = (await response.json())?.token
  if (!token) throw new Error('authentification Doinsport sans jeton')

  cached = { token, expiresAt: tokenLifetime(token) }
  return token
}

async function userId(token) {
  const me = await call('/me', { token })
  if (!me?.id) throw new Error('identifiant utilisateur introuvable')
  return me.id
}

// --- Dates -------------------------------------------------------------------

const iso = (date) => date.toISOString().slice(0, 10)

// Le lundi de la semaine contenant `date`, en UTC pour eviter qu'un decalage
// horaire ne fasse basculer un jour. L'ancienne version figeait l'annee a 2026 :
// on part d'aujourd'hui et on avance de sept jours, ce qui traverse le
// changement d'annee sans rien de special a prevoir.
function mondayOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const shift = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - shift)
  return d
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

// Les jours a interroger : ceux du parametrage (1 = lundi ... 7 = dimanche),
// sur `weeks` semaines a partir d'aujourd'hui, en sautant ceux deja passes --
// personne ne reserve hier.
export function targetDays(weeks, jours) {
  const today = iso(new Date())
  const monday = mondayOfWeek(new Date())
  const days = []
  for (let w = 0; w < weeks; w += 1) {
    for (let i = 0; i < 7; i += 1) {
      if (!jours.includes(i + 1)) continue
      const day = new Date(monday)
      day.setUTCDate(monday.getUTCDate() + w * 7 + i)
      const date = iso(day)
      if (date >= today) days.push({ date, jour: JOURS_SEMAINE[i], semaine: isoWeek(day) })
    }
  }
  return days
}

// --- Heures --------------------------------------------------------------------

const enMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const enHHMM = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// La fenetre demandee a Doinsport pour couvrir toutes les plages. Les anciennes
// bornes fixes (11:59 -> 14:01, pour des debuts de 12:00 a 13:15) laissaient une
// minute avant le premier debut et 46 apres le dernier : la place d'une seance
// de 45 min, la borne `to` portant sans doute sur la fin. On garde ces marges,
// si bien que le parametrage par defaut interroge exactement comme avant.
export function fenetre(plages) {
  const premier = Math.min(...plages.map((p) => enMinutes(p.debut)))
  const dernier = Math.max(...plages.map((p) => enMinutes(p.fin)))
  return {
    from: `${enHHMM(Math.max(0, premier - 1))}:00`,
    to: `${enHHMM(Math.min(23 * 60 + 59, dernier + 46))}:00`
  }
}

// Le format HH:MM se compare comme du texte : '12:45' < '13:00'.
export const dansLesPlages = (heure, plages) => plages.some((p) => heure >= p.debut && heure <= p.fin)

// --- Disponibilites -----------------------------------------------------------

async function availabilityForDay(day, token, plages) {
  const c = config()
  const data = await call(`/clubs/playgrounds/plannings/${day.date}`, {
    token,
    params: {
      'club.id': c.clubId,
      ...fenetre(plages),
      'activities.id': c.activityId,
      bookingType: 'unique'
    }
  })

  const parHeure = new Map()
  for (const playground of data?.['hydra:member'] || []) {
    const terrain = playground?.name || 'Terrain'
    for (const activity of playground?.activities || []) {
      for (const slot of activity?.slots || []) {
        // `startAt` arrive en '12:00:00' ou en '2026-10-19 12:00:00' : la
        // premiere sequence HH:MM est l'heure dans les deux cas.
        const heure = String(slot?.startAt || '').match(/\d{2}:\d{2}/)?.[0]
        if (!heure || !dansLesPlages(heure, plages)) continue
        if (!(slot?.prices || []).some((p) => p?.bookable === true)) continue
        if (!parHeure.has(heure)) parHeure.set(heure, [])
        parHeure.get(heure).push(terrain)
      }
    }
  }

  return {
    ...day,
    creneaux: [...parHeure.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([heure, terrains]) => ({ heure, terrains, nbTerrains: terrains.length }))
  }
}

// Les jours sont interroges par petits paquets : en serie c'est trop lent pour
// la limite de duree d'une fonction, tous d'un coup c'est impoli pour l'API.
export async function getAvailability(weeks, { jours, plages }) {
  const token = await authenticate()
  const days = targetDays(weeks, jours)
  const results = []
  const BATCH = 4

  for (let i = 0; i < days.length; i += BATCH) {
    const batch = await Promise.allSettled(
      days.slice(i, i + BATCH).map((day) => availabilityForDay(day, token, plages))
    )
    batch.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        // Un jour en erreur ne doit pas vider tout l'ecran : il est marque.
        console.error('dispo indisponible :', outcome.reason?.message || outcome.reason)
        results.push({ ...days[i + index], creneaux: [], erreur: true })
      }
    })
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

// --- Credits ------------------------------------------------------------------

export async function getCredits() {
  const token = await authenticate()
  const data = await call('/clubs/clients/payment-tokens', {
    token,
    accept: 'application/ld+json',
    params: { 'client.user.id': await userId(token) }
  })

  return (data?.['hydra:member'] || [])
    .map((item) => ({
      name: item?.name || 'Pack',
      balance: Number(item?.balance ?? 0),
      expiresAt: item?.expiresAt ? item.expiresAt.slice(0, 10) : null
    }))
    .filter((credit) => credit.balance > 0 || credit.name.includes('CE'))
    .sort((a, b) => b.balance - a.balance)
}

// --- Reservations -------------------------------------------------------------

function normalizeBooking(item) {
  const startAt = item?.startAt ? new Date(item.startAt) : null
  const terrain = item?.playgrounds?.[0]?.name || 'N/A'
  const parts = startAt
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }).formatToParts(startAt)
    : []
  const get = (type) => parts.find((p) => p.type === type)?.value || ''

  return {
    date: startAt ? startAt.toISOString() : null,
    jour: get('weekday'),
    jourMois: `${get('day')} ${get('month')}`,
    heure: startAt ? `${get('hour')}:${get('minute')}` : '--:--',
    terrain,
    annulee: Boolean(item?.canceled)
  }
}

export async function getBookings(weeksHistory) {
  const token = await authenticate()
  const c = config()
  const id = await userId(token)

  const now = new Date()
  const since = new Date(now.getTime() - weeksHistory * 7 * 86400000)
  const nowStr = now.toISOString()
  const sinceStr = since.toISOString()

  const common = {
    'club.id[]': c.clubId,
    'participants.user.id': id,
    'activityType[]': 'sport',
    itemsPerPage: '20'
  }

  const queries = {
    aVenir: [
      '/clubs/bookings/listing',
      {
        'club.id': c.clubId,
        'participants.user.id': id,
        canceled: 'false',
        confirmed: 'true',
        'startAt[after]': nowStr,
        'order[startAt]': 'ASC',
        itemsPerPage: '20'
      }
    ],
    passees: [
      '/clubs/bookings',
      {
        ...common,
        confirmed: 'true',
        canceled: 'false',
        'startAt[strictly_before]': nowStr,
        'startAt[after]': sinceStr,
        'order[startAt]': 'DESC'
      }
    ],
    annulees: [
      '/clubs/bookings',
      { ...common, canceled: 'true', 'startAt[after]': sinceStr, 'order[startAt]': 'DESC' }
    ]
  }

  const results = await Promise.allSettled(
    Object.entries(queries).map(async ([key, [path, params]]) => {
      let items = (await call(path, { token, params }))?.['hydra:member'] || []
      // `/listing` rend parfois une liste vide la ou `/bookings` repond :
      // on retente une fois plutot que d'afficher "aucune reservation" a tort.
      if (key === 'aVenir' && items.length === 0) {
        items = (await call('/clubs/bookings', { token, params }))?.['hydra:member'] || []
      }
      return [key, items.map(normalizeBooking)]
    })
  )

  const bookings = { aVenir: [], passees: [], annulees: [] }
  for (const outcome of results) {
    if (outcome.status === 'fulfilled') bookings[outcome.value[0]] = outcome.value[1]
    else console.error('reservations indisponibles :', outcome.reason?.message || outcome.reason)
  }
  return bookings
}
