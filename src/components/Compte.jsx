import { useEffect, useState } from 'react'
import { api, messageErreur } from '../lib/api.js'

const heureLocale = (horodatage) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(horodatage))

export function Compte({ session, onDeconnexion }) {
  const [credits, setCredits] = useState(null)
  const [erreurCredits, setErreurCredits] = useState(null)
  const admin = session.role === 'admin'

  useEffect(() => {
    if (!admin) return
    api
      .credits()
      .then((r) => setCredits(r.credits))
      .catch((e) => setErreurCredits(messageErreur(e)))
  }, [admin])

  async function deconnecter() {
    try {
      await api.deconnexion()
    } finally {
      onDeconnexion()
    }
  }

  return (
    <>
      {admin && (
        <div className="carte">
          <div className="carte-titre">
            <h2>Mes crédits</h2>
            <span>packs et tickets CE</span>
          </div>
          {erreurCredits && <div className="message erreur">{erreurCredits}</div>}
          {!credits && !erreurCredits && <div className="squelette" style={{ height: 44 }} />}
          {credits?.length === 0 && <p className="vide">Aucun crédit disponible.</p>}
          {credits?.map((credit) => (
            <div className="credit" key={credit.name}>
              <div className="credit-nom">
                {credit.name}
                {credit.expiresAt && <span>expire le {credit.expiresAt.split('-').reverse().join('/')}</span>}
              </div>
              <div className="credit-solde">{credit.balance}</div>
            </div>
          ))}
        </div>
      )}

      <div className="carte">
        <div className="carte-titre">
          <h2>Session</h2>
        </div>
        <div className="credit">
          <div className="credit-nom">Connecté en tant que</div>
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{session.label}</div>
        </div>
        <div className="credit">
          <div className="credit-nom">Accès</div>
          <div style={{ fontWeight: 600 }}>{admin ? 'Complet' : 'Créneaux et sondage'}</div>
        </div>
        <div className="credit">
          <div className="credit-nom">Expire</div>
          <div style={{ color: 'var(--texte-doux)' }}>{heureLocale(session.expiresAt)}</div>
        </div>
        <button className="bouton large" type="button" onClick={deconnecter} style={{ marginTop: 16 }}>
          Se déconnecter
        </button>
      </div>

      <div className="carte">
        <div className="carte-titre">
          <h2>Installer sur l’iPhone</h2>
        </div>
        <ol className="liste-puces">
          <li>Ouvrir cette page dans Safari (pas Chrome).</li>
          <li>Bouton Partager, puis « Sur l’écran d’accueil ».</li>
          <li>Lancer HomeSmash depuis l’icône, pas depuis Safari.</li>
        </ol>
      </div>

      <p className="pied" style={{ textAlign: 'center', padding: '4px 0 8px' }}>
        Le compte Doinsport reste sur le serveur. Ni ton navigateur ni cette page ne le voient.
      </p>
    </>
  )
}
