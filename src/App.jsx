import { useCallback, useEffect, useState } from 'react'
import { api, auRefus, ErreurApi } from './lib/api.js'
import { Verrou } from './components/Verrou.jsx'
import { Dispos } from './components/Dispos.jsx'
import { Reservations } from './components/Reservations.jsx'
import { Compte } from './components/Compte.jsx'
import { NavBasse } from './components/NavBasse.jsx'

const TITRES = {
  dispos: 'Créneaux libres',
  resas: 'Mes réservations',
  compte: 'Mon compte'
}

export default function App() {
  const [session, setSession] = useState(null)
  const [pret, setPret] = useState(false)
  const [blocage, setBlocage] = useState(null)
  const [page, setPage] = useState('dispos')

  // Au demarrage, une seule question au serveur : est-ce que mon cookie vaut
  // encore quelque chose ? Le navigateur ne peut pas y repondre seul, le cookie
  // etant HttpOnly -- et c'est exactement ce qu'on veut.
  useEffect(() => {
    api
      .session()
      .then(setSession)
      .catch((e) => {
        if (e instanceof ErreurApi && e.status === 503) setBlocage(e.message)
      })
      .finally(() => setPret(true))
  }, [])

  // Une session expiree pendant la navigation renvoie a l'ecran d'entree
  // plutot que de laisser des ecrans vides sans explication.
  const surExpiration = useCallback(() => {
    setSession(null)
    setPage('dispos')
  }, [])

  useEffect(() => {
    if (!session) return
    const restant = session.expiresAt - Date.now()
    if (restant <= 0) return surExpiration()
    const minuteur = setTimeout(surExpiration, restant)
    return () => clearTimeout(minuteur)
  }, [session, surExpiration])

  // Filet de securite : le compte a rebours ci-dessus suppose que la session
  // vit jusqu'a son echeance. Si le serveur la refuse avant (secret change,
  // code retire), le premier appel refuse nous ramene ici.
  useEffect(() => auRefus(surExpiration), [surExpiration])

  if (!pret) return null

  if (blocage) {
    return (
      <main className="verrou">
        <img src="/icon-192.png" alt="" />
        <h1>Configuration incomplète</h1>
        <p className="message erreur">{blocage}</p>
        <p className="pied">À renseigner dans Vercel, puis redéployer.</p>
      </main>
    )
  }

  // Apres connexion on redemande la session au serveur plutot que de deduire
  // son contenu : c'est lui qui connait l'echeance exacte et l'etat de la
  // configuration Doinsport.
  if (!session) return <Verrou onOuvert={() => api.session().then(setSession)} />

  const admin = session.role === 'admin'
  const pageActive = page === 'resas' && !admin ? 'dispos' : page

  return (
    <>
      <div className="app">
        <header className="entete">
          <img src="/icon-192.png" alt="" />
          <div className="entete-titre">
            <h1>{TITRES[pageActive]}</h1>
            <p>Bad’s Club · badminton du midi</p>
          </div>
          <span className="jeton">
            <b style={{ textTransform: 'capitalize' }}>{session.label}</b>
          </span>
        </header>

        {session.doinsport === 'incomplet' && (
          <p className="message erreur" style={{ marginBottom: 14 }}>
            Les identifiants Doinsport ne sont pas encore renseignés côté serveur.
          </p>
        )}

        {pageActive === 'dispos' && <Dispos admin={admin} />}
        {pageActive === 'resas' && <Reservations />}
        {pageActive === 'compte' && <Compte session={session} onDeconnexion={surExpiration} />}
      </div>

      <NavBasse page={pageActive} onChange={setPage} admin={admin} />
    </>
  )
}
