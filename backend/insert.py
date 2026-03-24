import logging
import pandas as pd
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

def insert_excel_into_db():
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    folder = 'fichiers_reçus'
    
    column_mapping = {
        'N° ticket': 'numero_ticket',
        'Etat': 'etat',
        'Date début ticket': 'date_debut_ticket',
        'Date création': 'date_creation',
        'Date rétablissement': 'date_retablissement',
        'Date clôture': 'date_cloture',
        'Description': 'description',
        'ID': 'id',
        'Client': 'client',
        'Site Client': 'site_client',
        'Catég': 'categ',
        'Criticité': 'criticite',
        'Week Creation': 'week_creation',
        'Year Creation': 'year_creation',
        'Week Cloture': 'week_cloture',
        'Year Cloture': 'year_cloture',
        'Service': 'service',
        'Détail Service': 'detail_service',
        'Niveau Résolution': 'niveau_resolution',
        'Durée de traitement (mn) OCEANE': 'duree_traitement_mn_oceane',
        'Durée de traitement (mn) GLOBAL': 'duree_traitement_mn_global',
        'Durée de rétablissement (mn)': 'duree_retablissement_mn',
        'Durée gel (mn)': 'duree_gel_mn',
        'GTR respectée ?': 'gtr_respectee',
        'Cause Retard GTR': 'cause_retard_gtr',
        'Action de résolution': 'action_resolution',
        'Famille de problème': 'famille_probleme',
        'Détail problème': 'detail_probleme',
        'Acces Last Mile': 'acces_last_mile',
        'RSP': 'rsp',
        'Site client corresp. local 2': 'site_client_corresp_local_2',
        'DMS': 'dms',
        'Type produit': 'type_produit',
        'Type ticket': 'type_ticket',
        'Engagement': 'engagement'
    }

    if not os.path.exists(folder):
        print(f"Le dossier {folder} n'existe pas.")
        return

    for filename in os.listdir(folder):
        if filename.endswith('.xlsx'):
            path = os.path.join(folder, filename)
            try:
                # 1. Lecture (on commence à la ligne 4 car header=3)
                df = pd.read_excel(path, engine='openpyxl', header=3)
                
                # 2. Nettoyage de base
                df.dropna(how='all', inplace=True)
                df.rename(columns=column_mapping, inplace=True)
                
                # 3. FILTRE : Uniquement les tickets "Clos"
                # On utilise .str.strip() pour éviter les erreurs d'espaces invisibles
                if 'etat' in df.columns:
                    df = df[df['etat'].astype(str).str.strip() == 'Clos']
                
                if df.empty:
                    print(f"⚠️ Aucune donnée avec l'état 'Clos' dans {filename}. Passage au suivant.")
                    continue

                # 4. Sélection des colonnes valides
                valid_columns = [col for col in df.columns if col in column_mapping.values()]
                df = df[valid_columns]
                
                # 5. Dédoublonnage dans le fichier Excel lui-même (garder le plus récent)
                df = df.drop_duplicates(subset=['numero_ticket'], keep='last')
                
                # 6. Conversion des types pour PostgreSQL
                # Gérer les booléens/entiers pour gtr_respectee
                if 'gtr_respectee' in df.columns:
                    df['gtr_respectee'] = df['gtr_respectee'].fillna(0).replace({'Oui': 1, 'Non': 0}).astype(int)

                # S'assurer que numero_ticket est traité comme une chaîne pour la comparaison
                df['numero_ticket'] = df['numero_ticket'].astype(str)

                # 7. Insertion avec gestion de l'unicité (Upsert manuel via DELETE/INSERT)
                table_name = 'donnees_excel'
                with engine.begin() as conn:
                    # Liste des tickets à traiter
                    ticket_ids = df['numero_ticket'].tolist()
                    
                    # Supprimer les versions existantes de ces tickets pour éviter la violation de contrainte UNIQUE
                    delete_query = text(f"DELETE FROM {table_name} WHERE numero_ticket IN :tickets")
                    conn.execute(delete_query, {"tickets": tuple(ticket_ids)})
    
                    # Insertion des nouvelles données
                    df.to_sql(table_name, con=conn, if_exists='append', index=False, method='multi')
                
                print(f'✅ {len(df)} tickets "Clos" insérés/mis à jour depuis {filename}')
                
            except Exception as e:
                print(f'❌ Erreur avec le fichier {filename}: {str(e)}')
    
if __name__ == "__main__":
    insert_excel_into_db()