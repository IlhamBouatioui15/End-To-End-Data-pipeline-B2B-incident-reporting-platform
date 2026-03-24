 # auto_import.py
""""
from script import fetch_excel_from_email
from insert import insert_excel_into_db

if __name__ == "__main__":
    fetch_excel_from_email()
    insert_excel_into_db()
"""
# auto_import.py
from script import fetch_excel_from_email
from insert import insert_excel_into_db
import time
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auto_import.log'),
        logging.StreamHandler()
    ]
)

def main():
    while True:
        try:
            logging.info("Debut de la vérification des emails...")
            fetch_excel_from_email()
            
            logging.info("Debut de l'insertion des données dans la base...")
            insert_excel_into_db()
            
            logging.info("Operation terminée. Attente de 10 secondes avant la prochaine vérification...")
            time.sleep(10)
            
        except Exception as e:
            logging.error(f"Une erreur s'est produite: {str(e)}")
            logging.info("Nouvelle tentative dans 10 secondes...")
            time.sleep(10)

if __name__ == "__main__":
    logging.info("Démarrage du service d'import automatique...")
    main()
    