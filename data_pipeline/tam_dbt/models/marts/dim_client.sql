with stg as (
    select distinct
        client,
        site_client,
        categ,
        rsp,
        site_client_corresp_local_2
    from {{ ref('stg_tickets') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['client', 'site_client']) }} as dim_client_id,
    client,
    site_client,
    categ,
    rsp,
    site_client_corresp_local_2
from stg