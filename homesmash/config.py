"""
Configuration du CLI HomeSmash.

Les valeurs sont lues dans cet ordre :
  1. les variables d'environnement (les memes noms que sur Vercel) ;
  2. un fichier .env a la racine du depot, s'il existe ;
  3. les secrets Streamlit, pour ne pas casser une installation existante.

Avant, ce module importait Streamlit rien que pour lire un mot de passe :
le CLI ne demarrait donc pas sans une dependance d'interface graphique.
"""

import os
from pathlib import Path

_RACINE = Path(__file__).resolve().parent.parent


def _charge_dotenv():
    """Lit .env sans dependance externe. Les valeurs deja presentes gagnent."""
    fichier = _RACINE / ".env"
    if not fichier.exists():
        return
    for ligne in fichier.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, valeur = ligne.partition("=")
        os.environ.setdefault(cle.strip(), valeur.strip().strip('"').strip("'"))


_charge_dotenv()


def _secret_streamlit(section, cle):
    """Repli sur .streamlit/secrets.toml, uniquement si Streamlit est installe."""
    try:
        import streamlit as st

        return st.secrets[section][cle] if section else st.secrets[cle]
    except Exception:
        return None


def _valeur(nom_env, section=None, cle=None, defaut=None, requis=False):
    valeur = os.environ.get(nom_env) or (_secret_streamlit(section, cle) if cle else None) or defaut
    if requis and not valeur:
        raise RuntimeError(
            f"{nom_env} n'est pas defini. Renseigne-le dans .env "
            f"(voir .env.example) ou dans l'environnement."
        )
    return valeur


# --- Doinsport ---------------------------------------------------------------

LOGIN = _valeur("DOINSPORT_LOGIN", "doinsport", "login", requis=True)
PASSWORD = _valeur("DOINSPORT_PASSWORD", "doinsport", "password", requis=True)
CLUB_ID = _valeur("DOINSPORT_CLUB_ID", "doinsport", "club_id", requis=True)
ACTIVITY_ID = _valeur("DOINSPORT_ACTIVITY_ID", "doinsport", "activity_id", requis=True)
CATEGORY_ID = _valeur("DOINSPORT_CATEGORY_ID", "doinsport", "category_id")
WHITE_LABEL_ID = _valeur(
    "DOINSPORT_WHITE_LABEL_ID", defaut="802abea3-acbe-4f4f-aec7-3e36ee18a0e5"
)

# Creneaux du midi vises, du lundi au jeudi.
HEURES_CIBLES = ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15"]

HEADERS = {
    "User-Agent": "HomeSmash/1.0 (+https://github.com/benjaminschaal/homesmash)",
    "Origin": "https://badsclub.doinsport.club",
    "Referer": "https://badsclub.doinsport.club/",
    "Accept": "application/json, text/plain, */*",
    "X-Locale": "fr",
    "Content-Language": "fr",
}

# --- Google Chat ---------------------------------------------------------------

GOOGLE_CHAT_WEBHOOK = _valeur("GOOGLE_CHAT_WEBHOOK_PROD", "google_chat", "webhook_prod")
GOOGLE_CHAT_WEBHOOK_TEST = _valeur("GOOGLE_CHAT_WEBHOOK_TEST", "google_chat", "webhook_test")
