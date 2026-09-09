// Construction des cartes Google Chat.
//
// Point important : le contenu publie est fabrique ici, a partir des donnees
// que le serveur vient de relire chez Doinsport. Le navigateur choisit le type
// de message, jamais son texte -- sans quoi un code d'acces suffirait a faire
// dire n'importe quoi au salon de l'equipe.

const EMOJIS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  .map((chiffre) => `${chiffre}\uFE0F\u20E3`)
  .concat('\u{1F51F}')

const ICONE_VOLANT =
  'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/sports_tennis/default/48px.svg'
const ICONE_AGENDA =
  'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/calendar_month/default/48px.svg'

// Doinsport renvoie parfois des demi-credits : on evite le 3.9999999999.
const formatSolde = (balance) =>
  Number.isInteger(balance) ? String(balance) : balance.toFixed(1).replace('.', ',')

// Google Chat interprete un sous-ensemble de HTML dans les cartes : les noms de
// terrains viennent de Doinsport, on les echappe plutot que de les recopier.
const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function widgetCredits(credits) {
  const lignes = (credits || [])
    .filter((c) => c.balance > 0 || c.name.includes('CE'))
    .map((c) => `• ${escape(c.name)} : ${formatSolde(c.balance)}`)
  if (lignes.length === 0) return []
  return [
    { divider: {} },
    {
      decoratedText: {
        topLabel: '🎟️ Crédits restants',
        text: lignes.join('<br>'),
        wrapText: true
      }
    }
  ]
}

const dateLisible = (isoDate) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', timeZone: 'Europe/Paris' }).format(
    new Date(`${isoDate}T12:00:00Z`)
  )

export function carteSondage(jours, credits, lienReservation) {
  const options = []
  for (const jour of jours) {
    for (const creneau of jour.creneaux) {
      options.push({
        label: `${jour.jour} ${dateLisible(jour.date)}`,
        detail: `${creneau.heure} — ${creneau.nbTerrains} terrain${creneau.nbTerrains > 1 ? 's' : ''}`
      })
    }
  }

  if (options.length === 0) {
    return { text: '🏸 Aucun créneau libre sur la période consultée.' }
  }

  const widgets = [
    {
      decoratedText: {
        topLabel: '📅 Créneaux libres',
        text: '<b>Réagissez avec le chiffre qui vous arrange</b>',
        wrapText: true
      }
    },
    { divider: {} }
  ]

  // Google Chat n'affiche pas de carte au-dela d'une centaine de widgets, et
  // au-dela de dix options plus personne ne vote : on tronque explicitement.
  options.slice(0, EMOJIS.length).forEach((option, index) => {
    widgets.push({
      decoratedText: {
        text: `${EMOJIS[index]} <b>${escape(option.label)}</b> — ${escape(option.detail)}`,
        wrapText: true
      }
    })
  })
  if (options.length > EMOJIS.length) {
    widgets.push({
      decoratedText: { text: `<i>+ ${options.length - EMOJIS.length} autres créneaux dans l'app</i>` }
    })
  }

  widgets.push({ divider: {} }, { decoratedText: { text: '❌ Pas disponible' } })
  widgets.push(...widgetCredits(credits))
  widgets.push({
    buttonList: {
      buttons: [{ text: 'Réserver sur Doinsport', onClick: { openLink: { url: lienReservation } } }]
    }
  })

  return {
    text: `🏸 ${options.length} créneau(x) de badminton disponible(s) — votez !`,
    cardsV2: [
      {
        cardId: 'homesmash-sondage',
        card: {
          header: {
            title: '🏸 Sondage Badminton',
            subtitle: 'Votez pour vos créneaux préférés',
            imageUrl: ICONE_VOLANT,
            imageType: 'CIRCLE'
          },
          sections: [{ widgets }]
        }
      }
    ]
  }
}

export function carteReservations(aVenir, credits) {
  const widgets = [
    {
      decoratedText: {
        topLabel: '🏸 À venir',
        text: '<b>Créneaux réservés</b>',
        startIcon: { knownIcon: 'STAR' }
      }
    }
  ]

  if (aVenir.length === 0) {
    widgets.push({ decoratedText: { text: '<i>Aucune réservation à venir</i>' } })
  } else {
    for (const resa of aVenir) {
      widgets.push({
        decoratedText: {
          text: `✅ <b>${escape(resa.jour)} ${escape(resa.jourMois)}</b> à <b>${escape(resa.heure)}</b>`,
          bottomLabel: `Terrain ${escape(resa.terrain)}`,
          wrapText: true
        }
      })
    }
  }

  widgets.push(...widgetCredits(credits))

  return {
    text: `📅 Réservations à venir : ${aVenir.length}.`,
    cardsV2: [
      {
        cardId: 'homesmash-reservations',
        card: {
          header: {
            title: 'HomeSmash — Réservations',
            subtitle: 'État des créneaux',
            imageUrl: ICONE_AGENDA,
            imageType: 'CIRCLE'
          },
          sections: [{ widgets }]
        }
      }
    ]
  }
}

export function webhook(test) {
  const url = test ? process.env.GOOGLE_CHAT_WEBHOOK_TEST : process.env.GOOGLE_CHAT_WEBHOOK_PROD
  // Le webhook est une URL secrete : la porter cote client reviendrait a
  // donner a tout le monde le droit d'ecrire dans le salon.
  if (!url) return null
  return url
}

export async function publier(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) throw new Error(`Google Chat a repondu HTTP ${response.status}`)
  return true
}
