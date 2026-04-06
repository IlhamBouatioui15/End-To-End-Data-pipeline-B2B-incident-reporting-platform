
  
    

  create  table "brise_db"."analytics_marts"."dim_client__dbt_tmp"
  
  
    as
  
  (
    with stg as (
    select distinct
        client,
        site_client,
        categ,
        rsp,
        site_client_corresp_local_2
    from "brise_db"."analytics_staging"."stg_tickets"
)

select
    md5(cast(coalesce(cast(client as TEXT), '_dbt_utils_surrogate_key_null_') || '-' || coalesce(cast(site_client as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_client_id,
    client,
    site_client,
    categ,
    rsp,
    site_client_corresp_local_2
from stg
  );
  