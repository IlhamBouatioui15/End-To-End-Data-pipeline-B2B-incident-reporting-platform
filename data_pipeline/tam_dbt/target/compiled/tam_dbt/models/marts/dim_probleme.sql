with stg as (
    select distinct
        famille_probleme,
        detail_probleme,
        description,
        criticite
    from "brise_db"."analytics_staging"."stg_tickets"
)

select
    md5(cast(coalesce(cast(famille_probleme as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(detail_probleme as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(criticite as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_probleme_id,
    famille_probleme,
    detail_probleme,
    description,
    criticite
from stg