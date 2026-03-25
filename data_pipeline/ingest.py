import datetime
import email
import imaplib
import io
import json
import os
import time
import boto3
import numpy as np
import pandas as pd
from botocore.client import Config
from dotenv import load_dotenv
from kafka import KafkaProducer

load_dotenv()

# --- CONFIGURATION ---
KAFKA_SERVER = os.getenv("KAFKA_SERVER", "kafka:29092")
KAFKA_TOPIC1 = os.getenv("KAFKA_TOPIC1", "excel-data-spark")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "raw-archive")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")

IMAP_SERVER = os.getenv("IMAP_SERVER")
EMAIL_LOGIN = os.getenv("EMAIL")
PASSWORD_LOGIN = os.getenv("PASSWORD")
POLL_SECONDS = int(os.getenv("POLL_SECONDS", "10"))

# --- CLIENT MINIO (S3) ---
s3_client = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)

def json_serial(obj):
    if isinstance(obj, (datetime.datetime, datetime.date, pd.Timestamp)):
        return obj.isoformat()
    if isinstance(obj, (np.integer, np.int64)): return int(obj)
    if isinstance(obj, (np.floating, np.float64)): return float(obj)
    if isinstance(obj, np.ndarray): return obj.tolist()
    raise TypeError(f"Type non supporté : {type(obj)}")

# --- PRODUCER KAFKA ---
def connect_kafka():
    """Tente de se connecter à Kafka en boucle jusqu'à succès"""
    while True:
        try:
            print(f"[Kafka] Tentative de connexion sur {KAFKA_SERVER}...")
            p = KafkaProducer(
                bootstrap_servers=[KAFKA_SERVER],
                value_serializer=lambda v: json.dumps(v, default=json_serial, ensure_ascii=False).encode("utf-8"),
                batch_size=16384,
                linger_ms=10,
                api_version=(2, 0, 2)
            )
            print("[Kafka] Connecté avec succès !")
            return p
        except NoBrokersAvailable:
            print("[Kafka] Broker non disponible. Nouvelle tentative dans 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"[Kafka] Erreur inattendue : {e}. Nouvelle tentative dans 5s...")
            time.sleep(5)

def upload_to_minio(filename, content):
    """Archive le fichier brut dans MinIO"""
    try:
        # Création d'un nom unique avec timestamp pour éviter d'écraser les fichiers
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        
        s3_client.put_object(
            Bucket=MINIO_BUCKET,
            Key=unique_filename,
            Body=content
        )
        print(f"[MinIO] Fichier archivé avec succès : {unique_filename}")
        return unique_filename
    except Exception as e:
        print(f"[MinIO ERROR] Impossible d'archiver {filename} : {e}")
        return None

def process_excel_to_kafka(filename, content, minio_path=None):
    """Lit l'Excel et envoie les lignes à Kafka (Sans normalisation externe)"""
    try:
        # Lecture brute du fichier sans header fixe
        raw_df = pd.read_excel(io.BytesIO(content), header=None)
        
        # 1. Trouver l'en-tête dynamiquement (cherche la ligne avec 'ticket' ou 'etat')
        header_row_index = None
        for i, row in raw_df.iterrows(): 
            row_values = [str(val).lower() for val in row.values if pd.notnull(val)]
            if any("ticket" in v for v in row_values) or any("etat" in v for v in row_values):
                header_row_index = i
                break
        
        if header_row_index is None:
            print(f"[ERROR] Aucun en-tête trouvé dans {filename}.")
            return

        # 2. Préparation des colonnes et GESTION DES DOUBLONS
        # (Indispensable pour éviter l'erreur "DataFrame columns are not unique")
        raw_cols = raw_df.iloc[header_row_index].values
        temp_cols = [str(c).strip() if pd.notnull(c) and str(c).strip() != "" else f"__empty_{i}__" for i, c in enumerate(raw_cols)]
        
        final_cols = []
        counts = {}
        for col in temp_cols:
            if col in counts:
                counts[col] += 1
                final_cols.append(f"{col}_{counts[col]}")
            else:
                counts[col] = 0
                final_cols.append(col)

        # 3. Création du DataFrame de données propre
        data_df = raw_df.iloc[header_row_index + 1:].copy()
        data_df.columns = final_cols
        
        # Supprimer les lignes entièrement vides et remplacer NaN par None (pour JSON)
        data_df = data_df.dropna(how='all').where(pd.notnull(data_df), None)

        # 4. Préparation des métadonnées
        metadata = {
            "source_file": filename,
            "minio_archive_path": minio_path,
            "ingestion_timestamp": datetime.datetime.now().isoformat(),
        }

        # 5. Conversion en dictionnaire et envoi
        records = data_df.to_dict(orient="records")
        sent_count = 0
        
        for record in records:
            # On retire les colonnes vides du message final
            clean_record = {k: v for k, v in record.items() if not str(k).startswith("__empty_")}
            
            # Identifier la clé du ticket dynamiquement
            ticket_key = next((k for k in clean_record.keys() if "ticket" in str(k).lower()), None)
            
            if ticket_key and clean_record[ticket_key]:
                message = {**clean_record, **metadata}
                producer.send(KAFKA_TOPIC1, message)
                sent_count += 1

        producer.flush()
        print(f"[Kafka] {sent_count} lignes envoyées depuis {filename}")

    except Exception as exc:
        print(f"[ERROR] Erreur de traitement Excel {filename} : {exc}")
        
def process_email(mail_conn, email_id):
    """Extrait les pièces jointes, les archive dans MinIO et les envoie à Kafka"""
    status, msg_data = mail_conn.fetch(email_id, "(RFC822)")
    if status != "OK": return

    for response_part in msg_data:
        if not isinstance(response_part, tuple): continue

        msg = email.message_from_bytes(response_part[1])
        for part in msg.walk():
            if part.get_content_disposition() != "attachment": continue

            filename = part.get_filename()
            if filename and filename.lower().endswith((".xlsx", ".xls")):
                content = part.get_payload(decode=True)
                
                # --- ÉTAPE MINIO : ARCHIVAGE ---
                minio_path = upload_to_minio(filename, content)
                
                # --- ÉTAPE KAFKA : TRAITEMENT ---
                process_excel_to_kafka(filename, content, minio_path)

    # Marquer comme lu
    mail_conn.store(email_id, "+FLAGS", "\\Seen")

def ensure_bucket_exists():
    try:
        s3_client.head_bucket(Bucket=MINIO_BUCKET)
    except Exception:
        print(f"[MinIO] Création du bucket {MINIO_BUCKET}...")
        s3_client.create_bucket(Bucket=MINIO_BUCKET)

def listen_forever():
    print("[Ingest] En attente d'emails avec pièces jointes Excel...")
    while True:
        try:
            mail = imaplib.IMAP4_SSL(IMAP_SERVER, 993)
            mail.login(EMAIL_LOGIN, PASSWORD_LOGIN)

            while True:
                mail.select("inbox")
                status, messages = mail.search(None, "UNSEEN")
                if status == "OK" and messages and messages[0]:
                    for email_id in messages[0].split():
                        process_email(mail, email_id)

                time.sleep(POLL_SECONDS)
        except Exception as exc:
            print(f"[ERROR] {exc}. Reconnexion dans {POLL_SECONDS}s...")
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    ensure_bucket_exists()
    producer = connect_kafka()
    listen_forever()