"""
Ancienne interface Streamlit, conservee pour ne rien perdre.

Elle est remplacee par la version web deployee sur Vercel, qui protege le
compte Doinsport bien mieux : un code d'acces par personne au lieu d'un mot de
passe unique partage, une limitation des tentatives, et des identifiants qui ne
transitent jamais par un service tiers. Tant que cette version-ci reste
deployee sur Streamlit Cloud, le meme compte a deux portes d'entree dont la
plus faible fixe le niveau de securite reel : voir le README pour la marche a
suivre.
"""

import streamlit as st
import datetime
import pandas as pd
import sys
import os

# Add the parent directory to sys.path to allow 'homesmash' module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from homesmash.api import get_disponibilites, get_reservations, get_credits
from homesmash.poll import publie_dispo, publie_resa
from homesmash.config import (
    CLUB_ID,
    ACTIVITY_ID,
    CATEGORY_ID,
    GOOGLE_CHAT_WEBHOOK,
    GOOGLE_CHAT_WEBHOOK_TEST,
)

st.set_page_config(page_title="HomeSmash - Badsclub", page_icon="🏸", layout="wide")

# Le mot de passe vient de l'environnement en priorite, comme le reste de la
# configuration ; st.secrets ne sert plus que de repli.
APP_PASSWORD = os.environ.get("APP_PASSWORD") or st.secrets.get("APP_PASSWORD", "")

st.warning(
    "⚠️ Version historique. La version web (Vercel) la remplace : "
    "un code d'accès par personne, tentatives limitées, compte Doinsport "
    "jamais exposé. Pense à retirer ce déploiement Streamlit Cloud."
)

# --- AUTHENTIFICATION ---
if "password_correct" not in st.session_state:
    st.session_state["password_correct"] = False

if not st.session_state["password_correct"]:
    st.title("🔒 Accès sécurisé")
    pwd = st.text_input("Veuillez saisir le mot de passe :", type="password")
    if st.button("Valider"):
        if APP_PASSWORD and pwd == APP_PASSWORD:
            st.session_state["password_correct"] = True
            st.rerun()
        else:
            st.error("Mot de passe incorrect.")
    st.stop()  # Arrête l'exécution de la suite si pas authentifié

# --- HELPER: afficher un callout crédits ---


def credits_callout(credits_list):
    """Affiche les crédits en bandeau callout en haut de page."""
    if not credits_list:
        return
    lines = []
    for c in credits_list:
        label = f"**{c['name']}** : {c['balance']} crédit(s)"
        if c.get("expires_at"):
            label += f" *(expire le {c['expires_at']})*"
        lines.append(f"- {label}")
    # Affichage multi-ligne pour éviter la troncature en '...'
    st.info("🎟️ **Mes crédits restants**\n" + "\n".join(lines))


# --- SIDEBAR ---
with st.sidebar:
    st.title("🏸 HomeSmash")
    st.caption("Badsclub – API Doinsport")

    # Navigation
    menu_options = [
        "🏠 Accueil",
        "🔍 Disponibilités",
        "📅 Mes Réservations",
        "📊 Statistiques",
    ]
    default_menu = st.session_state.get("nav", "🏠 Accueil")
    if default_menu not in menu_options:
        default_menu = "🏠 Accueil"
    menu_index = menu_options.index(default_menu)
    menu = st.radio(
        "Navigation",
        menu_options,
        index=menu_index,
    )
    # On synchronise la valeur choisie vers session_state (clé séparée)
    st.session_state["nav"] = menu

    st.markdown("---")

    # Mode Test
    default_test_mode = st.session_state.get("test_mode", False)
    test_mode = st.toggle("🧪 Mode Test (Salon privé)", value=default_test_mode)
    st.session_state["test_mode"] = test_mode
    current_webhook = GOOGLE_CHAT_WEBHOOK_TEST if test_mode else GOOGLE_CHAT_WEBHOOK
    if test_mode:
        st.caption("⚠️ Messages envoyés sur le salon de test")

    st.markdown("---")
    st.caption("Interface pour API Doinsport")


# --- CHARGEMENT DES CRÉDITS (une seule fois, mis en cache dans session) ---
if "credits_list" not in st.session_state:
    st.session_state.credits_list = get_credits()

credits_list = st.session_state.credits_list


# =============================================================================
# PAGE: ACCUEIL
# =============================================================================
if menu == "🏠 Accueil":
    st.title("🏸 HomeSmash")
    st.markdown("**Application de gestion des séances de Badminton – Bad's Club**")
    st.markdown("---")

    # Callout crédits en haut
    credits_callout(credits_list)

    st.markdown("### Que voulez-vous faire ?")

    btn_cols = st.columns(2)
    with btn_cols[0]:
        if st.button("🔍 Voir les Disponibilités", width="stretch"):
            st.session_state["nav"] = "🔍 Disponibilités"
            st.rerun()
        st.caption("Chercher les créneaux disponibles à la réservation.")

        if st.button("📊 Statistiques", width="stretch"):
            st.session_state["nav"] = "📊 Statistiques"
            st.rerun()
        st.caption("Historique et participations (Google Sheets).")

    with btn_cols[1]:
        if st.button("📅 Mes Réservations", width="stretch"):
            st.session_state["nav"] = "📅 Mes Réservations"
            st.rerun()
        st.caption("Consulter vos réservations passées et à venir.")

    # Aucun paramètre rapide supplémentaire sur la page d'accueil


# =============================================================================
# PAGE: DISPONIBILITÉS
# =============================================================================
elif menu == "🔍 Disponibilités":
    st.header("🔍 Disponibilités des terrains")

    # Callout crédits
    credits_callout(credits_list)

    col1, col2 = st.columns(2)
    with col1:
        current_week = datetime.date.today().isocalendar()[1]
        semaine_depart = st.number_input(
            "Semaine de départ", min_value=1, max_value=53, value=current_week
        )
    with col2:
        nb_semaines = st.number_input(
            "Nombre de semaines", min_value=1, max_value=20, value=2
        )

    if st.button("🔍 Lancer la recherche", type="primary"):
        with st.spinner("Recherche des terrains en cours..."):
            resultats = get_disponibilites(semaine_depart, nb_semaines)

            # On stocke le dernier résultat en session pour pouvoir
            # publier le sondage même après un nouveau rerun.
            st.session_state["dispos_resultats"] = resultats

            if not resultats:
                st.warning("Aucun terrain trouvé sur toute la période.")

    # Affichage des résultats (si déjà calculés précédemment)
    resultats = st.session_state.get("dispos_resultats", [])
    if resultats:
        st.success(f"{len(resultats)} créneaux horaires avec des terrains trouvés !")

        df = pd.DataFrame(resultats)
        df["terrains"] = df["terrains"].apply(lambda tl: ", ".join(tl))
        df = df.rename(
            columns={
                "semaine": "Semaine",
                "date": "Date",
                "jour": "Jour",
                "heure": "Heure",
                "terrains": "Terrains Disponibles",
                "nb_terrains": "Quantité",
            }
        )

        booking_url = (
            f"https://badsclub.doinsport.club/select-booking"
            f"?guid=%22{CLUB_ID}%22&from=sport"
            f"&activitySelectedId=%22{ACTIVITY_ID}%22"
            f"&categoryId=%22{CATEGORY_ID}%22"
        )
        df["Action"] = booking_url

        for semaine in df["Semaine"].unique():
            st.subheader(f"🗓️ Semaine {semaine}")
            df_semaine = df[df["Semaine"] == semaine]
            st.dataframe(
                df_semaine[
                    [
                        "Jour",
                        "Date",
                        "Heure",
                        "Terrains Disponibles",
                        "Quantité",
                        "Action",
                    ]
                ],
                hide_index=True,
                width="stretch",
                column_config={
                    "Action": st.column_config.LinkColumn(
                        "Réserver", display_text="🔗 Réserver"
                    )
                },
            )

        st.markdown("---")
        if st.button("📣 Publier le sondage sur Google Chat", type="secondary"):
            with st.spinner("Envoi en cours..."):
                resp = publie_dispo(
                    webhook_url=current_webhook,
                    resultats=resultats,
                    credits_list=credits_list,
                )
                if resp:
                    st.success(
                        "✅ Sondage publié !" + (" (Mode TEST)" if test_mode else "")
                    )
                else:
                    st.error("❌ Erreur lors de la publication.")


# =============================================================================
# PAGE: RÉSERVATIONS
# =============================================================================
elif menu == "📅 Mes Réservations":
    st.header("📅 Mes Réservations")

    # Callout crédits
    credits_callout(credits_list)

    weeks_history = st.slider(
        "Historique (semaines passées à inclure)", min_value=0, max_value=52, value=1
    )

    if st.button("🔄 Actualiser mes réservations", type="primary"):
        with st.spinner("Récupération en cours..."):
            reservations = get_reservations(weeks_history=weeks_history)
            st.session_state["reservations_data"] = reservations
            st.session_state["reservations_weeks_history"] = weeks_history

            if not reservations:
                st.info("Aucune réservation trouvée ou erreur de connexion.")

    reservations = st.session_state.get("reservations_data", {})
    last_weeks_history = st.session_state.get(
        "reservations_weeks_history", weeks_history
    )

    if reservations:
        tab1, tab2, tab3 = st.tabs(
            ["🏸 À VENIR", f"⏳ PASSÉES ({last_weeks_history} sem.)", "❌ ANNULÉES"]
        )

        def afficher_resa_df(liste_resas, empty_message):
            if not liste_resas:
                st.info(empty_message)
            else:
                df = pd.DataFrame(liste_resas)
                df = df.rename(
                    columns={
                        "date": "Date",
                        "heure": "Heure",
                        "terrain": "Terrain",
                        "status": "Statut",
                    }
                )
                st.dataframe(df, hide_index=True, width="stretch")

        with tab1:
            afficher_resa_df(
                reservations.get("a_venir", []), "Aucune réservation à venir."
            )
        with tab2:
            afficher_resa_df(
                reservations.get("passees", []),
                "Aucune réservation passée sur cette période.",
            )
        with tab3:
            afficher_resa_df(
                reservations.get("annulees", []),
                "Aucune réservation annulée sur cette période.",
            )

        st.markdown("---")
        if st.button("📣 Publier les réservations sur Google Chat", type="secondary"):
            with st.spinner("Publication en cours..."):
                resp = publie_resa(
                    reservations,
                    last_weeks_history,
                    webhook_url=current_webhook,
                    credits_list=credits_list,
                )
                if resp:
                    st.success(
                        "✅ Liste publiée !" + (" (Mode TEST)" if test_mode else "")
                    )
                else:
                    st.error("❌ Erreur lors de la publication.")


# =============================================================================
# PAGE: STATISTIQUES
# =============================================================================
elif menu == "📊 Statistiques":
    st.header("📊 Statistiques & Historique")
    st.markdown("""
Retrouvez l'historique complet des séances de badminton :
- Participations par joueur
- Comptes de présence
""")
    st.info(
        "💡 L'intégration directe n'est pas encore active (document privé). Cliquez sur le bouton ci-dessous pour accéder au fichier."
    )

    link = "https://docs.google.com/spreadsheets/d/1sKUehuP2inuLtNexh3TbVLFkcPMPKnehATE7L8JmuTU/edit?gid=718234535#gid=718234535"
    st.link_button("📊 Ouvrir le Google Sheets", link, width="stretch")


