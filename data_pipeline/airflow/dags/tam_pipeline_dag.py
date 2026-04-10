"""
DAG : tam_data_pipeline
=======================
Monitoring du pipeline de données TAM (Real-time & Health Checks)
"""

from datetime import datetime, timedelta
import time
import logging
import docker
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.email import EmailOperator

# ==============================================================
# CONFIGURATION PAR DÉFAUT
# ==============================================================
default_args = {
    "owner": "tam",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# ==========================================================
# FONCTIONS DE MONITORING (UTILISANT LE SDK DOCKER)
# ==========================================================

def monitor_container_strategy(container_name, process_pattern):
    """
    Vérifie si le conteneur et le script interne tournent.
    Si non, redémarre le conteneur.
    """
    client = docker.from_env()
    try:
        container = client.containers.get(container_name)
        
        # 1. Vérifie si le conteneur est "running"
        if container.status != "running":
            logging.warning(f"Container {container_name} is {container.status}. Restarting...")
            container.restart()
            time.sleep(15)
            container = client.containers.get(container_name)
            if container.status != "running":
                raise Exception(f"Failed to restart container {container_name}")

        # 2. Vérifie si le script interne tourne via pgrep
        # Note: 'pgrep -f pattern' retourne 0 si trouvé, 1 sinon.
        exit_code, output = container.exec_run(f"pgrep -f {process_pattern}")
        
        if exit_code != 0:
            logging.warning(f"Process {process_pattern} NOT found in {container_name}. Restarting container...")
            container.restart()
            time.sleep(20)
            # Vérification finale
            exit_code, output = container.exec_run(f"pgrep -f {process_pattern}")
            if exit_code != 0:
                raise Exception(f"Process {process_pattern} still not running after restart.")
        
        logging.info(f"SUCCESS: {container_name} and {process_pattern} are healthy.")
        return True
    except Exception as e:
        logging.error(f"Health check failed for {container_name}: {e}")
        raise

def dbt_exec_strategy(command):
    """Exécute une commande dbt dans le conteneur existant."""
    client = docker.from_env()
    try:
        container = client.containers.get("tam_dbt")
        logging.info(f"Executing dbt command: {command}")
        
        # On exécute dbt dans le bon répertoire
        cmd_to_run = f"bash -c 'cd /usr/app/tam_dbt && {command}'"
        result = container.exec_run(cmd_to_run)
        
        logging.info(result.output.decode())
        if result.exit_code != 0:
            raise Exception(f"dbt command failed with exit code {result.exit_code}")
        
        return True
    except Exception as e:
        logging.error(f"DBT Execution Error: {e}")
        raise

# ==============================================================
# DÉFINITION DU DAG
# ==============================================================
with DAG(
    dag_id="tam_data_pipeline",
    default_args=default_args,
    description="Pipeline TAM (Monitoring SDK) : Ingestion & Spark & dbt",
    schedule_interval="*/15 * * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["tam", "monitoring", "dbt", "sdk"],
) as dag:

    # 1. Vérification Postgres & Kafka
    check_services = PythonOperator(
        task_id="check_base_services",
        python_callable=lambda: [
            monitor_container_strategy("tam_dbpsql", "postgres"),
            monitor_container_strategy("tam_kafka", "kafka")
        ],
    )

    # 2. Monitoring Ingestion
    ingest_monitoring = PythonOperator(
        task_id="ingestion_monitoring",
        python_callable=monitor_container_strategy,
        op_args=["tam_pipeline_ingest", "ingest.py"],
    )

    # 3. Monitoring Spark
    spark_monitoring = PythonOperator(
        task_id="spark_monitoring",
        python_callable=monitor_container_strategy,
        op_args=["tam_pipeline_spark", "spark_processing.py"],
    )

    # ----------------------------------------------------------
    # 4. Orchestration dbt (construction du Data Warehouse)
    # ----------------------------------------------------------

    # 4a. Installe / met à jour les packages dbt (packages.yml)
    dbt_deps = PythonOperator(
        task_id="dbt_deps",
        python_callable=dbt_exec_strategy,
        op_args=["dbt deps"],
        execution_timeout=timedelta(minutes=1),  
        retries=0, 
    )

    # 4b. Charge les données de référence statiques (dossier seeds/)
    dbt_seed = PythonOperator(
        task_id="dbt_seed",
        python_callable=dbt_exec_strategy,
        op_args=["dbt seed --full-refresh"],
    )

    # 4c. Construit tous les modèles du DWH (staging → marts)
    dbt_run = PythonOperator(
        task_id="dbt_run",
        python_callable=dbt_exec_strategy,
        op_args=["dbt run"],
    )

    # 4d. Valide les tests (unicité, non-null, relations, custom)
    dbt_test = PythonOperator(
        task_id="dbt_test",
        python_callable=dbt_exec_strategy,
        op_args=["dbt test"],
    )

    # 5. Notifications
    send_email = EmailOperator(
        task_id="send_success_email",
        to="tamtest67@gmail.com",
        subject="Pipeline TAM (Monitoring) : OK",
        html_content="<p>Le monitoring a vérifié le pipeline avec succès.</p>",
    )

    # ==========================================================
    # DÉPENDANCES
    # ==========================================================
    check_services >> ingest_monitoring >> spark_monitoring >> dbt_deps >> dbt_seed >> dbt_run >> dbt_test >> send_email
