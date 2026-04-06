with stg as (
    select distinct
        service,
        detail_service,
        type_ticket,
        engagement,
        type_produit
    from "brise_db"."analytics_staging"."stg_tickets"
)

select
    md5(cast(coalesce(cast(service as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(type_produit as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(engagement as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_service_id,
    service,
    detail_service,
    type_ticket,
    engagement,
    type_produit
from stg