"""
Module API - Appels à l'API Doinsport
"""

import requests
from datetime import datetime, timedelta
from .config import (
    LOGIN,
    PASSWORD,
    CLUB_ID,
    ACTIVITY_ID,
    WHITE_LABEL_ID,
    HEADERS,
    HEURES_CIBLES,
)

# Le certificat du serveur est verifie (comportement par defaut de requests).
# L'ancienne version passait verify=False sur chaque appel : le mot de passe du
# compte partait alors dans un tunnel que n'importe quel reseau hostile pouvait
# ouvrir, sans le moindre avertissement.

# Delai maximal par appel : sans lui, une API muette bloque le CLI indefiniment.
TIMEOUT = 15


def authenticate():
    """
    Se connecte à l'API Doinsport pour obtenir un Token Bearer.
    
    Returns:
        str: Le token d'authentification ou None si échec
    """
    url = "https://api-v3.doinsport.club/client_login_check"
    
    payload = {
        "username": f"+33{LOGIN[1:]}" if LOGIN.startswith('0') else LOGIN,
        "password": PASSWORD,
        "club": f"/clubs/{CLUB_ID}",
        "clubWhiteLabel": f"/clubs/white-labels/{WHITE_LABEL_ID}",
        "origin": "white_label_app"
    }
    
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        
        token = response.json().get('token')
        if token:
            print("✅ Connexion réussie : Token récupéré.")
            return token
        else:
            print("❌ Échec de connexion : Aucun token reçu.")
            return None
    except Exception as e:
        print(f"⚠️ Erreur lors de l'authentification : {e}")
        return None


def get_dates_for_week(week_number, year=None):
    """
    Calcule les dates du Lundi au Jeudi pour un numéro de semaine donné.

    L'année était figée à 2026 : le CLI renvoyait donc les dates de 2026 quoi
    qu'il arrive. Par défaut on prend l'année en cours, et une semaine déjà
    passée est comprise comme celle de l'année suivante.

    Args:
        week_number: Numéro de semaine ISO
        year: Année (défaut : l'année en cours)

    Returns:
        list: Liste de dates au format 'AAAA-MM-JJ'
    """
    if year is None:
        aujourdhui = datetime.now().isocalendar()
        year = aujourdhui.year + (1 if week_number < aujourdhui.week else 0)
    monday = datetime.fromisocalendar(year, week_number, 1)
    return [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(4)]


def get_disponibilites(semaine_depart, nb_semaines=1, token=None):
    """
    Récupère les disponibilités de terrains pour une période donnée.
    """
    if not token:
        token = authenticate()
        if not token:
            print("🛑 Abandon : Impossible de s'authentifier.")
            return []
    
    current_headers = HEADERS.copy()
    current_headers["Authorization"] = f"Bearer {token}"
    
    resultats = []
    
    for i in range(nb_semaines):
        num_semaine = semaine_depart + i
        dates = get_dates_for_week(num_semaine)
        
        for date_cible in dates:
            dt = datetime.strptime(date_cible, "%Y-%m-%d")
            nom_jour = ["Lundi", "Mardi", "Mercredi", "Jeudi"][dt.weekday()]
            
            url = f"https://api-v3.doinsport.club/clubs/playgrounds/plannings/{date_cible}"
            
            params = {
                "club.id": CLUB_ID,
                "from": "11:59:00",
                "to": "14:01:00",
                "activities.id": ACTIVITY_ID,
                "bookingType": "unique"
            }
            
            try:
                response = requests.get(url, params=params, headers=current_headers, timeout=TIMEOUT)
                response.raise_for_status()
                data = response.json()
                
                playgrounds = data.get('hydra:member', [])
                dispos_par_heure = {}
                
                for pg in playgrounds:
                    terrain_nom = pg.get('name', 'Terrain')
                    for act in pg.get('activities', []):
                        for slot in act.get('slots', []):
                            start = slot.get('startAt', '')
                            if any(h in start for h in HEURES_CIBLES):
                                prices = slot.get('prices', [])
                                if any(p.get('bookable') is True for p in prices):
                                    heure = start.split(' ')[-1][:5] if ' ' in start else start[:5]
                                    if heure not in dispos_par_heure:
                                        dispos_par_heure[heure] = []
                                    dispos_par_heure[heure].append(terrain_nom)
                
                for heure in sorted(dispos_par_heure.keys()):
                    terrains = dispos_par_heure[heure]
                    resultats.append({
                        'semaine': num_semaine,
                        'date': date_cible,
                        'jour': nom_jour,
                        'heure': heure,
                        'terrains': terrains,
                        'nb_terrains': len(terrains)
                    })
                    
            except Exception as e:
                print(f"📅 {nom_jour} {date_cible} : ⚠️ Erreur API ({e})")
    
    return resultats


def get_user_id(token):
    """
    Récupère l'ID de l'utilisateur connecté.
    """
    url = "https://api-v3.doinsport.club/me"
    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json().get('id')
    except Exception as e:
        print(f"⚠️ Erreur récupération User ID : {e}")
        return None

def get_credits(token=None):
    """
    Récupère les crédits restants de l'utilisateur.
    """
    if not token:
        token = authenticate()
        if not token:
            return []

    user_id = get_user_id(token)
    if not user_id:
        return []

    url = f"https://api-v3.doinsport.club/clubs/clients/payment-tokens?client.user.id={user_id}"
    
    # Alternatively, the endpoint tested successfully was:
    url = f"https://api-v3.doinsport.club/clubs/clients/payment-tokens"
    
    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {token}"
    headers["Accept"] = "application/ld+json"
    
    params = {
        "client.user.id": user_id
    }
    
    try:
        # Requesting without specific params often returns all tokens for the auth user
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        
        tokens = data.get("hydra:member", [])
        credits_info = []
        for t in tokens:
            name = t.get("name", "Pack")
            balance = t.get("balance", 0)
            expires_at = t.get("expiresAt", "")
            if expires_at:
                try:
                    dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    expires_at = dt.strftime("%d/%m/%Y")
                except:
                    pass
            
            # Ne garder que ceux qui ont soit un solde positif, soit qui sont explicitement des "Ticket CE"
            if balance > 0 or "CE" in name:
                credits_info.append({
                    "name": name,
                    "balance": balance,
                    "expires_at": expires_at
                })
                
        return sorted(credits_info, key=lambda x: x['balance'], reverse=True)
        
    except Exception as e:
        print(f"⚠️ Erreur récupération crédits : {e}")
        return []


def get_reservations(token=None, weeks_history=1):
    """
    Récupère les réservations (passées, à venir, annulées).
    
    Args:
        token: Token d'auth
        weeks_history: Nombre de semaines d'historique à afficher pour les passées
    """
    if not token:
        token = authenticate()
        if not token:
            return {}

    user_id = get_user_id(token)
    if not user_id:
        return {}

    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {token}"
    headers["Device"] = "app"
    
    from datetime import timezone
    try:
        import zoneinfo
        paris_tz = zoneinfo.ZoneInfo("Europe/Paris")
    except ImportError:
        # Fallback pour les systèmes plus anciens ou sans zoneinfo
        paris_tz = timezone(timedelta(hours=1)) # Approximatif (CET)

    # L'API attend de l'UTC pour les filtres
    now_utc = datetime.now(timezone.utc)
    past_limit_utc = now_utc - timedelta(weeks=weeks_history)
    
    # Formatage ISO 8601 pour l'API
    now_str = now_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    past_limit_str = past_limit_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    reservations = {
        'a_venir': [],
        'passees': [],
        'annulees': []
    }
    
    # Paramètres communs
    base_params = {
        "club.id[]": CLUB_ID,
        "participants.user.id": user_id,
        "activityType[]": "sport",
        "confirmed": "true",
        "order[startAt]": "ASC"
    }

    # 1. À VENIR (On utilise /listing comme l'app, ou /bookings si besoin)
    url_avenir = "https://api-v3.doinsport.club/clubs/bookings/listing"
    params_avenir = {
        "club.id": CLUB_ID,
        "participants.user.id": user_id,
        "canceled": "false",
        "startAt[after]": now_str,
        "order[startAt]": "ASC",
        "confirmed": "true",
        "itemsPerPage": 20
    }
    
    # 2. PASSÉES
    url_passees = "https://api-v3.doinsport.club/clubs/bookings"
    params_passees = base_params.copy()
    params_passees.update({
        "canceled": "false",
        "startAt[strictly_before]": now_str,
        "startAt[after]": past_limit_str,
        "order[startAt]": "DESC",
        "itemsPerPage": 20
    })
    
    # 3. ANNULÉES
    url_annulees = "https://api-v3.doinsport.club/clubs/bookings"
    params_annulees = base_params.copy()
    params_annulees.update({
        "canceled": "true",
        "startAt[after]": past_limit_str,
        "order[startAt]": "DESC",
        "itemsPerPage": 20
    })
    if "confirmed" in params_annulees:
        del params_annulees["confirmed"] # Les annulées ne sont plus confirmées

    configs = [
        ('a_venir', url_avenir, params_avenir),
        ('passees', url_passees, params_passees),
        ('annulees', url_annulees, params_annulees)
    ]
    
    for key, url, params in configs:
        try:
            response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
            response.raise_for_status()
            items = response.json().get('hydra:member', [])
            
            # Si a_venir est vide avec /listing, tenter avec /bookings
            if key == 'a_venir' and not items:
                url_alt = "https://api-v3.doinsport.club/clubs/bookings"
                response = requests.get(url_alt, params=params, headers=headers, timeout=TIMEOUT)
                items = response.json().get('hydra:member', [])

            for item in items:
                start_at = item.get('startAt', '')
                if start_at:
                    # Conversion UTC -> Europe/Paris
                    dt_utc = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
                    dt_local = dt_utc.astimezone(paris_tz)
                else:
                    dt_local = None
                
                # Le numéro de terrain est dans playgrounds[0] > name
                playgrounds = item.get('playgrounds', [])
                terrain = playgrounds[0].get('name', 'N/A') if playgrounds else 'N/A'
                
                reservations[key].append({
                    'date': dt_local.strftime("%Y-%m-%d") if dt_local else 'N/A',
                    'heure': dt_local.strftime("%H:%M") if dt_local else 'N/A',
                    'terrain': terrain,
                    'status': 'Annulée' if item.get('canceled') else 'Confirmée'
                })
        except Exception as e:
            print(f"⚠️ Erreur lors de la récupération des réservations ({key}) : {e}")
            
    return reservations
