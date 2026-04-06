import os

# Clé secrète — doit matcher la variable d'env
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "d5fb956be07f6c6956199f8b7718be0524c55e218b2d92919d9ed3514f2bae24")

# Base de métadonnées Superset
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://superset:tam__db@superset-db:5432/superset_meta"
)

# Cache (simple pour dev)
CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
}

# Activer les fonctionnalités utiles
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
}

# Supprime cette ligne si elle existe
SUPERSET_WEBSERVER_PORT = 8088

# Row limit par défaut pour les requêtes
ROW_LIMIT = 10000