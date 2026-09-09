import { useCallback, useEffect, useState } from 'react'
import { api, messageErreur } from '../lib/api.js'
import { enJourMois, estAujourdHui, compter } from '../lib/format.js'

const SEMAINES = [1, 2, 3, 4]

export function Dispos({ admin }) {
  const [semaines, setSemaines] = useState(2)
  const [donnees, setDonnees] = useState(null)
  const [enCours, setEnCours] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [modeTest, setModeTest] = useState(false)
  const [publication, setPublication] = useState(null)

  const charger = useCallback(async (nb) => {
    setEnCours(true)
    setErreur(null)
    try {
      setDonnees(await api.dispos(nb))
    } catch (e) {
      setErreur(messageErreur(e))
      setDonnees(null)
    } finally {
      setEnCours(false)
    }
  }, [])

  useEffect(() => {
    charger(semaines)
  }, [charger, semaines])

  async function publier() {
    setPublication({ etat: 'envoi' })
    try {
      const reponse = await api.publier({ type: 'sondage', weeks: semaines, test: modeTest })
      setPublication({
        etat: 'ok',
        texte: `Sondage publié sur le salon ${reponse.salon === 'test' ? 'de test' : 'de l’équipe'}.`
      })
    } catch (e) {
      setPublication({ etat: 'erreur', texte: messageErreur(e) })
    }
  }

  const jours = donnees?.jours || []
  const avecCreneaux = jours.filter((j) => j.creneaux.length > 0)
  const total = avecCreneaux.reduce((n, j) => n + j.creneaux.length, 0)

  return (
    <>
      <div className="segments" role="group" aria-label="Horizon de recherche">
        {SEMAINES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={semaines === n}
            onClick={() => setSemaines(n)}
          >
            {n} sem.
          </button>
        ))}
      </div>

      <p className="section-titre">
        {enCours
          ? 'Recherche en cours…'
          : erreur
            ? 'Créneaux libres'
            : `${compter(total, 'créneau', 'créneaux')} · lundi à jeudi, 12h–13h15`}
      </p>

      {erreur && (
        <div className="message erreur" role="alert">
          {erreur}
          <div style={{ marginTop: 12 }}>
            <button className="bouton" type="button" onClick={() => charger(semaines)}>
              Réessayer
            </button>
          </div>
        </div>
      )}

      {enCours && !erreur && [0, 1, 2].map((i) => <div key={i} className="squelette" />)}

      {!enCours && !erreur && avecCreneaux.length === 0 && (
        <div className="carte">
          <p className="vide">
            Aucun terrain libre sur {compter(semaines, 'semaine')}.<br />
            Essaie d’élargir l’horizon.
          </p>
        </div>
      )}

      {!enCours &&
        !erreur &&
        avecCreneaux.map((jour) => (
          <section className="jour" key={jour.date}>
            <div className="jour-entete">
              <strong>
                {jour.jour} {enJourMois(jour.date)}
              </strong>
              <span>{estAujourdHui(jour.date) ? "aujourd’hui" : `semaine ${jour.semaine}`}</span>
            </div>
            <div className="creneaux">
              {jour.creneaux.map((creneau) => (
                <a
                  className="creneau"
                  key={creneau.heure}
                  href={donnees.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <b>{creneau.heure}</b>
                  <span>{compter(creneau.nbTerrains, 'terrain')}</span>
                </a>
              ))}
            </div>
          </section>
        ))}

      {jours.some((j) => j.erreur) && (
        <p className="message">Certains jours n’ont pas pu être consultés. Actualise pour réessayer.</p>
      )}

      {!enCours && !erreur && total > 0 && (
        <div className="carte" style={{ marginTop: 22 }}>
          <div className="carte-titre">
            <h2>Proposer au groupe</h2>
          </div>
          <button
            className="bouton primaire large"
            type="button"
            onClick={publier}
            disabled={publication?.etat === 'envoi'}
          >
            {publication?.etat === 'envoi' ? 'Envoi…' : 'Publier le sondage sur Google Chat'}
          </button>

          {admin && (
            <label className="bascule">
              <span>Salon de test</span>
              <input
                type="checkbox"
                checked={modeTest}
                onChange={(e) => setModeTest(e.target.checked)}
              />
            </label>
          )}

          {publication?.etat === 'ok' && (
            <p className="message succes" style={{ marginTop: 12 }} role="status">
              {publication.texte}
            </p>
          )}
          {publication?.etat === 'erreur' && (
            <p className="message erreur" style={{ marginTop: 12 }} role="alert">
              {publication.texte}
            </p>
          )}
        </div>
      )}
    </>
  )
}
