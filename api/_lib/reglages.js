// Les creneaux que l'application surveille : quels jours, a quels moments.
//
// Un seul parametrage pour tout le monde, choisi par un admin depuis l'ecran
// Compte : l'ecran des dispos d'un collegue et le sondage publie sur Chat
// regardent ainsi les memes creneaux. Il vit dans Upstash Redis, le seul
// stockage partage entre les instances serverless dont dispose le projet.
// Tant que personne n'y a touche, c'est le parametrage par defaut qui
// s'applique : le rituel du club, du lundi au jeudi, le midi.

import { redis, redisDisponible } from './redis.js'

// Jours numerotes comme en ISO 8601 : 1 = lundi, 7 = dimanche.
export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

// Une plage borne l'heure de DEBUT du creneau, bornes comprises : 12:00 -> 13:15
// retient les seances qui commencent a 12:00, 12:15... jusqu'a 13:15.
export const PAR_DEFAUT = Object.freeze({
  jours: Object.freeze([1, 2, 3, 4]),
  plages: Object.freeze([Object.freeze({ debut: '12:00', fin: '13:15' })])
})

// Borne le nombre d'appels a Doinsport autant que la lisibilite de l'ecran.
export const MAX_PLAGES = 4

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/
const CLE = 'homesmash:reglages'

// Sans Redis, sur Vercel, un enregistrement ne vivrait que dans l'instance qui
// l'a recu : les autres continueraient d'afficher l'ancien parametrage, sans
// que rien ne le signale. On refuse donc d'enregistrer plutot que de faire
// semblant. En local (`vercel dev`), une seule instance tourne : la memoire
// suffit pour essayer.
export const persistance = redisDisponible ? 'redis' : process.env.VERCEL ? 'aucune' : 'memoire'
let enMemoire = null

// Tout ce qui entre passe par ici, corps de requete comme valeur relue : une
// valeur stockee abimee ne doit pas faire tomber l'ecran des dispos.
export function valider(entree) {
  const jours = entree?.jours
  if (!Array.isArray(jours) || jours.length === 0) return { erreur: 'Choisis au moins un jour.' }
  if (!jours.every((j) => Number.isInteger(j) && j >= 1 && j <= 7)) return { erreur: 'Jour inconnu.' }

  const plages = entree?.plages
  if (!Array.isArray(plages) || plages.length === 0) {
    return { erreur: 'Choisis au moins un moment de la journée.' }
  }
  if (plages.length > MAX_PLAGES) return { erreur: `${MAX_PLAGES} moments au plus.` }
  for (const plage of plages) {
    if (!HEURE.test(plage?.debut) || !HEURE.test(plage?.fin)) {
      return { erreur: 'Heure illisible : format attendu HH:MM.' }
    }
    if (plage.debut > plage.fin) {
      return { erreur: `La plage ${plage.debut} – ${plage.fin} finit avant de commencer.` }
    }
  }

  // Forme canonique : jours tries sans doublon, plages triees sans doublon.
  // Les champs inconnus du corps de requete ne vont pas plus loin.
  const uniques = new Map()
  for (const { debut, fin } of plages) uniques.set(`${debut}-${fin}`, { debut, fin })
  return {
    reglages: {
      jours: [...new Set(jours)].sort((a, b) => a - b),
      plages: [...uniques.values()].sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin))
    }
  }
}

export async function lireReglages() {
  let brut = null
  try {
    brut = persistance === 'redis' ? JSON.parse((await redis(['GET', CLE])) || 'null') : enMemoire
  } catch (error) {
    // Redis injoignable : l'ecran des dispos reste utilisable, sur le
    // parametrage par defaut, plutot que de tomber en erreur.
    console.error('reglages illisibles, parametrage par defaut :', error?.message || error)
  }

  const { reglages } = brut ? valider(brut) : {}
  if (!reglages) {
    if (brut) console.error('reglages enregistres invalides, parametrage par defaut')
    return { ...PAR_DEFAUT, personnalise: false, majPar: null, majLe: null }
  }
  return {
    ...reglages,
    personnalise: true,
    majPar: typeof brut.majPar === 'string' ? brut.majPar : null,
    majLe: typeof brut.majLe === 'string' ? brut.majLe : null
  }
}

export async function enregistrerReglages(reglages, auteur) {
  const valeur = { ...reglages, majPar: auteur, majLe: new Date().toISOString() }
  if (persistance === 'redis') await redis(['SET', CLE, JSON.stringify(valeur)])
  else enMemoire = valeur
}

// Revenir au defaut, c'est effacer la cle : un futur changement du defaut
// dans le code s'appliquera alors sans qu'il faille re-enregistrer quoi que ce soit.
export async function retablirDefaut() {
  if (persistance === 'redis') await redis(['DEL', CLE])
  else enMemoire = null
}
