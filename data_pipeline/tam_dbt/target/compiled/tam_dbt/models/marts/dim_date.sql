with date_spine as (
    





with rawdata as (

    

    

    with p as (
        select 0 as generated_number union all select 1
    ), unioned as (

    select

    
    p0.generated_number * power(2, 0)
     + 
    
    p1.generated_number * power(2, 1)
     + 
    
    p2.generated_number * power(2, 2)
     + 
    
    p3.generated_number * power(2, 3)
     + 
    
    p4.generated_number * power(2, 4)
     + 
    
    p5.generated_number * power(2, 5)
     + 
    
    p6.generated_number * power(2, 6)
     + 
    
    p7.generated_number * power(2, 7)
     + 
    
    p8.generated_number * power(2, 8)
     + 
    
    p9.generated_number * power(2, 9)
     + 
    
    p10.generated_number * power(2, 10)
     + 
    
    p11.generated_number * power(2, 11)
    
    
    + 1
    as generated_number

    from

    
    p as p0
     cross join 
    
    p as p1
     cross join 
    
    p as p2
     cross join 
    
    p as p3
     cross join 
    
    p as p4
     cross join 
    
    p as p5
     cross join 
    
    p as p6
     cross join 
    
    p as p7
     cross join 
    
    p as p8
     cross join 
    
    p as p9
     cross join 
    
    p as p10
     cross join 
    
    p as p11
    
    

    )

    select *
    from unioned
    where generated_number <= 4017
    order by generated_number



),

all_periods as (

    select (
        

    cast('2020-01-01' as date) + ((interval '1 day') * (row_number() over (order by generated_number) - 1))


    ) as date_day
    from rawdata

),

filtered as (

    select *
    from all_periods
    where date_day <= cast('2030-12-31' as date)

)

select * from filtered


)

select
    md5(cast(coalesce(cast(date_day as TEXT), '_dbt_utils_surrogate_key_null_') as TEXT)) as dim_date_id,
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