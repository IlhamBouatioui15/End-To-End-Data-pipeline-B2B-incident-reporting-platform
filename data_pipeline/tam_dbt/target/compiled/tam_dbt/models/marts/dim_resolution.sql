with stg as (
    select distinct
        niveau_resolution,
        etat,
        gtr_respectee,
        cause_retard_gtr,
        action_resolution,
        acces_last_mile
    from "brise_db"."analytics_staging"."stg_tickets"
)

select
    md5(cast(coalesce(cast(niveau_resolution as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(gtr_respectee as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(cause_retard_gtr as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(action_resolution as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(acces_last_mile as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_resolution_id,
    niveau_resolution,
    etat,
    gtr_respectee,
    cause_retard_gtr,
    action_resolution,
    acces_last_mile
from stg