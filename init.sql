-- Paramètres globaux
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- 1. Table des Utilisateurs (Application)
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    username character varying UNIQUE,
    hashed_password character varying,
    role character varying
);
CREATE INDEX ix_users_id ON public.users USING btree (id);

-- 2. Table des Membres (Application)
CREATE TABLE public."Members" (
    id SERIAL PRIMARY KEY,
    "First_name" character varying,
    "Last_name" character varying,
    "Role" character varying,
    "Username" character varying UNIQUE,
    password character varying
);
CREATE INDEX ix_Members_id ON public."Members" USING btree (id);

-- 3. Table des Données (Point de liaison Pipeline & App)
-- On utilise ici les types compatibles Spark tout en gardant les noms de colonnes de l'App
CREATE TABLE public.donnees_excel (
    numero_ticket character varying(255) NOT NULL PRIMARY KEY,
    etat character varying(100),
    date_debut_ticket TIMESTAMP, -- Spark envoie des timestamps
    date_creation TIMESTAMP,
    date_retablissement TIMESTAMP,
    date_cloture TIMESTAMP,
    description text,
    id character varying(255),
    client character varying(255),
    site_client character varying(255),
    categ character varying(100),
    criticite character varying(50),
    week_creation integer,
    year_creation integer,
    week_cloture integer,
    year_cloture integer,
    service character varying(255),
    detail_service text,
    niveau_resolution character varying(100),
    duree_traitement_mn_oceane integer, -- Changé INTEGER en DOUBLE
    duree_traitement_mn_global integer,
    duree_retablissement_mn integer,
    duree_gel_mn integer,
    gtr_respectee integer,
    cause_retard_gtr text,
    action_resolution text,
    famille_probleme character varying(255),
    detail_probleme text,
    acces_last_mile character varying(255),
    rsp character varying(255),
    site_client_corresp_local_2 character varying(255),
    dms timestamp,
    type_produit character varying(255),
    type_ticket character varying(255),
    engagement character varying(255),
    -- Colonnes ajoutées pour le pipeline
    source_file character varying(255),
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table des modifications en attente (Application)
CREATE TABLE public.tickets_modification_pending (
    id SERIAL PRIMARY KEY,
    utilisateur character varying(255),
    numero_ticket character varying(255), -- Taille alignée sur donnees_excel
    old_row jsonb,
    new_row jsonb,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    CONSTRAINT tickets_modification_pending_numero_ticket_fkey 
        FOREIGN KEY (numero_ticket) REFERENCES public.donnees_excel(numero_ticket) ON DELETE CASCADE
);