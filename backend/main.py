from email.mime.multipart import MIMEMultipart
import json
from typing import Annotated, List, Optional
from fastapi import BackgroundTasks, FastAPI, Depends, HTTPException, Request, status
from pathlib import Path as PathLibPath  # pour éviter le conflit
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import psycopg2
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import models
from models import Members, User
from database import SessionLocal, engine
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, Query,Form
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
# from rapp.Clients import  load_data_from_db,evolution_globale_data,evolution_criticite_data,distribution_criticite_data,EvResp_data,DistResp_data,ServImpact_data,NivTait_data,TauxResGTR_data,TopSitesRec_data,IncidentResGTR_data,top_problemes_recurrents_data
from rapp.Clients import load_data_from_db, evolution_globale_data, evolution_criticite_data, distribution_criticite_data, EvResp_data, DistResp_data, ServImpact_data, NivTait_data, TauxResGTR_data, TopSitesRec_data, IncidentResGTR_data, top_problemes_recurrents_data
import pandas as pd
import numpy as np
import io
from datetime import timedelta
from io import BytesIO
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from database import Base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine
from schemas import BulkModificationRequest
from schemas import ModificationRequest
from models import TicketModificationPending
import os
from dotenv import load_dotenv

load_dotenv()  # Charger les variables d'environnement depuis le fichier .env
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN")


from contextlib import asynccontextmanager
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

# Configuration simplifiée et robuste
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USERNAME"),
    MAIL_PASSWORD=os.getenv("SMTP_PASSWORD"),
    MAIL_FROM=os.getenv("SMTP_USERNAME"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)


def get_psycopg2_connection():
    if not DATABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not configured in environment variables"
        )
    return psycopg2.connect(DATABASE_URL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées/vérifiées au démarrage")
    yield
    # Shutdown
    pass

app = FastAPI(lifespan=lifespan)
origins = [
    "http://localhost:3000", 
    "http://localhost",
    "*" 
    
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows all origins from the list
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
templates = Jinja2Templates(directory="templates")

import smtplib
from email.mime.text import MIMEText

# Paramètres SMTP (exemple pour Gmail)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = os.getenv("SMTP_USERNAME")  # Votre adresse email
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Votre mot de passe d'application Gmail
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")  # Email de l'administrateur qui recevra les notifications


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Your JWT secret and algorithm
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class UserCreate(BaseModel):
    username: str
    password: str

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    return "complete"

@app.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    payload = verify_token.__wrapped__(token)  # contourner Depends() ici

    username = payload.get("sub")
    db_user = get_user_by_username(db, username=username)

    if not db_user or db_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")

    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return create_user(db=db, user=user)
# Authenticate the user



# Create access token

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire =datetime.now(timezone.utc)+ timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
    

@app.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Déplacer la logique d'authentication directement ici
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Dans login_for_access_token, ajoutez le rôle
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, # Ajoutez le rôle ici
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role} # Retournez-le aussi

def verify_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=403, detail="Token is invalid or expired")
        return payload
    except JWTError:
        raise HTTPException(status_code=403, detail="Token is invalid or expired")

# Helper function to check if user is admin
async def verify_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = verify_token(token)
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Vous n'avez pas les permissions pour accéder à cette ressource"
        )
    return user
 


@app.get("/verify-token/{token}")
async def verify_user_token(token: str):
    verify_token(token=token)
    return {"message": "Token is valid"}

class MembersBase(BaseModel):
     First_name :str
     Last_name :str
     Role :str
     Username:str
     password:str

class MembersModel(MembersBase):
    id: int 
    model_config = {"from_attributes": True}
    



db_dependency = Annotated[Session, Depends(get_db)]


@app.post("/Members/", response_model=MembersModel, response_model_exclude={"password"})
async def create_member(transaction: MembersBase, db: db_dependency, admin: User = Depends(verify_admin)):
    # Check if username already exists in Members table
    existing_member = db.query(models.Members).filter(models.Members.Username == transaction.Username).first()
    if existing_member:
        raise HTTPException(
            status_code=400,
            detail=f"Le username '{transaction.Username}' existe déjà dans la base de données"
        )
    
    # Check if username already exists in users table
    existing_user = db.query(User).filter(User.username == transaction.Username).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail=f"Le username '{transaction.Username}' est déjà utilisé par un utilisateur"
        )
    
    # Hash the password before saving to the database
    hashed = pwd_context.hash(transaction.password)
    
    # 1. Create the member record
    data = transaction.model_dump()
    data["password"] = hashed
    db_members = models.Members(**data)
    db.add(db_members)
    db.commit()
    db.refresh(db_members)
    
    # 2. Also create a user record so they can login
    # Map the French role names to correct values
    user_role = transaction.Role if transaction.Role in ["admin", "membre"] else "membre"
    db_user = User(username=transaction.Username, hashed_password=hashed, role=user_role)
    db.add(db_user)
    db.commit()
    
    return db_members


@app.get("/Members/", response_model=List[MembersModel], response_model_exclude={"password"})
async def read_members(db: db_dependency, skip: int=0, limit: int=100, admin: User = Depends(verify_admin)):
    members = db.query(models.Members).offset(skip).limit(limit).all()
    return members

@app.delete("/Members/{member_id}/", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db), admin: User = Depends(verify_admin)):
    member = db.query(Members).filter(Members.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    # Also delete the user account so they can't login anymore
    db_user = db.query(User).filter(User.username == member.Username).first()
    if db_user:
        db.delete(db_user)
    
    db.delete(member)
    db.commit()
    return {"message": "Membre supprimé avec succès"}


@app.put("/Members/{member_id}/", response_model=MembersModel, response_model_exclude={"password"})
async def update_member(member_id: int, updated_member: MembersBase, db: db_dependency, admin: User = Depends(verify_admin)):
    db_member = db.query(models.Members).filter(models.Members.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    # Mise à jour des champs
    update_data = updated_member.model_dump(exclude_unset=True)
    old_username = db_member.Username
    
    # Si mot de passe envoyé, le hacher
    if "password" in update_data:
        hashed_password = pwd_context.hash(update_data["password"])
        update_data["password"] = hashed_password
        
        # Update the user password too
        db_user = db.query(User).filter(User.username == old_username).first()
        if db_user:
            db_user.hashed_password = hashed_password
    
    # If username changed, update user account too
    if "Username" in update_data and update_data["Username"] != old_username:
        db_user = db.query(User).filter(User.username == old_username).first()
        if db_user:
            # Check if new username doesn't already exist
            existing = db.query(User).filter(User.username == update_data["Username"]).first()
            if not existing:
                db_user.username = update_data["Username"]
    
    for key, value in update_data.items():
        setattr(db_member, key, value)
    
    db.commit()
    db.refresh(db_member)
    return db_member


@app.get("/graph/{graph_type}")
async def generate_graph_from_db(
    graph_type: str,
    client: str,
    annees: List[int] = Query(..., alias="annees[]"),
    trimestre: Optional[List[str]] = Query(None, alias="trimestre[]")
):
    """Endpoint principal pour générer les graphiques à partir de la base de données"""
    try:
        if not annees:
            raise HTTPException(status_code=400, detail="Vous devez sélectionner au moins une année")

        # Chargement des données depuis la base
        if not trimestre:
            trimestre = ["Annee"]

        df = load_data_from_db(client=client, annees=annees)
        if df.empty:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée pour les critères sélectionnés")

        # Dictionnaire des fonctions de graphique (identique à votre version)
        graph_functions = {
            'evolution_globale_data': evolution_globale_data,
            'evolution_criticite_data': evolution_criticite_data,
            'distribution_criticite_data': distribution_criticite_data,
            'EvResp_data': EvResp_data,
            'DistResp_data': DistResp_data,
            'ServImpact_data': ServImpact_data,
            'NivTait_data': NivTait_data,
            'TauxResGTR_data': TauxResGTR_data,
            'IncidentResGTR_data': IncidentResGTR_data,
            'TopSitesRec_data': TopSitesRec_data,
            'top_problemes_recurrents_data': top_problemes_recurrents_data
        }
        
        if graph_type not in graph_functions:
            raise HTTPException(status_code=404, detail="Type de graphique non trouvé")
        
        # Appel de la fonction pour récupérer les données JSON
        data = graph_functions[graph_type](
            df=df,
            annees=annees,
            client=client,
            trimestre=trimestre
        )

        return JSONResponse(content=data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
@app.get("/get-years")
def get_years():
    try:
        df = pd.read_sql('SELECT DISTINCT "year_cloture" FROM donnees_excel', engine)
        years = sorted(df["year_cloture"].dropna().astype(int).tolist())
        return {"years": years}
    except Exception as e:
        print(f"Erreur dans /get-years: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des années")

@app.get("/get-clients")
def get_clients():
    try:
        df = pd.read_sql('SELECT DISTINCT "client" FROM donnees_excel', engine)
        clients = sorted(df["client"].dropna().tolist())
        return clients
    except Exception as e:
        print(f"Erreur dans /get-clients: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la récupération des clients")

@app.get("/raw-data")
def get_filtered_data(
    client: Optional[str] = None,
    annees: Optional[List[int]] = Query(None, alias="annees[]"),
    trimestre: Optional[List[str]] = Query(None, alias="trimestre[]")
):
    try:
        query = 'SELECT * FROM donnees_excel WHERE 1=1'
        params = []
        if client:
            query += ' AND client = %s'
            params.append(client)
        if annees:
            placeholders = ','.join(['%s'] * len(annees))
            query += f' AND year_cloture IN ({placeholders})'
            params.extend(annees)
        
        df = pd.read_sql(query, engine, params=tuple(params))
        
        if df.empty:
            return {"data": [], "columns": []}
        
        if "date_cloture" in df.columns:
            df["date_cloture"] = pd.to_datetime(df['date_cloture'], errors='coerce')
            df['year_cloture'] = df['date_cloture'].dt.year
            
            # Dictionnaire de correspondance des mois
            mois_fr = {
                1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
                5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
                9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
            }
            
            # Création de la colonne en utilisant le numéro du mois (1 à 12)
            df['Month_clos'] = df['date_cloture'].dt.month.map(mois_fr)
            
            # Transformation en Catégorie pour garder l'ordre chronologique
            df['Month_clos'] = pd.Categorical(
                df['Month_clos'],
                categories=["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
                ordered=True
            )
        
        if trimestre and not df.empty and "Month_clos" in df.columns:
            mapping_periodes = {
                "T1": ["Janvier", "Février", "Mars"], "T2": ["Avril", "Mai", "Juin"],
                "T3": ["Juillet", "Août", "Septembre"], "T4": ["Octobre", "Novembre", "Décembre"],
                "S1": ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin"],
                "S2": ["Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
                "Année": ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                          "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

            }
            mois = []
            for t in trimestre: mois.extend(mapping_periodes.get(t, []))
            df = df[df["Month_clos"].isin(mois)]

        # NETTOYAGE CRUCIAL : Remplace NaN par None pour le JSON
        df = df.replace({np.nan: None}).where(pd.notnull(df), None)
        
        return {"data": df.to_dict(orient="records"), "columns": list(df.columns)}
    except Exception as e:
        print(f"Erreur /raw-data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- MODIFICATION DE LA ROUTE ENREGISTRER-MODIFICATION (Admin direct vs Membre pending) ---
@app.post("/enregistrer-modification")
async def save_modifications(
    data: BulkModificationRequest, 
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme) # Obligatoire pour identifier l'admin
):
    conn = None
    try:
        # 1. Vérifier qui est l'utilisateur et son rôle
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role = payload.get("role", "membre")
        
        conn = get_psycopg2_connection()
        cursor = conn.cursor()
        
        # Récupérer les colonnes valides pour l'UPDATE direct
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'donnees_excel'")
        valid_columns = {row[0] for row in cursor.fetchall()}

        modifications_pending = []
        direct_updates_count = 0

        for mod in data.modifications:
            clean_new_row = {k: v for k, v in mod.new_row.items() if not k.startswith('__')}
            changes = {k: v for k, v in clean_new_row.items() if k in mod.old_row and str(mod.old_row.get(k)) != str(v)}

            if not changes: continue

            if user_role == "admin":
                # --- ACTION DIRECTE ADMIN ---
                updates = []
                params = []
                for field, new_val in changes.items():
                    if field in valid_columns:
                        updates.append(f'"{field}" = %s')
                        params.append(new_val)
                
                if updates:
                    ticket_number = mod.old_row.get('numero_ticket')
                    params.append(ticket_number)
                    query = f'UPDATE donnees_excel SET {", ".join(updates)} WHERE "numero_ticket" = %s'
                    cursor.execute(query, params)
                    direct_updates_count += 1
            else:
                # --- ACTION MEMBRE (Validation requise) ---
                cursor.execute("""
                    INSERT INTO tickets_modification_pending (utilisateur, old_row, new_row, status)
                    VALUES (%s, %s, %s, 'PENDING') RETURNING id
                """, (mod.utilisateur, json.dumps(mod.old_row), json.dumps(clean_new_row)))
                mod_id = cursor.fetchone()[0]
                modifications_pending.append({'id': mod_id, 'user': mod.utilisateur, 'old_row': mod.old_row, 'new_row': clean_new_row})

        conn.commit()

        if user_role == "admin":
            return {"status": "success", "message": f"{direct_updates_count} modification(s) appliquées directement."}
        else:
            if modifications_pending:
                background_tasks.add_task(send_validation_email_robust, modifications_pending)
            return {"status": "success", "message": f"{len(modifications_pending)} modification(s) en attente de validation."}

    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn: conn.close()
def fetch_modifications_from_db():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, utilisateur, old_row, new_row
        FROM tickets_modification_pending
        WHERE status='PENDING'
    """)

    modifications = []
    columns = ["id", "utilisateur", "old_row", "new_row"]

    for row in cursor.fetchall():
        row_dict = dict(zip(columns, row))
        
        # Décodage des JSON
        old_row = json.loads(row_dict["old_row"]) if isinstance(row_dict["old_row"], str) else row_dict["old_row"]
        new_row = json.loads(row_dict["new_row"]) if isinstance(row_dict["new_row"], str) else row_dict["new_row"]
        
        # Filtrage des métadonnées techniques
        clean_new_row = {
            k: v for k, v in new_row.items()
            if not k.startswith('__')
        }

        # Détection des changements réels
        changes = []
        for key in clean_new_row:
            old_value = old_row.get(key, "")
            new_value = clean_new_row[key]
            if old_value != new_value:
                changes.append({
                    "field": key,
                    "old": old_value,
                    "new": new_value
                })

        if changes:  # Ne retourner que les modifications avec des changements réels
            modifications.append({
                "id": row_dict["id"],
                "utilisateur": row_dict["utilisateur"],
                "numero_ticket": old_row.get('numero_ticket', 'N/A'),
                "changes": changes
            })

    cursor.close()
    conn.close()
    return modifications
    
class Modification(BaseModel):
   
    old_row: dict
    new_row: dict
    utilisateur: str  

@app.get("/modifications-pending", response_class=HTMLResponse)
def get_pending_modifications(request: Request):
    modifications = fetch_modifications_from_db()
    return templates.TemplateResponse(
        request=request,
        name="admin_panel_validation.html",
        context={
            "request": request,
            "modifications": modifications
        }
    )

  
@app.post("/valider_modification/{modification_id}")
def valider_modification(modification_id: int):
    conn = None
    try:
        conn = get_psycopg2_connection()
        cursor = conn.cursor()

        # 1. Récupérer la modification
        cursor.execute("""
            SELECT old_row::text, new_row::text 
            FROM tickets_modification_pending
            WHERE id = %s AND status = 'PENDING'
        """, (modification_id,))

        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Modification non trouvée")

        # Conversion des JSON
        old_row = json.loads(result[0]) if isinstance(result[0], str) else result[0]
        new_row = json.loads(result[1]) if isinstance(result[1], str) else result[1]

        # 2. Nettoyage et détection des changements
        clean_new = {k: v for k, v in new_row.items() if not k.startswith('__')}
        changed_fields = {
            k: (old_row[k], v)
            for k, v in clean_new.items()
            if k in old_row and old_row[k] != v
        }

        if not changed_fields:
            raise HTTPException(status_code=400, detail="Aucun champ modifié valide détecté")

        # 3. Vérification du ticket
        ticket_number = old_row.get('numero_ticket')
        if not ticket_number:
            raise HTTPException(status_code=400, detail="Numéro de ticket manquant")

        # 4. Vérifier que les champs existent dans donnees_excel
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'donnees_excel'
        """)
        valid_columns = {row[0] for row in cursor.fetchall()}
       
        print("Colonnes valides dans donnees_excel :", valid_columns)

        # 5. Mise à jour seulement des champs valides
        updates = []
        params = []
        for field, (_, new_val) in changed_fields.items():
            if field in valid_columns:  # <-- Vérification cruciale
                updates.append(f"{field} = %s")
                params.append(new_val)
        
        if not updates:
            raise HTTPException(status_code=400, detail="Aucun champ valide à modifier")

        params.append(ticket_number)
        print("Champs modifiés proposés :", changed_fields)

        update_query = f"""
            UPDATE donnees_excel
            SET {', '.join(updates)}
            WHERE numero_ticket = %s
        """

        # Debug: Afficher la requête
        print(f"Exécution de: {update_query} avec params: {params}")

        cursor.execute(update_query, params)

        # 6. Marquer comme approuvé
        cursor.execute("""
            UPDATE tickets_modification_pending
            SET status = 'approved'
            WHERE id = %s
        """, (modification_id,))

        conn.commit()
        return {
            "status": "success",
            "modified_fields": [f for f in changed_fields if f in valid_columns],
            "ticket": ticket_number,
            "message": "Modification approuvée avec succès"
        }
      
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la validation: {str(e)}"
        )
    finally:
        if conn: conn.close()
@app.post("/rejeter-modification/{modification_id}")
def rejeter_modification(modification_id: int):
    try:
        conn = get_psycopg2_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tickets_modification_pending
            SET status = 'rejected'
            WHERE id = %s
        """, (modification_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return {"message": "Modification rejetée."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def send_validation_email_robust(modifications: list):
    try:
        if not ADMIN_EMAIL:
            print("❌ Erreur: ADMIN_EMAIL non configuré")
            return

        # Construction du HTML (Identique à votre logique actuelle)
        modifications_html = ""
        for mod in modifications:
            # ... (votre boucle de construction de table_rows reste la même)
            table_rows = ""
            for field_name, old_value in mod['old_row'].items():
                new_value = mod['new_row'].get(field_name)
                if str(old_value) != str(new_value):
                    table_rows += f"""
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">{field_name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{old_value}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: #FF7A01; font-weight: bold;">{new_value}</td>
                    </tr>"""
            
            modifications_html += f"""
            <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3>Modification #{mod['id']} par {mod['user']}</h3>
                <p><strong>Ticket:</strong> {mod['old_row'].get('numero_ticket', 'N/A')}</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f5f5f5;">
                        <th>Champ</th><th>Ancien</th><th>Nouveau</th>
                    </tr>
                    {table_rows}
                </table>
            </div>"""

        body = f"""<html><body>
            <h2>Validation Requise</h2>
            {modifications_html}
            <br>
            <a href="{os.getenv('BASE_URL', 'http://10.139.118.172:8000')}/admin/validation" 
               style="background-color: #FF7A01; color: white; padding: 10px; text-decoration: none; border-radius: 5px;">
               Accéder au panel de validation
            </a>
        </body></html>"""

        # Création du message
        message = MessageSchema(
            subject=f"⚠️ {len(modifications)} modification(s) en attente de validation",
            recipients=[ADMIN_EMAIL],
            body=body,
            subtype=MessageType.html
        )

        fm = FastMail(conf)
        await fm.send_message(message)
        print(f"✅ Email de validation envoyé avec succès à {ADMIN_EMAIL}")

    except Exception as e:
        print(f"❌ Erreur CRITIQUE envoi email: {str(e)}")
        # Optionnel: logger l'erreur dans un fichier ou une table de log DB

def send_validation_email(modifications: list):
    try:
        subject = f"[Validation Requise] {len(modifications)} modification(s) en attente"
        base_url = os.getenv("BASE_URL", "http://10.139.118.172:8000")
        admin_panel_url = f"{base_url}/admin/validation"
        
        modifications_html = ""
        for mod in modifications:
            changed_fields = []
            for field_name, old_value in mod['old_row'].items():
                new_value = mod['new_row'].get(field_name)
                if old_value != new_value:
                    changed_fields.append({
                        'field': field_name,
                        'old': old_value,
                        'new': new_value
                    })
            
            # Build table rows
            table_rows = ""
            for cf in changed_fields:
                table_rows += f"""
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">{cf['field']}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{cf['old']}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{cf['new']}</td>
                </tr>
                """
            
            modifications_html += f"""
            <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <h3 style="color: #444;">Modification #{mod['id']}</h3>
                <p><strong>Utilisateur:</strong> {mod['user']}</p>
                <p><strong>Ticket:</strong> {mod['old_row'].get('numero_ticket', 'N/A')}</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Champ</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Ancienne Valeur</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Nouvelle Valeur</th>
                    </tr>
                    {table_rows}
                </table>
            </div>
            """
        
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2c3e50;">Modifications en attente</h1>
                    <p>Il y a {len(modifications)} modification(s) nécessitant votre validation :</p>
                    {modifications_html}
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="{admin_panel_url}" 
                           style="background-color: #3498db; color: white; 
                                  padding: 12px 24px; text-decoration: none; 
                                  border-radius: 4px; font-weight: bold;
                                  display: inline-block;">
                            Accéder au panel de validation
                        </a>
                    </div>
                   
                </div>
            </body>
        </html>
        """

        msg = MIMEMultipart()
        msg['Subject'] = subject
        msg['From'] = SMTP_USERNAME
        msg['To'] = ADMIN_EMAIL
        msg.attach(MIMEText(body, 'html'))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, ADMIN_EMAIL, msg.as_string())

        print(f"Email groupé envoyé avec {len(modifications)} modification(s)")
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email groupé: {e}")
        



@app.get("/admin/validation", response_class=HTMLResponse)
async def admin_panel(request: Request):
    try:
        # Récupérer les modifications en attente
        modifications = fetch_modifications_from_db()  # Utilisez votre fonction existante
        
        return templates.TemplateResponse(
            request=request,
            name="admin_panel_validation.html",
            context={"request": request, "modifications": modifications}
        )
    except Exception as e:
        print(PathLibPath(__file__).parent / "templates/admin_panel_validation.html")  # Devrait afficher le bon chemin absolu
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get('/export-excel')
def extract_excel(
    
    
     client: Optional[str] = None,
    annees: Optional[List[int]] = Query(None, alias="annees[]"),
    trimestre: Optional[List[str]] = Query(None, alias="trimestre[]")
):
    try:
        # --- Logique identique à celle de /raw-data ---
        query = 'SELECT * FROM donnees_excel WHERE 1=1'
        params = []

        if client:
            query += ' AND client = %s'
            params.append(client)

        if annees:
            placeholders = ','.join(['%s'] * len(annees))
            query += f' AND year_cloture IN ({placeholders})'
            params.extend(annees)

        df = pd.read_sql(query, engine, params=tuple(params))

        if df.empty:
            raise HTTPException(status_code=404, detail="Aucune donnée à exporter.")

        if "date_cloture" in df.columns:
            df["date_cloture"] = pd.to_datetime(df['date_cloture'], errors='coerce')
            df['year_cloture'] = df['date_cloture'].dt.year
            
            # Dictionnaire de correspondance des mois
            mois_fr = {
                1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
                5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
                9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre"
            }
            
            # Création de la colonne en utilisant le numéro du mois (1 à 12)
            df['Month_clos'] = df['date_cloture'].dt.month.map(mois_fr)
            
            # Transformation en Catégorie pour garder l'ordre chronologique
            df['Month_clos'] = pd.Categorical(
                df['Month_clos'],
                categories=["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
                ordered=True
            )

        if trimestre and not df.empty:
            mapping_periodes = {
                "T1": ["Janvier", "Février", "Mars"],
                "T2": ["Avril", "Mai", "Juin"],
                "T3": ["Juillet", "Août", "Septembre"],
                "T4": ["Octobre", "Novembre", "Décembre"],
                "S1": ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin"],
                "S2": ["Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
                "Année": [
                    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
                ]
            }
            mois = []
            for periode in trimestre:
                mois.extend(mapping_periodes.get(periode, []))
            mois = sorted(set(mois), key=lambda m: mapping_periodes["Année"].index(m))
            df = df[df["Month_clos"].isin(mois)]

        # --- Export Excel ---
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Filtrage')
        output.seek(0)

        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": "attachment; filename=donnees_filtrees.xlsx"
            }
        )

    except Exception as e:
        print(f"Erreur dans /export-excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 1. Définir le chemin vers le build du frontend
# Dans votre Dockerfile, le build est dans /app/frontend/build
frontend_path = "/app/frontend/build"

if os.path.exists(frontend_path):
    static_path = os.path.join(frontend_path, "static")
    if os.path.exists(static_path):
        app.mount("/static", StaticFiles(directory=static_path), name="static")
        print(f"✅ Frontend static files mounted from {static_path}")
    else:
        print(f"⚠️ Warning: Static directory not found at {static_path}")

    # 3. Route pour servir l'index.html de React sur toutes les autres routes
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Si la requête commence par /api ou /docs, on ne fait rien (laisser FastAPI gérer)
        if catchall.startswith(("api", "docs", "openapi.json")):
            return None 
        
        index_file = os.path.join(frontend_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse({"detail": "Frontend not built yet"}, status_code=404)
else:
    print(f"⚠️ Erreur: Le dossier frontend n'a pas été trouvé à l'adresse : {frontend_path}")
