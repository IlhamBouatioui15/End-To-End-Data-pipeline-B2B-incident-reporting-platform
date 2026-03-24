import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator
import numpy as np
from sqlalchemy import create_engine
from io import BytesIO
import traceback
import os
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL")
engine = create_engine(database_url)

# ==========================================
# CONSTANTES ET CHARTE GRAPHIQUE
# ==========================================
COLOR_BASE = "#FF7A01"
PALETTE_5 = ["#FF7A01", "#FF9F40", "#BF5C00", "#2D2D2D", "#7A7A7A"]
RESP_COLORS = {'Orange': '#FF7A01', 'Client': '#2D2D2D', 'Autres': '#7A7A7A'}
CRIT_COLORS = {'Bloquant': '#BF5C00', 'Majeur': '#FF7A01', 'Mineur': '#FF9F40'}

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
        mois_sel = []
        for t in trimestre: mois_sel.extend(PERIODES_MAP.get(t, []))
        mois_sel = sorted(list(set(mois_sel)), key=lambda x: MOIS_REF.index(x))
        
        # Filtrage
        df_f = df[(df["Month_clos"].isin(mois_sel)) & 
                  (df["Type ticket"] == "Incident") & 
                  (df["Client"] == client)].copy()
        
        datasets = []
        if df_f.empty:
            for i, a in enumerate(annees):
                datasets.append({"label": str(a), "data": [0]*len(mois_sel), "backgroundColor": PALETTE_5[i%5]})
            return {"title": f"Évolution globale - {client}", "labels": mois_sel, "datasets": datasets}

        # Pivot table sécurisé (Lignes = Mois, Colonnes = Années)
        grouped = df_f.groupby(["Year Cloture", "Month_clos"]).size().unstack(level=0)
        
        for i, annee in enumerate(annees):
            target_year = int(annee)
            if target_year in grouped.columns:
                # Reindex pour garantir que TOUS les mois demandés sont présents même à 0
                data = grouped[target_year].reindex(mois_sel, fill_value=0).tolist()
            else:
                data = [0] * len(mois_sel)
            datasets.append({"label": str(annee), "data": data, "backgroundColor": PALETTE_5[i % 5]})
        
        return {"title": f"Évolution globale - {client}", "labels": mois_sel, "datasets": datasets}
    except Exception as e:
        print(f"Crash evolution_globale: {e}")
        traceback.print_exc()
        return {"title": "Erreur données", "labels": [], "datasets": []}

def evolution_criticite_data(df, annees, client, trimestre):
    try:
        mois_sel = []
        for t in trimestre: mois_sel.extend(PERIODES_MAP.get(t, []))
        mois_sel = sorted(list(set(mois_sel)), key=lambda x: MOIS_REF.index(x))
        
        # Labels axe X : "Janvier 2025"
        labels_x = [f"{m} {a}" for a in sorted(annees) for m in mois_sel]

        df_f = df[(df["Client"] == client) & 
                  (df["Type ticket"] == "Incident") &
                  (df["Year Cloture"].isin([int(a) for a in annees])) &
                  (df["Month_clos"].isin(mois_sel))].copy()

        if df_f.empty:
            return {"title": "Évolution par criticité", "labels": labels_x, "datasets": []}

        # Forcer le format String propre de l'année (pas de .0)
        df_f["M_A"] = df_f["Month_clos"].astype(str) + " " + df_f["Year Cloture"].astype(str)
        
        grouped = df_f.groupby(["M_A", "Criticité"]).size().unstack(fill_value=0)
        grouped = grouped.reindex(index=labels_x, fill_value=0)
        
        datasets = []
        for crit in ["Mineur", "Majeur", "Bloquant"]:
            data = grouped[crit].tolist() if crit in grouped.columns else [0] * len(labels_x)
            datasets.append({"label": crit, "data": data, "backgroundColor": CRIT_COLORS.get(crit, "#CCCCCC")})
        
        return {"title": "Évolution par criticité", "labels": labels_x, "datasets": datasets}
    except Exception as e:
        print(f"Crash evolution_criticite: {e}")
        return {"title": "Erreur données", "labels": [], "datasets": []}

def EvResp_data(df, annees, client, trimestre):
    try:
        options_client = ['Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
        options_autres = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange']
        
        mois_sel = []
        for t in trimestre: mois_sel.extend(PERIODES_MAP.get(t, []))
        mois_sel = sorted(list(set(mois_sel)), key=lambda x: MOIS_REF.index(x))
        labels_x = [f"{m} {a}" for a in sorted(annees) for m in mois_sel]

        df_f = df[(df["Client"] == client) & 
                  (df["Year Cloture"].isin([int(a) for a in annees])) & 
                  (df["Month_clos"].isin(mois_sel))].copy()

        if df_f.empty:
            return {"title": "Évolution responsabilités", "labels": labels_x, "datasets": []}

        df_f['Responsabilité'] = np.select(
            [df_f['Famille de problème'].isin(options_client), df_f['Famille de problème'].isin(options_autres)],
            ['Client', 'Autres'], default='Orange'
        )
        
        df_f["M_A"] = df_f["Month_clos"].astype(str) + " " + df_f["Year Cloture"].astype(str)
        
        grouped = df_f.groupby(["M_A", "Responsabilité"]).size().unstack(fill_value=0)
        grouped = grouped.reindex(index=labels_x, fill_value=0)
        
        datasets = []
        for res in ["Orange", "Client", "Autres"]:
            data = grouped[res].tolist() if res in grouped.columns else [0] * len(labels_x)
            datasets.append({"label": res, "data": data, "backgroundColor": RESP_COLORS.get(res, "#7A7A7A")})
                
        return {"title": "Évolution responsabilités", "labels": labels_x, "datasets": datasets}
    except Exception as e:
        print(f"Crash EvResp: {e}")
        return {"title": "Erreur", "labels": [], "datasets": []}

# ==========================================
# AUTRES FONCTIONS (RESTENT IDENTIQUES MAIS SÉCURISÉES)
# ==========================================

def distribution_criticite_data(df, annees, client, trimestre):
    # On prend la dernière année de la liste
    target_year = int(annees[-1])
    filtered = df[(df["Year Cloture"] == target_year) & (df["Client"] == client)]
    
    if filtered.empty:
        return {"title": "Distribution (Vide)", "labels": [], "datasets": []}
        
    grouped = filtered.groupby("Criticité").size()
    labels = grouped.index.tolist()
    return {
        "title": f"Distribution Criticité {target_year}",
        "labels": labels,
        "datasets": [{"data": grouped.tolist(), "backgroundColor": [CRIT_COLORS.get(l, COLOR_BASE) for l in labels]}]
    }

def DistResp_data(df, annees, client, trimestre):
    options_client = ['Aucune anomalie côté Orange : Configuration client', 'CLIENTS', 'Aucune anomalie côté Orange : Environnement client']
    options_autres = ['Aucune anomalie côté Orange : Assistance', 'Aucune anomalie côté Orange : Autres', 'Assistance', 'AUTRE', 'Hors Responsabilité Groupe Orange']
    
    df_f = df[df["Client"] == client].copy()
    if df_f.empty: return {"title": "Répartition (Vide)", "labels": [], "datasets": []}

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

def ServImpact_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client]
    if df_f.empty: return {"title": "Services Impactés (Vide)", "labels": [], "datasets": []}
    
    grouped = df_f.groupby('Service').size().sort_values(ascending=False).head(5)
    return {
        "title": "Top 5 Services Impactés",
        "labels": grouped.index.tolist(),
        "datasets": [{"data": grouped.tolist(), "backgroundColor": PALETTE_5}]
    }

def NivTait_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client]
    if df_f.empty: return {"title": "Niveaux Traitement (Vide)", "labels": [], "datasets": []}
    
    grouped = df_f.groupby('Niveau Résolution').size().sort_values(ascending=False).head(5)
    return {
        "title": "Niveaux de traitement",
        "labels": grouped.index.tolist(),
        "datasets": [{"data": grouped.tolist(), "backgroundColor": PALETTE_5}]
    }

def TauxResGTR_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client].copy()
    if df_f.empty: return {"title": "GTR (Vide)", "labels": [], "datasets": []}

    cond = (df_f["Criticité"] == "Bloquant") & (df_f["Durée de traitement (mn) OCEANE"] > 240)
    df_f['GTR'] = np.select([cond], ["NOK"], default="OK")
    
    grouped = df_f["GTR"].value_counts()
    return {
        "title": "Taux de respect GTR",
        "labels": grouped.index.tolist(),
        "datasets": [{"data": grouped.tolist(), "backgroundColor": [COLOR_BASE, "#2D2D2D"]}]
    }

def TopSitesRec_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client]
    if df_f.empty: return {"title": "Sites Récurrents (Vide)", "labels": [], "datasets": []}
    
    grouped = df_f.groupby("Site Client").size().sort_values(ascending=False).head(10)
    return {
        "title": "Top Sites Récurrents",
        "labels": grouped.index.tolist(),
        "datasets": [{"label": "Incidents", "data": grouped.tolist(), "backgroundColor": COLOR_BASE}]
    }

def top_problemes_recurrents_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client]
    if df_f.empty: return {"title": "Problèmes Récurrents (Vide)", "labels": [], "datasets": []}
    
    grouped = df_f.groupby("Famille de problème").size().sort_values(ascending=False).head(10)
    return {
        "title": "Top Problèmes Récurrents",
        "labels": grouped.index.tolist(),
        "datasets": [{"label": "Occurrences", "data": grouped.tolist(), "backgroundColor": COLOR_BASE}]
    }

def IncidentResGTR_data(df, annees, client, trimestre):
    df_f = df[df["Client"] == client].copy()
    if df_f.empty: return []

    cond = (df_f["Criticité"] == "Bloquant") & (df_f["Durée de traitement (mn) OCEANE"] > 240)
    df_f['GTR'] = np.select([cond], ["NOK"], default="OK")
    
    filtered = df_f[df_f["GTR"] == "NOK"].copy()
    filtered["Description"] = filtered["Description"].fillna("Aucune description").astype(str)
    filtered["Action de résolution"] = filtered["Action de résolution"].fillna("Non renseigné").astype(str)
    
    cols = ["N° ticket", "Description", "Site Client", "Durée de traitement (mn) OCEANE", "Action de résolution"]
    return filtered[cols].replace({np.nan: None}).to_dict(orient="records")

def render_chart_with_labels(chart_data, chart_type='bar'):
    if not chart_data or not chart_data.get('labels'):
        plt.figure(figsize=(6, 4))
        plt.text(0.5, 0.5, "Aucune donnée disponible", ha='center', va='center')
        img = BytesIO()
        plt.savefig(img, format='png')
        plt.close()
        return img

    plt.figure(figsize=(10, 6))
    ax = plt.gca()
    
    if chart_type == 'bar':
        # 1. Forcer l'axe Y à n'afficher que des ENTIERS
        ax.yaxis.set_major_locator(MaxNLocator(integer=True))
        
        x = np.arange(len(chart_data['labels']))
        for i, ds in enumerate(chart_data['datasets']):
            if ds.get('data'):
                # Nettoyage des données : conversion en entiers (remplace NaN par 0)
                clean_data = [int(x) if pd.notnull(x) else 0 for x in ds['data']]
                
                bars = ax.bar(x, clean_data, label=ds.get('label',''), color=ds['backgroundColor'])
                
                # 2. Affichage des chiffres au-dessus des barres SANS DÉCIMALES (fmt='%d')
                ax.bar_label(bars, padding=3, fontweight='bold', fontsize=9, fmt='%d')
        
        ax.set_xticks(x)
        ax.set_xticklabels(chart_data['labels'], rotation=45, ha='right')
        
    elif chart_type == 'pie':
        ds = chart_data['datasets'][0]
        if ds.get('data'):
            # Pour le camembert, on garde souvent 1 décimale pour le % 
            # mais on peut afficher le compte brut si vous préférez.
            # Ici on reste sur le pourcentage classique :
            wedges, texts, autotexts = ax.pie(
                ds['data'], labels=chart_data['labels'], autopct='%1.1f%%',
                colors=ds['backgroundColor'], startangle=140
            )
            plt.setp(autotexts, size=9, weight="bold", color="white")

    plt.title(chart_data['title'], color=COLOR_BASE, fontweight='bold', pad=20)
    plt.tight_layout()
    img = BytesIO()
    plt.savefig(img, format='png', dpi=150)
    plt.close()
    return img