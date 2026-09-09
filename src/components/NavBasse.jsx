import { IconeVolant, IconeAgenda, IconeCompte } from './Icones.jsx'

export function NavBasse({ page, onChange, admin }) {
  const entrees = [
    { id: 'dispos', label: 'Dispos', Icone: IconeVolant },
    ...(admin ? [{ id: 'resas', label: 'Réservations', Icone: IconeAgenda }] : []),
    { id: 'compte', label: 'Compte', Icone: IconeCompte }
  ]

  return (
    <nav className="navbasse">
      <div className="navbasse-int">
        {entrees.map(({ id, label, Icone }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <Icone />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
