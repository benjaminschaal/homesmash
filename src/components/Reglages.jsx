import { useEffect, useState } from 'react'
import { api, messageErreur } from '../lib/api.js'
import { resumeCreneaux, enHeure, enPlage, NOMS_JOURS } from '../lib/format.js'

// Des raccourcis pour les moments habituels ; chaque plage reste ajustable au
// quart d'heure une fois ajoutee.
const MOMENTS = [
  { nom: 'Matin', debut: '09:00', fin: '11:45' },
  { nom: 'Midi', debut: '12:00', fin: '13:15' },
  { nom: 'Après-midi', debut: '14:00', fin: '17:45' },
  { nom: 'Soir', debut: '18:00', fin: '21:00' }
]

// Les heures proposees, de 7h a 22h45 au quart d'heure : la grille du club.
const HEURES = Array.from({ length: (23 - 7) * 4 }, (_, i) => {
  const minutes = 7 * 60 + i * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

// Deux parametrages identiques a l'ordre pres sont le meme parametrage.
const canonique = ({ jours, plages }) =>
  JSON.stringify([[...jours].sort((a, b) => a - b), plages.map((p) => `${p.debut}-${p.fin}`).sort()])

const memePlage = (a, b) => a.debut === b.debut && a.fin === b.fin

const dateLocale = (iso) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

function ChoixHeure({ valeur, onChange, label }) {
  // Une valeur hors grille, posee autrement que par cet ecran, reste affichee.
  const options = HEURES.includes(valeur) ? HEURES : [...HEURES, valeur].sort()
  return (
    <select className="choix-heure" value={valeur} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {options.map((heure) => (
        <option key={heure} value={heure}>
          {enHeure(heure)}
        </option>
      ))}
    </select>
  )
}

// Le parametrage vaut pour tout le monde : le serveur le garde, l'ecran des
// dispos et le sondage le relisent. Rien n'est applique avant "Enregistrer".
export function Reglages() {
  const [etat, setEtat] = useState(null)
  const [brouillon, setBrouillon] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [retour, setRetour] = useState(null)

  function appliquer(reponse) {
    setEtat(reponse)
    setBrouillon(reponse.reglages)
  }

  useEffect(() => {
    api
      .reglages()
      .then(appliquer)
      .catch((e) => setErreur(messageErreur(e)))
  }, [])

  const entete = (
    <div className="carte-titre">
      <h2>Créneaux suivis</h2>
      <span>pour tout le monde</span>
    </div>
  )

  if (erreur || !brouillon) {
    return (
      <div className="carte">
        {entete}
        {erreur ? <div className="message erreur">{erreur}</div> : <div className="squelette" style={{ height: 120 }} />}
      </div>
    )
  }

  const { jours, plages } = brouillon
  const modifie = canonique(brouillon) !== canonique(etat.reglages)
  const estDefaut = canonique(brouillon) === canonique(etat.defaut)
  const probleme =
    jours.length === 0 ? 'Choisis au moins un jour.' : plages.length === 0 ? 'Ajoute au moins un moment.' : null
  const sansStockage = etat.persistance === 'aucune'

  function modifier(suivant) {
    setRetour(null)
    setBrouillon(suivant)
  }

  const basculerJour = (n) =>
    modifier({
      ...brouillon,
      jours: jours.includes(n) ? jours.filter((j) => j !== n) : [...jours, n].sort((a, b) => a - b)
    })

  // Une borne qui depasse l'autre l'entraine avec elle, plutot que de laisser
  // une plage a l'envers qu'il faudrait ensuite corriger.
  function changerPlage(index, champ, valeur) {
    modifier({
      ...brouillon,
      plages: plages.map((plage, i) => {
        if (i !== index) return plage
        const suivante = { ...plage, [champ]: valeur }
        if (suivante.debut > suivante.fin) suivante[champ === 'debut' ? 'fin' : 'debut'] = valeur
        return suivante
      })
    })
  }

  const retirerPlage = (index) => modifier({ ...brouillon, plages: plages.filter((_, i) => i !== index) })

  const ajouterMoment = ({ debut, fin }) =>
    modifier({
      ...brouillon,
      plages: [...plages, { debut, fin }].sort((a, b) => a.debut.localeCompare(b.debut))
    })

  async function enregistrer() {
    setEnvoi(true)
    setRetour(null)
    try {
      // Revenir au defaut efface le reglage plutot que d'en garder une copie :
      // un defaut ajuste plus tard dans le code s'appliquera alors de lui-meme.
      appliquer(estDefaut ? await api.retablirReglages() : await api.enregistrerReglages(brouillon))
      setRetour({ etat: 'ok', texte: 'Enregistré. Les dispos et le sondage suivent ce paramétrage.' })
    } catch (e) {
      setRetour({ etat: 'erreur', texte: messageErreur(e) })
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="carte">
      {entete}

      <p className="etiquette">Jours</p>
      <div className="segments jours" role="group" aria-label="Jours suivis">
        {NOMS_JOURS.map((nom, i) => (
          <button
            key={nom}
            type="button"
            aria-pressed={jours.includes(i + 1)}
            aria-label={nom}
            onClick={() => basculerJour(i + 1)}
          >
            {nom.slice(0, 3)}
          </button>
        ))}
      </div>

      <p className="etiquette">
        Moments <span>heure de début du créneau</span>
      </p>
      {plages.map((plage, index) => (
        <div className="plage" key={index}>
          <ChoixHeure
            valeur={plage.debut}
            label="Premier début retenu"
            onChange={(valeur) => changerPlage(index, 'debut', valeur)}
          />
          <span>à</span>
          <ChoixHeure
            valeur={plage.fin}
            label="Dernier début retenu"
            onChange={(valeur) => changerPlage(index, 'fin', valeur)}
          />
          <button
            type="button"
            className="retirer"
            aria-label={`Retirer la plage ${enPlage(plage)}`}
            onClick={() => retirerPlage(index)}
          >
            ×
          </button>
        </div>
      ))}
      <div className="moments">
        {MOMENTS.map((moment) => (
          <button
            key={moment.nom}
            type="button"
            className="puce"
            onClick={() => ajouterMoment(moment)}
            disabled={plages.length >= etat.maxPlages || plages.some((p) => memePlage(p, moment))}
          >
            + {moment.nom}
          </button>
        ))}
      </div>

      <p className={`resume${probleme ? ' probleme' : ''}`} role="status">
        {probleme || resumeCreneaux(brouillon)}
      </p>

      {sansStockage && (
        <p className="message" style={{ marginBottom: 12 }}>
          Pour enregistrer, ajoute Upstash Redis au projet (Vercel › Storage), puis redéploie. En attendant, le
          paramétrage par défaut s’applique.
        </p>
      )}

      <button
        className="bouton primaire large"
        type="button"
        onClick={enregistrer}
        disabled={!modifie || Boolean(probleme) || envoi || sansStockage}
      >
        {envoi ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <div className="rangee">
        <button className="bouton" type="button" onClick={() => modifier(etat.defaut)} disabled={estDefaut || envoi}>
          Par défaut
        </button>
        <button className="bouton" type="button" onClick={() => modifier(etat.reglages)} disabled={!modifie || envoi}>
          Annuler
        </button>
      </div>

      {retour?.etat === 'ok' && (
        <p className="message succes" style={{ marginTop: 12 }} role="status">
          {retour.texte}
        </p>
      )}
      {retour?.etat === 'erreur' && (
        <p className="message erreur" style={{ marginTop: 12 }} role="alert">
          {retour.texte}
        </p>
      )}

      <p className="pied" style={{ marginTop: 14 }}>
        {etat.personnalise && etat.majPar
          ? `Modifié par ${etat.majPar.charAt(0).toUpperCase()}${etat.majPar.slice(1)}${etat.majLe ? ` le ${dateLocale(etat.majLe)}` : ''}.`
          : `Paramétrage par défaut : ${resumeCreneaux(etat.defaut)}.`}
        {etat.persistance === 'memoire' && ' Stockage en mémoire (développement local) : perdu au redémarrage.'}
      </p>
    </div>
  )
}
