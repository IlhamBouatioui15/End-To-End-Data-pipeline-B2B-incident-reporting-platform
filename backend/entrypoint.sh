#!/bin/bash

# Entrypoint script for Docker backend container
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Initialisation du Backend TAM Application${NC}"
echo "=================================================="

# Function to wait for database
wait_for_db() {
    echo -e "${YELLOW}⏳ Attente de la base de données...${NC}"
    local max_attempts=30
    local attempt=1
    until pg_isready -h ${DB_HOST:-postgres} -U ${DB_USER:-postgres} > /dev/null 2>&1 || [ $attempt -eq $max_attempts ]; do
        echo "   Tentative $attempt/$max_attempts..."
        sleep 1
        attempt=$((attempt + 1))
    done
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}✗ Base de données non accessible après 30 secondes${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Base de données disponible${NC}"
}

# Check database connection
check_db_connection() {
    echo -e "${YELLOW}🔍 Vérification de la connexion à la BD...${NC}"
    if python3 << END
import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
try:
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError('DATABASE_URL not set')
    engine = create_engine(db_url)
    with engine.connect() as conn:
        import sqlalchemy
        # Compatibilité SQLAlchemy 1.4 et 2.0
        conn.execute(sqlalchemy.text("SELECT 1"))
    print("Connection successful")
except Exception as e:
    print(f"Connection failed: {e}")
    exit(1)
END
    then
        echo -e "${GREEN}✓ Connexion à la BD établie${NC}"
    else
        echo -e "${RED}✗ Échec de la connexion à la BD${NC}"
        exit 1
    fi
}

# Create database tables
create_tables() {
    echo -e "${YELLOW}📂 Création des tables...${NC}"
    # BIEN IMPORTER VOS MODELES ICI
    python3 -c "from database import Base, engine; import models; Base.metadata.create_all(bind=engine)"
    if python3 << END
from database import Base, engine
import models  # Assurez-vous que vos modèles sont importés pour être créés
try:
    Base.metadata.create_all(bind=engine)
    print("Tables created/updated successfully")
except Exception as e:
    print(f"Error creating tables: {e}")
    exit(1)
END
    then
        echo -e "${GREEN}✓ Tables créées/vérifiées${NC}"
    else
        echo -e "${YELLOW}⚠ Impossible de créer les tables automatiquement${NC}"
    fi
}

# --- NOUVELLE FONCTION AJOUTÉE ICI ---
init_admin_user() {
    local admin_script="/app/backend/init_admin.py"
    if [ -f "$admin_script" ]; then
        echo -e "${YELLOW}👤 Initialisation de l'administrateur...${NC}"
        if python3 "$admin_script"; then
            echo -e "${GREEN}✓ Administrateur vérifié/créé${NC}"
        else
            echo -e "${RED}⚠ Erreur lors de l'exécution de init_admin.py${NC}"
        fi
    else
        echo -e "${YELLOW}ℹ Script init_admin.py non trouvé dans /app/backend/${NC}"
    fi
}

#run_custom_init() {
#    local init_file="/app/backend/auto_import.py"
#   if [ -f "$init_file" ]; then
#        echo -e "${YELLOW}🔧 Lancement de l'importation automatique en arrière-plan...${NC}"       
#        # Le "&" à la fin lance le script en tâche de fond
#       # On peut aussi rediriger les logs vers un fichier ou les laisser dans la console
#       python3 "$init_file" & 
        
#        echo -e "${GREEN}✓ Importation automatique démarrée (exécution en cours)${NC}"
#    fi
#}

# Main execution
main() {
    cd /app/backend
    
    # Étape 1: Attendre la DB
    wait_for_db
    
    # Étape 2: Vérifier la connexion technique
    check_db_connection
    
    # Étape 3: Créer le schéma de la base
    create_tables
    
    # Étape 4: Créer l'admin (Appel de la nouvelle fonction)
    init_admin_user
    
    # Étape 5: Autres inits si besoin
    #run_custom_init
    
    # Étape 6: Démarrage
    echo -e "${YELLOW}🚀 Démarrage du serveur FastAPI...${NC}"
    echo "=================================================="
    echo ""
    
    exec uvicorn main:app --host 0.0.0.0 --port 8000
}

main