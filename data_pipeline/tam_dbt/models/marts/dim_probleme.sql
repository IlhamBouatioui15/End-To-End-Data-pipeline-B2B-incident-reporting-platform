with stg as (
    select distinct
        famille_probleme,
        detail_probleme,
        description,
        criticite
    from {{ ref('stg_tickets') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['famille_probleme', 'detail_probleme', 'criticite']) }} as dim_probleme_id,
    famille_probleme,
    detail_probleme,
    description,
    criticite
from stg