import os
import re
import unicodedata
import json
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql import types as T

# --- CONFIGURATION ---
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "excel-data-spark")
POSTGRES_URL = os.getenv("POSTGRES_URL", "jdbc:postgresql://postgres:5432/brise_db")
POSTGRES_TABLE = os.getenv("POSTGRES_TABLE", "donnees_excel")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "tam_db")
CHECKPOINT_DIR = "/opt/spark/work-dir/checkpoint_kafka_json"

# --- 1. SCHÉMA STRICT ---
schema_cols = T.StructType([
    T.StructField("numero_ticket", T.StringType(), True),
    T.StructField("etat", T.StringType(), True),
    T.StructField("date_debut_ticket", T.StringType(), True),
    T.StructField("date_creation", T.StringType(), True),
    T.StructField("date_retablissement", T.StringType(), True),
    T.StructField("date_cloture", T.StringType(), True),
    T.StructField("description", T.StringType(), True),
    T.StructField("id", T.StringType(), True),
    T.StructField("client", T.StringType(), True),
    T.StructField("site_client", T.StringType(), True),
    T.StructField("categ", T.StringType(), True),
    T.StructField("criticite", T.StringType(), True),
    T.StructField("week_creation", T.StringType(), True),
    T.StructField("year_creation", T.StringType(), True),
    T.StructField("week_cloture", T.StringType(), True),
    T.StructField("year_cloture", T.StringType(), True),
    T.StructField("service", T.StringType(), True),
    T.StructField("detail_service", T.StringType(), True),
    T.StructField("niveau_resolution", T.StringType(), True),
    T.StructField("duree_traitement_mn_oceane", T.StringType(), True),
    T.StructField("duree_traitement_mn_global", T.StringType(), True),
    T.StructField("duree_retablissement_mn", T.StringType(), True),
    T.StructField("duree_gel_mn", T.StringType(), True),
    T.StructField("gtr_respectee", T.StringType(), True),
    T.StructField("cause_retard_gtr", T.StringType(), True),
    T.StructField("action_resolution", T.StringType(), True),
    T.StructField("famille_probleme", T.StringType(), True),
    T.StructField("detail_probleme", T.StringType(), True),
    T.StructField("acces_last_mile", T.StringType(), True),
    T.StructField("rsp", T.StringType(), True),
    T.StructField("site_client_corresp_local_2", T.StringType(), True),
    T.StructField("dms", T.StringType(), True),
    T.StructField("type_produit", T.StringType(), True),
    T.StructField("type_ticket", T.StringType(), True),
    T.StructField("engagement", T.StringType(), True),
    T.StructField("source_file", T.StringType(), True),
    T.StructField("ingestion_timestamp", T.StringType(), True)
])

# --- 2. FONCTIONS DE NORMALISATION ---
def normalize_column_name(name: str) -> str:
    if not name: return ""
    n = unicodedata.normalize("NFKD", str(name))
    n = "".join(ch for ch in n if unicodedata.category(ch) != "Mn")
    n = n.replace("°", "o").replace("N o", "numero").replace("no", "numero")
    n = re.sub(r"[^a-zA-Z0-9]+", "_", n)
    n = n.lower()
    n = n.replace("_de_", "_").replace("_du_", "_").replace("_d_", "_")
    
    return n.strip("_")

def normalize_payload_to_json(raw_json_str: str) -> str: 
    if not raw_json_str: return None
    try:
        payload = json.loads(raw_json_str)
        normalized = {}
        for k, v in payload.items():
            key = normalize_column_name(k)
            # Correction de mapping : On cherche spécifiquement le NUMÉRO
            if ("ticket" in key and any(x in key for x in ["numero", "no", "num"])) or key == "id_ticket":
                key = "numero_ticket"
            normalized[key] = str(v) if v is not None else None
        return json.dumps(normalized)
    except:
        return None

normalize_udf = F.udf(normalize_payload_to_json, T.StringType())

def parse_timestamp(raw_col: F.Column) -> F.Column:
    return F.coalesce(
        F.to_timestamp(raw_col, "yyyy-MM-dd'T'HH:mm:ss"),
        F.to_timestamp(raw_col, "yyyy-MM-dd HH:mm:ss"),
        F.to_timestamp(raw_col)
    )

# --- 3. SESSION ET INITIALISATION TABLE ---
spark = SparkSession.builder.appName("KafkaToPostgresSafe") \
    .config("spark.sql.shuffle.partitions", "2") \
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0,org.postgresql:postgresql:42.7.2") \
    .getOrCreate()

'''def initialize_postgres_table():
    """Crée la table avec PRIMARY KEY automatiquement"""
    create_sql = f"""
    CREATE TABLE IF NOT EXISTS {POSTGRES_TABLE} (
        numero_ticket VARCHAR(255) PRIMARY KEY,
        etat VARCHAR(100),
        date_debut_ticket TIMESTAMP,
        date_creation TIMESTAMP,
        date_retablissement TIMESTAMP,
        date_cloture TIMESTAMP,
        description TEXT,
        id VARCHAR(100),
        client VARCHAR(255),
        site_client VARCHAR(255),
        categ VARCHAR(100),
        criticite VARCHAR(50),
        week_creation INTEGER,
        year_creation INTEGER,
        week_cloture INTEGER,
        year_cloture INTEGER,
        service VARCHAR(255),
        detail_service VARCHAR(255),
        niveau_resolution VARCHAR(100),
        duree_traitement_mn_oceane DOUBLE PRECISION,
        duree_traitement_mn_global DOUBLE PRECISION,
        duree_retablissement_mn DOUBLE PRECISION,
        duree_gel_mn DOUBLE PRECISION,
        gtr_respectee VARCHAR(50),
        cause_retard_gtr TEXT,
        action_resolution TEXT,
        famille_probleme VARCHAR(255),
        detail_probleme TEXT,
        acces_last_mile VARCHAR(255),
        rsp VARCHAR(255),
        site_client_corresp_local_2 VARCHAR(255),
        dms VARCHAR(255),
        type_produit VARCHAR(255),
        type_ticket VARCHAR(100),
        engagement VARCHAR(255),
        source_file VARCHAR(255),
        ingestion_timestamp TIMESTAMP
    );
    """
    try:
        conn = spark._jvm.java.sql.DriverManager.getConnection(POSTGRES_URL, POSTGRES_USER, POSTGRES_PASSWORD)
        stmt = conn.createStatement()
        stmt.execute(create_sql)
        stmt.close()
        conn.close()
        print("🚀 Table PostgreSQL initialisée avec succès.")
    except Exception as e:
        print(f"⚠️ Erreur initialisation table: {e}")

initialize_postgres_table()'''

# --- 4. LECTURE ---
kafka_stream = spark.readStream.format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS) \
    .option("subscribe", KAFKA_TOPIC) \
    .option("startingOffsets", "earliest") \
    .option("failOnDataLoss", "false") \
    .load()

# --- 5. TRANSFORMATION ---
json_df = kafka_stream.select(
    normalize_udf(F.col("value").cast("string")).alias("json_payload")
).select(
    F.from_json(F.col("json_payload"), schema_cols).alias("data")
).select("data.*")


# Application du filtre "Clos" et nettoyage
final_df = json_df.filter(F.trim(F.col("etat")) == "Clos").select(
    "numero_ticket", 
    "etat",
    parse_timestamp("date_debut_ticket").alias("date_debut_ticket"),
    parse_timestamp("date_creation").alias("date_creation"),
    parse_timestamp("date_retablissement").alias("date_retablissement"),
    parse_timestamp("date_cloture").alias("date_cloture"),
    "description", "id", "client", "site_client", "categ", "criticite",
    F.col("week_creation").cast("int"), F.col("year_creation").cast("int"),
    F.col("week_cloture").cast("int"), F.col("year_cloture").cast("int"),
    "service", "detail_service", "niveau_resolution",
    F.col("duree_traitement_mn_oceane").cast("double"),
    F.col("duree_traitement_mn_global").cast("double"),
    F.col("duree_retablissement_mn").cast("double"),
    F.col("duree_gel_mn").cast("double"),
    # Gestion GTR : On normalise en chaîne de caractères
    F.col("gtr_respectee").cast("integer").alias("gtr_respectee"),
    "cause_retard_gtr", "action_resolution",
    "famille_probleme", "detail_probleme", "acces_last_mile", "rsp",
    "site_client_corresp_local_2", parse_timestamp("dms").alias("dms"), "type_produit", "type_ticket",
    "engagement", "source_file",
    F.current_timestamp().alias("ingestion_timestamp") # Utilise l'heure actuelle de Spark
)

# --- 6. ÉCRITURE JDBC AVEC GESTION DES DOUBLONS ---
'''def write_to_postgres(batch_df, batch_id):
    batch_df.cache()
    # On retire les doublons au sein du batch lui-même
    clean_df = batch_df.filter(F.col("numero_ticket").isNotNull()).dropDuplicates(["numero_ticket"])
    count = clean_df.count()

    if count > 0:
        staging_table = f"staging_batch_{batch_id}"
        try:
            print(f"📦 Batch {batch_id}: Traitement de {count} lignes...")
            
            # Écriture dans une table temporaire staging
            clean_df.write \
                .mode("overwrite") \
                .jdbc(url=POSTGRES_URL, table=staging_table, 
                      properties={"user": POSTGRES_USER, "password": POSTGRES_PASSWORD, "driver": "org.postgresql.Driver"})

            # Fusion vers la table principale (ON CONFLICT DO NOTHING)
            conn = spark._jvm.java.sql.DriverManager.getConnection(POSTGRES_URL, POSTGRES_USER, POSTGRES_PASSWORD)
            stmt = conn.createStatement()
            upsert_sql = f"""
                INSERT INTO {POSTGRES_TABLE} 
                SELECT * FROM {staging_table}
                ON CONFLICT (numero_ticket) DO NOTHING;
            """
            stmt.execute(upsert_sql)
            stmt.execute(f"DROP TABLE IF EXISTS {staging_table}")
            stmt.close()
            conn.close()
            print(f"✅ Batch {batch_id} terminé.")
        except Exception as e:
            print(f"❌ Erreur Batch {batch_id}: {e}")

    batch_df.unpersist()'''
def write_to_postgres(batch_df, batch_id):
    batch_df.cache()
    # AFFICHER LES DONNÉES DANS LES LOGS POUR DEBUGGER
    print(f"--- DEBUG BATCH {batch_id} ---")
    batch_df.show(5)

    clean_df = batch_df.filter(F.col("numero_ticket").isNotNull()).dropDuplicates(["numero_ticket"])
    count = clean_df.count()

    if count > 0:
        # On force le nom de la table en minuscules et dans le schéma public
        staging_table = f"public.staging_batch_{batch_id}"
        
        try:
            print(f"📦 Batch {batch_id}: Traitement de {count} lignes...")
            
            # 2. Écriture JDBC par Spark (On utilise 'overwrite' pour créer/remplacer la table)
            # On ajoute l'option 'truncate' pour plus de performance si la table existait
            clean_df.write \
                .format("jdbc") \
                .option("url", POSTGRES_URL) \
                .option("dbtable", staging_table) \
                .option("user", POSTGRES_USER) \
                .option("password", POSTGRES_PASSWORD) \
                .option("driver", "org.postgresql.Driver") \
                .mode("overwrite") \
                .save()

            # 3. Connexion manuelle pour l'Upsert
            conn = spark._jvm.java.sql.DriverManager.getConnection(POSTGRES_URL, POSTGRES_USER, POSTGRES_PASSWORD)
            conn.setAutoCommit(False) # On utilise une transaction
            
            try:
                stmt = conn.createStatement()
                
                # Préparation des colonnes
                all_cols = clean_df.columns
                # On entoure les noms de colonnes par des guillemets pour éviter les erreurs SQL (ex: "Date début")
                col_list = ", ".join([f'"{c}"' for c in all_cols])
                update_set = ", ".join([f'"{c}" = EXCLUDED."{c}"' for c in all_cols if c != "numero_ticket"])

                # Requête UPSERT
                upsert_sql = f"""
                    INSERT INTO public.{POSTGRES_TABLE} ({col_list})
                    SELECT {col_list} FROM {staging_table}
                    ON CONFLICT (numero_ticket) 
                    DO UPDATE SET {update_set};
                """
                
                stmt.execute(upsert_sql)
                
                # 4. Nettoyage : suppression de la table temporaire
                stmt.execute(f"DROP TABLE IF EXISTS {staging_table}")
                
                conn.commit()
                print(f"✅ Batch {batch_id} inséré avec succès.")
            except Exception as sql_e:
                conn.rollback()
                print(f"❌ Erreur SQL lors de l'Upsert: {sql_e}")
                raise sql_e
            finally:
                stmt.close()
                conn.close()
                
        except Exception as e:
            print(f"❌ Erreur générale Batch {batch_id}: {e}")
    else:
        print(f"⚠️ Batch {batch_id} vide, aucune donnée à insérer.")
    batch_df.unpersist()

# Lancement
query = final_df.writeStream.foreachBatch(write_to_postgres) \
    .option("checkpointLocation", CHECKPOINT_DIR) \
    .start()

query.awaitTermination()