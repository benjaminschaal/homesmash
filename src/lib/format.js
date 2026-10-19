const jourMois = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris'
})

// Les dates arrivent en 'AAAA-MM-JJ' : on les lit a midi UTC pour qu'aucun
// fuseau ne puisse les faire basculer d'un jour.
export const enJourMois = (dateIso) => jourMois.format(new Date(`${dateIso}T12:00:00Z`))

export const estAujourdHui = (dateIso) => dateIso === new Date().toISOString().slice(0, 10)

export const compter = (n, singulier, pluriel = `${singulier}s`) =>
  `${n} ${n > 1 ? pluriel : singulier}`

export const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// '12:00' -> '12h', '13:15' -> '13h15' : l'ecriture des horaires d'un club.
export const enHeure = (hhmm) => {
  const [h, m] = hhmm.split(':')
  return `${Number(h)}h${m === '00' ? '' : m}`
}

export const enPlage = ({ debut, fin }) => (debut === fin ? enHeure(debut) : `${enHeure(debut)}–${enHeure(fin)}`)

// "a, b et c" : une enumeration comme on la dit.
const enumerer = (elements) =>
  elements.length < 2 ? elements.join('') : `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`

// Le parametrage en une ligne : "lundi à jeudi, 12h–13h15". Trois jours qui se
// suivent ou plus s'ecrivent en intervalle, les autres un par un.
export function resumeCreneaux({ jours, plages }) {
  const suites = []
  for (const jour of [...jours].sort((a, b) => a - b)) {
    const derniere = suites[suites.length - 1]
    if (derniere && jour === derniere[derniere.length - 1] + 1) derniere.push(jour)
    else suites.push([jour])
  }
  const nom = (jour) => NOMS_JOURS[jour - 1]
  const texteJours =
    jours.length === 7
      ? 'tous les jours'
      : enumerer(
          suites.flatMap((suite) =>
            suite.length >= 3 ? [`${nom(suite[0])} à ${nom(suite[suite.length - 1])}`] : suite.map(nom)
          )
        )
  return `${texteJours}, ${enumerer(plages.map(enPlage))}`
}
