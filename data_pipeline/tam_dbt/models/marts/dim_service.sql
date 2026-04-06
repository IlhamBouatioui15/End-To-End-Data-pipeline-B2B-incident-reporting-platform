with stg as (
    select distinct
        service,
        detail_service,
        type_ticket,
        engagement,
        type_produit
    from {{ ref('stg_tickets') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['service', 'type_produit', 'engagement']) }} as dim_service_id,
    service,
    detail_service,
    type_ticket,
    engagement,
    type_produit
from stg