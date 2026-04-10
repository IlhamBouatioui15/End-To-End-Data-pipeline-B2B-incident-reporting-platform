with stg as (
    select * from {{ ref('stg_tickets') }}
)

select
    -- clé primaire
    {{ dbt_utils.generate_surrogate_key(['numero_ticket']) }} as ticket_id,

    -- clé naturelle
    numero_ticket,

    -- FK dimensions (recalcul des mêmes hash — zéro JOIN, zéro risque d'explosion)
    {{ dbt_utils.generate_surrogate_key(['client', 'site_client']) }}                                               as dim_client_id,
    {{ dbt_utils.generate_surrogate_key(['service', 'type_produit', 'engagement']) }}                              as dim_service_id,
    {{ dbt_utils.generate_surrogate_key(['famille_probleme', 'detail_probleme', 'criticite']) }}                   as dim_probleme_id,
    {{ dbt_utils.generate_surrogate_key(['niveau_resolution', 'gtr_respectee', 'cause_retard_gtr', 'action_resolution', 'acces_last_mile']) }} as dim_resolution_id,

    -- FK dates (clé = la date elle-même, pas un hash)
    date_creation::date      as dim_date_creation_id,
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