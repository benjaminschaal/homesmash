import { useState } from 'react'
import { api, messageErreur } from '../lib/api.js'

// L'ecran d'entree. Il ne dit jamais si un code existe mais est mal saisi, ni
// combien de codes sont configures : un code faux est un code faux.
export function Verrou({ onOuvert }) {
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function soumettre(event) {
    event.preventDefault()
    if (!code.trim() || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      await api.connexion(code.trim())
      await onOuvert()
    } catch (e) {
      setErreur(messageErreur(e))
      setCode('')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="verrou">
      <div>
        <img src="/icon-192.png" alt="" />
        <h1 style={{ marginTop: 20 }}>HomeSmash</h1>
        <p>Les créneaux de badminton du Bad’s Club.</p>
      </div>

      <form onSubmit={soumettre}>
        <input
          className="champ"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code d’accès"
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Code d’accès"
          enterKeyHint="go"
          autoFocus
        />
        <button className="bouton primaire large" type="submit" disabled={enCours || !code.trim()}>
          {enCours ? 'Vérification…' : 'Entrer'}
        </button>
      </form>

      {erreur && (
        <p className="message erreur" role="alert">
          {erreur}
        </p>
      )}

      <p className="pied">Chacun son code. Demande le tien à Benjamin.</p>
    </main>
  )
}
