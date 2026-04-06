with date_spine as (
    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2020-01-01' as date)",
        end_date="cast('2030-12-31' as date)"
    ) }}
)

select
    {{ dbt_utils.generate_surrogate_key(['date_day']) }} as dim_date_id,
    date_day::date                                        as date_complete,  -- cast explicite
    extract(day     from date_day)::int                   as jour,
    extract(month   from date_day)::int                   as mois,
    extract(year    from date_day)::int                   as annee,
    extract(week    from date_day)::int                   as semaine,
    extract(quarter from date_day)::int                   as trimestre,
    trim(to_char(date_day, 'Day'))                        as jour_semaine,   -- trim les espaces
    extract(isodow  from date_day)::int                   as num_jour_semaine,
    case when extract(isodow from date_day) < 6
         then true else false end                         as est_jour_ouvre,
    to_char(date_day, 'YYYY-MM')                          as annee_mois
from date_spine