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
