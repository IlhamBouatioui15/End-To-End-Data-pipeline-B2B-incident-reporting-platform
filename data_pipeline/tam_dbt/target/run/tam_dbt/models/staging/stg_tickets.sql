
  create view "brise_db"."analytics_staging"."stg_tickets__dbt_tmp"
    
    
  as (
    with source as (
    select * from "brise_db"."public"."donnees_excel"
),

renamed as (
    select
        -- clés
        numero_ticket,
        id                              as ticket_id_source,

        -- dates (cast explicite + nettoyage)
        date_debut_ticket::timestamp    as date_debut_ticket,
        date_creation::timestamp        as date_creation,
        date_retablissement::timestamp  as date_retablissement,
        date_cloture::timestamp         as date_cloture,
        dms::timestamp                  as dms,

        -- client
        coalesce(client, 'Inconnu')         as client,
        coalesce(site_client, 'Inconnu')    as site_client,
        categ,
        rsp,
        site_client_corresp_local_2,

        -- service
        coalesce(service, 'Non renseigné')  as service,
        detail_service,
        type_ticket,
        engagement,
        type_produit,
        

        -- problème
        famille_probleme,
        detail_probleme,
        description,
        lower(trim(criticite))              as criticite,

        -- résolution
        lower(trim(etat))               as etat,
        niveau_resolution,
        gtr_respectee,
        cause_retard_gtr,
        action_resolution,
        acces_last_mile,

        -- mesures (durées)
        duree_traitement_mn_oceane,
        duree_traitement_mn_global,
        duree_retablissement_mn,
        duree_gel_mn,

        -- granularité temps
        week_creation,
        year_creation,
        week_cloture,
        year_cloture,

        -- pipeline
        source_file,
        ingestion_timestamp

    from source
    where numero_ticket is not null   
)

select * from renamed
  );