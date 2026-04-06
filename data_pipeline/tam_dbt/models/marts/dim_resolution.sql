with stg as (
    select distinct
        niveau_resolution,
        etat,
        gtr_respectee,
        cause_retard_gtr,
        action_resolution,
        acces_last_mile
    from {{ ref('stg_tickets') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['niveau_resolution', 'gtr_respectee', 'cause_retard_gtr', 'action_resolution', 'acces_last_mile']) }} as dim_resolution_id,
    niveau_resolution,
    etat,
    gtr_respectee,
    cause_retard_gtr,
    action_resolution,
    acces_last_mile
from stg