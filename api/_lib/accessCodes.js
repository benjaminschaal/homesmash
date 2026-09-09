// Les codes d'acces, un par personne.
//
// HOMESMASH_ACCESS_CODES = "benjamin:code-long:admin,marc:autre-code-long"
//
// Un code par collegue plutot qu'un mot de passe unique partage : retirer une
// personne, c'est supprimer sa ligne et redeployer, sans deranger les autres,
// et les traces serveur disent qui a publie quoi. Les codes ne sont jamais
// renvoyes au navigateur, jamais journalises.

import { createHash, timingSafeEqual } from 'node:crypto'

const ADMIN = 'admin'
const MEMBRE = 'membre'
const MIN_LENGTH = 12

const digest = (value) => createHash('sha256').update(String(value), 'utf8').digest()

function parse(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, code, role] = entry.split(':').map((part) => (part || '').trim())
      return {
        label: label || 'invite',
        code,
        role: role === ADMIN ? ADMIN : MEMBRE
      }
    })
    .filter((entry) => entry.code)
}

// Le decoupage se fait une fois par instance, pas a chaque tentative.
let cachedRaw = null
let cachedEntries = []
function entries() {
  const raw = process.env.HOMESMASH_ACCESS_CODES || ''
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedEntries = parse(raw).map((entry) => ({ ...entry, hash: digest(entry.code) }))
  }
  return cachedEntries
}

export function accessCodesConfigError() {
  const list = entries()
  if (list.length === 0) {
    return 'HOMESMASH_ACCESS_CODES est vide. Format attendu : "prenom:code:admin,collegue:autre-code".'
  }
  const tooShort = list.filter((entry) => entry.code.length < MIN_LENGTH).map((entry) => entry.label)
  if (tooShort.length > 0) {
    return `Codes trop courts (${MIN_LENGTH} caracteres minimum) pour : ${tooShort.join(', ')}.`
  }
  if (!list.some((entry) => entry.role === ADMIN)) {
    return 'Aucun code marque ":admin". Ajoute le role admin a ton propre code.'
  }
  return null
}

// On compare l'empreinte de la saisie a celle de chaque code, sans sortir de la
// boucle au premier succes : le temps de reponse ne renseigne donc pas sur le
// nombre de codes valides ni sur la longueur du bon.
export function match(input) {
  const candidate = digest(typeof input === 'string' ? input : '')
  let found = null
  for (const entry of entries()) {
    if (timingSafeEqual(candidate, entry.hash)) found = { label: entry.label, role: entry.role }
  }
  return found
}

export const ROLES = { ADMIN, MEMBRE }
