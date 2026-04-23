import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
import numpy as np
from sqlalchemy import create_engine
from io import BytesIO
import traceback
import os
import unicodedata
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL")
engine = create_engine(database_url)

# ==========================================
# CONSTANTES ET CHARTE GRAPHIQUE
# ==========================================
COLOR_BASE = "#34B1E2"
# Palette premium (sans orange) : Bleu, Vert 52BD84, Rose FFB4E5, Violet A482D9, Jaune, Gris
PALETTE_5 = ["#34B1E2", "#52BD84", "#FFB4E5", "#A482D9", "#FFCE00", "#7A7A7A"]
RESP_COLORS = {'Orange': '#A482D9', 'Client': '#52BD84', 'Autres': '#FFB4E5'}
CRIT_COLORS = {'Bloquant': '#52BD84', 'Majeur': '#FFB4E5', 'Mineur': '#A482D9'}

MOIS_REF = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

PERIODES_MAP = {
    "T1": ["Janvier", "Février", "Mars"],
    "T2": ["Avril", "Mai", "Juin"],
    "T3": ["Juillet", "Août", "Septembre"],
    "T4": ["Octobre", "Novembre", "Décembre"],
    "S1": ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin"],
    "S2": ["Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
    "Année": MOIS_REF
}

# ==========================================
# CHARGEMENT ET PRÉPARATION
# ==========================================

def _normalize_token(value):
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def _get_selected_months(trimestre):
    if not trimestre:
        return MOIS_REF.copy()

    normalized_periods = {
        _normalize_token("T1"): PERIODES_MAP["T1"],
        _normalize_token("T2"): PERIODES_MAP["T2"],
        _normalize_token("T3"): PERIODES_MAP["T3"],
        _normalize_token("T4"): PERIODES_MAP["T4"],
        _normalize_token("S1"): PERIODES_MAP["S1"],
        _normalize_token("S2"): PERIODES_MAP["S2"],
    }

    mois_sel = []
    for period in trimestre:
        for month in normalized_periods.get(_normalize_token(period), []):
            if month not in mois_sel:
                mois_sel.append(month)

    return mois_sel or MOIS_REF.copy()


def _normalize_series(series):
    return series.fillna("").astype(str).str.strip()


def load_data_from_db(client=None, annees=None):
    try:
        query = """
        SELECT 
            "numero_ticket" AS "N° ticket", "etat" AS "Etat", "date_cloture" AS "Date clôture",
            "description" AS "Description", "client" AS "Client", "site_client" AS "Site Client",
            "criticite" AS "Criticité", "service" AS "Service", "niveau_resolution" AS "Niveau Résolution",
            "duree_traitement_mn_oceane" AS "Durée de traitement (mn) OCEANE",
            "engagement" AS "Engagement", "action_resolution" AS "Action de résolution",
            "famille_probleme" AS "Famille de problème", "type_ticket" AS "Type ticket",
            "year_cloture" AS "Year Cloture"
        FROM public.donnees_excel WHERE 1=1
        """
        params = {}
        if client:
            query += " AND client = %(client)s"
            params['client'] = client
        if annees:
            query += " AND \"year_cloture\" = ANY(%(annees)s)"
            params['annees'] = [int(a) for a in annees] if isinstance(annees, list) else [int(annees)]

        df = pd.read_sql(query, engine, params=params)

        if not df.empty:
            # Sécurisation des types
            df["Date clôture"] = pd.to_datetime(df['Date clôture'], errors='coerce')
            df["Year Cloture"] = pd.to_numeric(df["Year Cloture"], errors='coerce').fillna(0).astype(int)
            
            mois_fr = {i+1: m for i, m in enumerate(MOIS_REF)}
            df['Month_clos'] = df['Date clôture'].dt.month.map(mois_fr)
            df['Month_clos'] = pd.Categorical(df['Month_clos'], categories=MOIS_REF, ordered=True)
            
        return df
    except Exception as e:
        print(f"Erreur DB: {e}")
        return pd.DataFrame()

# ==========================================
# FONCTIONS DE DONNÉES POUR GRAPHIQUES
# ==========================================

def evolution_globale_data(df, annees, client, trimestre):
    try:
        # 1. Préparation des mois demandés
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = sorted({int(a) for a in annees if str(a).isdigit()})
        
        # Sécurisation des colonnes pour le filtrage
        type_ticket = _normalize_series(df["Type ticket"]).str.upper()
        client_series = _normalize_series(df["Client"])
        
        # 3. Filtrage
        mask = (
            (df["Month_clos"].isin(mois_sel)) & 
            (type_ticket == "INCIDENT") & 
            (client_series == str(client).strip()) &
            (df["Year Cloture"].isin(annees_int))
        )
        df_f = df[mask].copy()
        
        datasets = []
        
        # 4. Si vide, on renvoie des listes de zéros
        if df_f.empty:
            for i, a in enumerate(annees_int):
                datasets.append({
                    "label": str(a), 
                    "data": [0] * len(mois_sel), 
                    "backgroundColor": PALETTE_5[i % 5]
                })
            return {"title": f"Évolution globale - {client}", "labels": mois_sel, "datasets": datasets}

        # 5. Groupement et Pivot
        # AJOUT DE .fillna(0) ICI pour remplacer les vides par des zéros AVANT la conversion
        grouped = df_f.groupby(["Year Cloture", "Month_clos"], observed=True).size().unstack(level=0).fillna(0)
        
        # 6. Construction des datasets
        for i, annee in enumerate(annees_int):
            if annee in grouped.columns:
                # On réindexe sur mois_sel pour garantir l'ordre et la complétude
                series_annee = grouped[annee].reindex(mois_sel, fill_value=0)
                # Conversion sécurisée en int après s'être assuré qu'il n'y a plus de NaN
                data = [int(round(d)) for d in series_annee.tolist()]
            else:
                data = [0] * len(mois_sel)
                
            datasets.append({
                "label": str(annee), 
                "data": data,
                "backgroundColor": PALETTE_5[i % 5]
            })
        
        return {"title": f"Évolution globale - {client}", "labels": mois_sel, "datasets": datasets}

    except Exception as e:
        print(f"Crash evolution_globale: {e}")
        traceback.print_exc()
        return {"title": "Erreur données", "labels": [], "datasets": []}

def evolution_criticite_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = sorted({int(a) for a in annees if str(a).isdigit()})
        
        client_series = _normalize_series(df["Client"])
        type_ticket = _normalize_series(df["Type ticket"]).str.upper()

        mask = (
            (client_series == str(client).strip()) & 
            (type_ticket == "INCIDENT") &
            (df["Year Cloture"].isin(annees_int)) &
            (df["Month_clos"].isin(mois_sel))
        )
        df_f = df[mask].copy()

        datasets = []
        categories = ["Mineur", "Majeur", "Bloquant"]
        
        # On définit les couleurs par criticité (nuances pour différencier les années si besoin)
        # Ou on garde les mêmes couleurs pour que la légende soit cohérente
        
        for i, annee in enumerate(annees_int):
            df_year = df_f[df_f["Year Cloture"] == annee]
            
            # Groupement par mois et criticité pour l'année en cours
            grouped = df_year.groupby(["Month_clos", "Criticité"]).size().unstack(fill_value=0)
            
            for crit in categories:
                if crit in grouped.columns:
                    series_crit = grouped[crit].reindex(mois_sel, fill_value=0)
                    data = [int(v) for v in series_crit.tolist()]
                else:
                    data = [0] * len(mois_sel)
                
                datasets.append({
                    "label": crit, # Suppression de l'année pour le nettoyage des légendes
                    "data": data,
                    "backgroundColor": CRIT_COLORS.get(crit, "#CCCCCC"),
                    "stack": str(annee) # Très important pour le groupement par année
                })
        
        return {
            "title": "Évolution par criticité", 
            "labels": mois_sel, # Uniquement les mois en X
            "datasets": datasets
        }
    except Exception as e:
        print(f"Crash evolution_criticite: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def EvResp_data(df, annees, client, trimestre):
    try:
        options_client = ['Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
        options_autres = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange']
        
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = sorted({int(a) for a in annees if str(a).isdigit()})

        mask = (
            (_normalize_series(df["Client"]) == str(client).strip()) & 
            (df["Year Cloture"].isin(annees_int)) & 
            (df["Month_clos"].isin(mois_sel))
        )
        df_f = df[mask].copy()

        if df_f.empty:
            return {"title": "Évolution responsabilités", "labels": mois_sel, "datasets": []}

        # Calcul de la responsabilité
        df_f['Responsabilité'] = np.select(
            [df_f['Famille de problème'].isin(options_client), df_f['Famille de problème'].isin(options_autres)],
            ['Client', 'Autres'], default='Orange'
        )
        
        datasets = []
        categories = ["Orange", "Client", "Autres"]

        for annee in annees_int:
            df_year = df_f[df_f["Year Cloture"] == annee]
            grouped = df_year.groupby(["Month_clos", "Responsabilité"]).size().unstack(fill_value=0)
            
            for res in categories:
                if res in grouped.columns:
                    series_res = grouped[res].reindex(mois_sel, fill_value=0)
                    data = [int(v) for v in series_res.tolist()]
                else:
                    data = [0] * len(mois_sel)
                    
                datasets.append({
                    "label": res, # Suppression de l'année pour le nettoyage des légendes
                    "data": data,
                    "backgroundColor": RESP_COLORS.get(res, "#7A7A7A"),
                    "stack": str(annee) # Groupement par année
                })
                
        return {
            "title": "Évolution responsabilités", 
            "labels": mois_sel, 
            "datasets": datasets
        }
    except Exception as e:
        print(f"Crash EvResp: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

# ==========================================
# AUTRES FONCTIONS (RESTENT IDENTIQUES MAIS SÉCURISÉES)
# ==========================================

def distribution_criticite_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        filtered = df[(df["Client"] == str(client).strip()) & 
                      (df["Year Cloture"].isin(annees_int)) & 
                      (df["Month_clos"].isin(mois_sel))].copy()
        
        if filtered.empty:
            return {"title": "Distribution Criticité (Vide)", "labels": [], "datasets": []}
            
        grouped = filtered.groupby("Criticité").size()
        labels = grouped.index.tolist()
        return {
            "title": f"Distribution Criticité ({', '.join(map(str, annees))})",
            "labels": labels,
            "datasets": [{"data": grouped.tolist(), "backgroundColor": [CRIT_COLORS.get(l, COLOR_BASE) for l in labels]}]
        }
    except Exception as e:
        print(f"Crash distribution_criticite: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def DistResp_data(df, annees, client, trimestre):
    try:
        options_client = ['Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
        options_autres = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange']
        
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Répartition responsabilités (Vide)", "labels": [], "datasets": []}

        df_f['Responsabilité'] = np.select(
            [df_f['Famille de problème'].isin(options_client), df_f['Famille de problème'].isin(options_autres)],
            ['Client', 'Autres'], default='Orange'
        )
        
        grouped = df_f.groupby('Responsabilité').size()
        labels = grouped.index.tolist()
        return {
            "title": "Répartition responsabilités",
            "labels": labels,
            "datasets": [{"data": grouped.tolist(), "backgroundColor": [RESP_COLORS.get(l, "#999999") for l in labels]}]
        }
    except Exception as e:
        print(f"Crash DistResp: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def ServImpact_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Services Impactés (Vide)", "labels": [], "datasets": []}
        
        grouped = df_f.groupby('Service').size().sort_values(ascending=False).head(5)
        return {
            "title": "Top 5 Services Impactés",
            "labels": grouped.index.tolist(),
            "datasets": [{"data": grouped.tolist(), "backgroundColor": PALETTE_5}]
        }
    except Exception as e:
        print(f"Crash ServImpact: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def NivTait_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Niveaux Traitement (Vide)", "labels": [], "datasets": []}
        
        grouped = df_f.groupby('Niveau Résolution').size().sort_values(ascending=False).head(5)
        return {
            "title": "Niveaux de traitement",
            "labels": grouped.index.tolist(),
            "datasets": [{"data": grouped.tolist(), "backgroundColor": PALETTE_5}]
        }
    except Exception as e:
        print(f"Crash NivTrait: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def TauxResGTR_data(df, annees, client, trimestre):
    try:
        options = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange', 'Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
        
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Taux GTR (Vide)", "labels": [], "datasets": []}

        cond = (df_f["Criticité"] == "Bloquant") & (df_f["Durée de traitement (mn) OCEANE"] > 240) & (~df_f['Famille de problème'].isin(options))
        df_f['GTR'] = np.select([cond], ["NOK"], default="OK")
        
        grouped = df_f["GTR"].value_counts()
        return {
            "title": "Taux de respect GTR",
            "labels": grouped.index.tolist(),
            "datasets": [{"data": grouped.tolist(), "backgroundColor": [COLOR_BASE, "#2D2D2D"]}]
        }
    except Exception as e:
        print(f"Crash TauxResGTR: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def TopSitesRec_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Sites Récurrents (Vide)", "labels": [], "datasets": []}
        
        grouped = df_f.groupby("Site Client").size().sort_values(ascending=False).head(10)
        # Nettoyage des valeurs NaN éventuelles avant envoi
        labels = [str(l) if pd.notnull(l) else "" for l in grouped.index.tolist()]
        data = [int(v) if pd.notnull(v) else 0 for v in grouped.tolist()]

        return {
            "title": "Top Sites Récurrents",
            "labels": labels,
            "datasets": [{"label": "Incidents", "data": data, "backgroundColor": COLOR_BASE}]
        }
    except Exception as e:
        print(f"Crash TopSitesRec: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def top_problemes_recurrents_data(df, annees, client, trimestre):
    try:
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return {"title": "Problèmes Récurrents (Vide)", "labels": [], "datasets": []}
        
        grouped = df_f.groupby("Famille de problème").size().sort_values(ascending=False).head(10)
        # Nettoyage des valeurs NaN éventuelles avant envoi
        labels = [str(l) if pd.notnull(l) else "" for l in grouped.index.tolist()]
        data = [int(v) if pd.notnull(v) else 0 for v in grouped.tolist()]
        
        return {
            "title": "Top Problèmes Récurrents",
            "labels": labels,
            "datasets": [{"label": "Occurrences", "data": data, "backgroundColor": COLOR_BASE}]
        }
    except Exception as e:
        print(f"Crash top_problemes: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

def IncidentResGTR_data(df, annees, client, trimestre):
    try:
        options = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange', 'Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
        
        mois_sel = _get_selected_months(trimestre)
        if not isinstance(annees, list): annees = [annees]
        annees_int = [int(a) for a in annees if str(a).isdigit()]
        
        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin(annees_int)) & 
                  (df["Month_clos"].isin(mois_sel))].copy()
                  
        if df_f.empty: return []

        cond = (df_f["Criticité"] == "Bloquant") & (df_f["Durée de traitement (mn) OCEANE"] > 240) & (~df_f['Famille de problème'].isin(options))
        df_f['GTR'] = np.select([cond], ["NOK"], default="OK")
        
        filtered = df_f[df_f["GTR"] == "NOK"].copy()
        filtered["Description"] = filtered["Description"].fillna("Aucune description").astype(str)
        filtered["Action de résolution"] = filtered["Action de résolution"].fillna("Non renseigné").astype(str)
        filtered["Remarque"] = ""
        
        cols = ["N° ticket", "Description", "Site Client", "Durée de traitement (mn) OCEANE", "Remarque"]
        return filtered[cols].replace({np.nan: None}).to_dict(orient="records")
    except Exception as e:
        print(f"Crash IncidentResGTR: {e}")
        return []

def render_chart_with_labels(chart_data, chart_type='bar'):
    if not chart_data or not chart_data.get('labels') or not chart_data.get('datasets'):
        plt.figure(figsize=(6, 4))
        plt.text(0.5, 0.5, "Aucune donnée disponible", ha='center', va='center')
        img = BytesIO()
        plt.savefig(img, format='png')
        plt.close()
        return img

    plt.figure(figsize=(12, 6))
    ax = plt.gca()
    
    if chart_type == 'bar':
        labels = chart_data['labels']
        x = np.arange(len(labels))
        datasets = chart_data['datasets']
        
        # Calcul de la largeur des barres selon le nombre d'années
        n_datasets = len(datasets)
        total_width = 0.6
        width = total_width / n_datasets
        
        for i, ds in enumerate(datasets):
            # Calcul de l'offset pour décaler les barres (ex: 2023 à gauche, 2024 à droite)
            offset = (i - (n_datasets - 1) / 2) * width
            
            clean_data = [int(v) if pd.notnull(v) else 0 for v in ds['data']]
            
            bars = ax.bar(x + offset, clean_data, width, 
                          label=ds.get('label', ''), 
                          color=ds.get('backgroundColor', COLOR_BASE))
            
            ax.bar_label(bars, padding=3, fontsize=8, fmt='%d', fontweight='bold')
        
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha='right')
        ax.yaxis.set_major_locator(MaxNLocator(integer=True))
        # Légende unique pour éviter les doublons au sein du graphique
        handles, labels = ax.get_legend_handles_labels()
        unique = [(h, l) for i, (h, l) in enumerate(zip(handles, labels)) if l not in labels[:i]]
        ax.legend(*zip(*unique)) 

    elif chart_type == 'pie':
        # ... (votre code pie reste identique)
        ds = chart_data['datasets'][0]
        ax.pie(ds['data'], labels=chart_data['labels'], autopct='%1.1f%%', 
               colors=ds['backgroundColor'], startangle=140)

    plt.title(chart_data['title'], color=COLOR_BASE, fontweight='bold', pad=20)
    plt.tight_layout()
    
    img = BytesIO()
    plt.savefig(img, format='png', dpi=150)
    plt.close()
    return img
