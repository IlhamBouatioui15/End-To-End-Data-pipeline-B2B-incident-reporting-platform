
  
    

  create  table "brise_db"."analytics_marts"."fct_tickets__dbt_tmp"
  
  
    as
  
  (
    with stg as (
    select * from "brise_db"."analytics_staging"."stg_tickets"
)

select
    -- clé primaire
    md5(cast(coalesce(cast(numero_ticket as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as ticket_id,

    -- clé naturelle
    numero_ticket,

    -- FK dimensions (recalcul des mêmes hash — zéro JOIN, zéro risque d'explosion)
    md5(cast(coalesce(cast(client as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(site_client as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT))                                               as dim_client_id,
    md5(cast(coalesce(cast(service as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(type_produit as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(engagement as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT))                              as dim_service_id,
    md5(cast(coalesce(cast(famille_probleme as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(detail_probleme as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(criticite as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT))                   as dim_probleme_id,
    md5(cast(coalesce(cast(niveau_resolution as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(gtr_respectee as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(cause_retard_gtr as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(action_resolution as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(acces_last_mile as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_resolution_id,

    -- FK dates (clé = la date elle-même, pas un hash)
    date_creation::date      as date_creation_id,
    date_debut_ticket::date  as date_debut_ticket_id,
    date_cloture::date       as date_cloture_id,
    date_retablissement::date as date_retablissement_id,
    dms::date                as date_dms_id,

    -- mesures
    duree_traitement_mn_oceane,
    duree_traitement_mn_global,
    duree_retablissement_mn,
    duree_gel_mn,
    gtr_respectee::int        as gtr_respectee

from stg
  );
  