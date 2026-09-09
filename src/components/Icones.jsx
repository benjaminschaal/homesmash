// Trois pictogrammes trace a la main plutot qu'une bibliotheque d'icones :
// c'est 40 lignes contre 300 Ko, et la CSP n'a rien de tiers a autoriser.

const commun = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true
}

export const IconeVolant = (props) => (
  <svg {...commun} {...props}>
    {/* La jupe s evase vers le haut, le bouchon ferme en bas : sans cette
        proportion le volant se lit comme un simple triangle. */}
    <path d="M5.4 5.4a11 11 0 0 1 13.2 0L14.6 13H9.4L5.4 5.4Z" />
    <path d="M9.3 4.6 11 13M14.7 4.6 13 13" opacity=".5" />
    <path d="M9.4 13h5.2v3.3a2.6 2.6 0 0 1-5.2 0V13Z" />
  </svg>
)

export const IconeAgenda = (props) => (
  <svg {...commun} {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17M8.5 3v4M15.5 3v4" />
    <path d="M8 14h3" />
  </svg>
)

export const IconeCompte = (props) => (
  <svg {...commun} {...props}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </svg>
)
