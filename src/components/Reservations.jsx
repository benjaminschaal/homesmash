import { useCallback, useEffect, useState } from 'react'
import { api, messageErreur } from '../lib/api.js'
import { compter } from '../lib/format.js'

const ONGLETS = [
  { id: 'aVenir', label: 'À venir' },
  { id: 'passees', label: 'Passées' },
  { id: 'annulees', label: 'Annulées' }
]

const HISTORIQUES = [1, 4, 12, 52]

export function Reservations() {
  const [onglet, setOnglet] = useState('aVenir')
  const [historique, setHistorique] = useState(4)
  const [donnees, setDonnees] = useState(null)
  const [enCours, setEnCours] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [publication, setPublication] = useState(null)

  const charger = useCallback(async (semaines) => {
    setEnCours(true)
    setErreur(null)
    try {
      setDonnees(await api.reservations(semaines))
    } catch (e) {
      setErreur(messageErreur(e))
      setDonnees(null)
    } finally {
      setEnCours(false)
    }
  }, [])

  useEffect(() => {
    charger(historique)
  }, [charger, historique])

  async function publier() {
    setPublication({ etat: 'envoi' })
    try {
      await api.publier({ type: 'reservations' })
      setPublication({ etat: 'ok', texte: 'Réservations publiées sur Google Chat.' })
    } catch (e) {
      setPublication({ etat: 'erreur', texte: messageErreur(e) })
    }
  }

  const liste = donnees?.[onglet] || []

  return (
    <>
      <div className="onglets" role="tablist">
        {ONGLETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
          >
            {label}
            {donnees ? ` (${donnees[id]?.length ?? 0})` : ''}
          </button>
        ))}
      </div>

      {onglet !== 'aVenir' && (
        <div className="segments" role="group" aria-label="Profondeur d’historique">
          {HISTORIQUES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={historique === n}
              onClick={() => setHistorique(n)}
            >
              {n === 52 ? '1 an' : `${n} sem.`}
            </button>
          ))}
        </div>
      )}

      <div className="carte" style={{ marginTop: 14 }}>
        {enCours && [0, 1].map((i) => <div key={i} className="squelette" style={{ height: 52 }} />)}

        {erreur && (
          <div className="message erreur" role="alert">
            {erreur}
          </div>
        )}

        {!enCours && !erreur && liste.length === 0 && (
          <p className="vide">
            {onglet === 'aVenir'
              ? 'Aucune séance réservée pour l’instant.'
              : `Rien sur ${compter(historique, 'semaine')}.`}
          </p>
        )}

        {!enCours &&
          !erreur &&
          liste.map((resa, index) => (
            <div className={`resa${resa.annulee ? ' annulee' : ''}`} key={`${resa.date}-${index}`}>
              <div className="resa-heure">{resa.heure}</div>
              <div className="resa-corps">
                <strong>
                  {resa.jour} {resa.jourMois}
                </strong>
                <span>
                  Terrain {resa.terrain}
                  {resa.annulee ? ' · annulée' : ''}
                </span>
              </div>
            </div>
          ))}
      </div>

      {!enCours && !erreur && (
        <div className="carte">
          <div className="carte-titre">
            <h2>Rappeler au groupe</h2>
            <span>salon de l’équipe</span>
          </div>
          <button
            className="bouton large"
            type="button"
            onClick={publier}
            disabled={publication?.etat === 'envoi'}
          >
            {publication?.etat === 'envoi' ? 'Envoi…' : 'Publier les réservations à venir'}
          </button>
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
