-- Correct USDA catalog nutrition bases, source coverage, barcode matching, and release reconciliation.

alter table public.food_data_imports
  drop constraint if exists food_data_imports_source_type_check;
alter table public.food_data_imports
  add constraint food_data_imports_source_type_check
  check (source_type in ('usda_foundation','usda_fndds','usda_branded','usda_sr_legacy','usda_experimental'));

alter table public.food_catalog
  add column if not exists nutrition_basis_size numeric not null default 100,
  add column if not exists nutrition_basis_unit text not null default 'g',
  add column if not exists serving_options jsonb not null default '[]'::jsonb;
alter table public.food_catalog_staging
  add column if not exists nutrition_basis_size numeric not null default 100,
  add column if not exists nutrition_basis_unit text not null default 'g',
  add column if not exists serving_options jsonb not null default '[]'::jsonb;

-- Previous imports scaled core columns to the preferred serving while nutrient_data retained
-- the true per-100-g values. Restore known core nutrients from nutrient_data when available.
update public.food_catalog
set
  calories = coalesce(
    nullif(nutrient_data #>> '{nutrients,1008,amount}', '')::numeric,
    nullif(nutrient_data #>> '{nutrients,2047,amount}', '')::numeric,
    nullif(nutrient_data #>> '{nutrients,2048,amount}', '')::numeric,
    calories
  ),
  protein_g = coalesce(nullif(nutrient_data #>> '{nutrients,1003,amount}', '')::numeric, protein_g),
  carbohydrates_g = coalesce(nullif(nutrient_data #>> '{nutrients,1005,amount}', '')::numeric, carbohydrates_g),
  fat_g = coalesce(nullif(nutrient_data #>> '{nutrients,1004,amount}', '')::numeric, fat_g),
  fiber_g = coalesce(nullif(nutrient_data #>> '{nutrients,1079,amount}', '')::numeric, fiber_g),
  sugar_g = coalesce(nullif(nutrient_data #>> '{nutrients,2000,amount}', '')::numeric, sugar_g),
  saturated_fat_g = coalesce(nullif(nutrient_data #>> '{nutrients,1258,amount}', '')::numeric, saturated_fat_g),
  sodium_mg = coalesce(nullif(nutrient_data #>> '{nutrients,1093,amount}', '')::numeric, sodium_mg),
  nutrition_basis_size = 100,
  nutrition_basis_unit = 'g'
where nutrient_data ->> 'basis' = 'per_100_g';

create or replace function public.food_gtin_check_digit_valid(input_barcode text)
returns boolean language sql immutable parallel safe as $$
  with n as (
    select public.normalize_food_barcode(input_barcode) as digits
  ), valid as (
    select digits, left(digits, char_length(digits) - 1) as body,
      right(digits, 1)::integer as expected
    from n where char_length(digits) in (8,12,13,14) and digits ~ '^[0-9]+$'
  ), totals as (
    select v.digits, v.expected,
      coalesce(sum(
        substr(v.body, pos, 1)::integer *
        case when (char_length(v.body) - pos) % 2 = 0 then 3 else 1 end
      ), 0) as weighted_sum
    from valid v
    cross join lateral generate_series(1, char_length(v.body)) pos
    group by v.digits, v.expected
  )
  select coalesce((
    select ((10 - (weighted_sum % 10)) % 10) = expected from totals limit 1
  ), false);
$$;

create or replace function public.expand_food_upce(input_barcode text)
returns text language plpgsql immutable parallel safe as $$
declare
  d text := public.normalize_food_barcode(input_barcode);
  body text;
  expanded text;
begin
  if d is null or char_length(d) <> 8 or left(d,1) not in ('0','1') then return null; end if;
  case substr(d,7,1)
    when '0' then body := substr(d,1,3) || '0' || '0000' || substr(d,4,3);
    when '1' then body := substr(d,1,3) || '1' || '0000' || substr(d,4,3);
    when '2' then body := substr(d,1,3) || '2' || '0000' || substr(d,4,3);
    when '3' then body := substr(d,1,4) || '00000' || substr(d,5,2);
    when '4' then body := substr(d,1,5) || '00000' || substr(d,6,1);
    else body := substr(d,1,6) || '0000' || substr(d,7,1);
  end case;
  expanded := body || right(d,1);
  if public.food_gtin_check_digit_valid(expanded) then return expanded; end if;
  return null;
end;
$$;

create or replace function public.food_gtin_equivalents(input_barcode text)
returns text[] language sql immutable parallel safe as $$
  with n as (select public.normalize_food_barcode(input_barcode) as digits),
  valueset as (
    select lpad(digits,14,'0') value from n where char_length(digits) in (8,12,13,14)
    union
    select lpad(public.expand_food_upce(digits),14,'0') from n where public.expand_food_upce(digits) is not null
  )
  select coalesce(array_agg(value order by value), array[]::text[]) from valueset;
$$;

create or replace function public.canonical_food_gtin(input_barcode text)
returns text language sql immutable parallel safe as $$
  select (public.food_gtin_equivalents(input_barcode))[1];
$$;

drop function if exists public.search_food_catalog(text, integer, integer);
create function public.search_food_catalog(search_query text, result_limit integer default 25, result_offset integer default 0)
returns table (
  id uuid, source_type text, fdc_id bigint, description text, brand_name text, gtin_upc text,
  food_category text, serving_size numeric, serving_unit text, household_serving_text text,
  nutrition_basis_size numeric, nutrition_basis_unit text, serving_options jsonb,
  publication_date date, available_date date, modified_date date,
  calories numeric, protein_g numeric, carbohydrates_g numeric, fat_g numeric,
  fiber_g numeric, sugar_g numeric, saturated_fat_g numeric, sodium_mg numeric,
  result_rank double precision
)
language sql stable set search_path = public, extensions as $$
  with input as (
    select lower(regexp_replace(trim(coalesce(search_query,'')), '\s+', ' ', 'g')) q,
           least(greatest(coalesce(result_limit,25),1),50) lim,
           greatest(coalesce(result_offset,0),0) off
  ), candidates as (
    select fc.*,
      (case when lower(fc.description)=i.q then 1000
            when lower(fc.description) like i.q||'%' then 800
            when lower(fc.description) like '%'||i.q||'%' then 600 else 0 end
       + case when lower(coalesce(fc.brand_name,'')||' '||fc.description)=i.q then 900
              when lower(coalesce(fc.brand_name,'')||' '||fc.description) like i.q||'%' then 700
              when lower(coalesce(fc.brand_name,'')||' '||fc.description) like '%'||i.q||'%' then 450 else 0 end
       + similarity(lower(fc.description),i.q)*120
       + similarity(lower(concat_ws(' ',fc.brand_name,fc.description)),i.q)*80
       + case when coalesce(fum.is_favorite,false) then 120 else 0 end
       + least(coalesce(fum.use_count,0),100)*0.75
       + case when fum.last_used_at >= now()-interval '7 days' then 30
              when fum.last_used_at >= now()-interval '30 days' then 15 else 0 end
      )::double precision result_rank
    from public.food_catalog fc cross join input i
    left join public.food_user_metadata fum on fum.food_id=fc.id and fum.user_id=auth.uid()
    where fc.status='active' and char_length(i.q) between 2 and 120
      and (lower(fc.description) like '%'||i.q||'%'
        or lower(coalesce(fc.brand_name,'')) like '%'||i.q||'%'
        or similarity(lower(fc.description),i.q)>=0.16
        or similarity(lower(concat_ws(' ',fc.brand_name,fc.description)),i.q)>=0.16)
  )
  select c.id,c.source_type,c.fdc_id,c.description,c.brand_name,c.gtin_upc,c.food_category,
    c.serving_size,c.serving_unit,c.household_serving_text,c.nutrition_basis_size,c.nutrition_basis_unit,
    c.serving_options,c.publication_date,c.available_date,c.modified_date,c.calories,c.protein_g,
    c.carbohydrates_g,c.fat_g,c.fiber_g,c.sugar_g,c.saturated_fat_g,c.sodium_mg,c.result_rank
  from candidates c order by c.result_rank desc,c.description,c.fdc_id
  limit (select lim from input) offset (select off from input);
$$;

drop function if exists public.search_food_by_barcode(text);
create function public.search_food_by_barcode(input_barcode text)
returns table (
  id uuid, source_type text, fdc_id bigint, description text, brand_name text, gtin_upc text,
  food_category text, serving_size numeric, serving_unit text, household_serving_text text,
  nutrition_basis_size numeric, nutrition_basis_unit text, serving_options jsonb,
  publication_date date, available_date date, modified_date date,
  calories numeric, protein_g numeric, carbohydrates_g numeric, fat_g numeric,
  fiber_g numeric, sugar_g numeric, saturated_fat_g numeric, sodium_mg numeric
)
language sql stable set search_path=public as $$
  with input as (select public.canonical_food_gtin(input_barcode) barcode)
  select fc.id,fc.source_type,fc.fdc_id,fc.description,fc.brand_name,fc.gtin_upc,fc.food_category,
    fc.serving_size,fc.serving_unit,fc.household_serving_text,fc.nutrition_basis_size,fc.nutrition_basis_unit,
    fc.serving_options,fc.publication_date,fc.available_date,fc.modified_date,fc.calories,fc.protein_g,
    fc.carbohydrates_g,fc.fat_g,fc.fiber_g,fc.sugar_g,fc.saturated_fat_g,fc.sodium_mg
  from public.food_catalog fc cross join input i
  where fc.status='active' and fc.source_type='usda_branded' and i.barcode is not null
    and public.food_gtin_equivalents(fc.gtin_upc) && public.food_gtin_equivalents(input_barcode)
  order by fc.publication_date desc nulls last,fc.modified_date desc nulls last,fc.available_date desc nulls last,fc.fdc_id desc
  limit 5;
$$;

create or replace function public.promote_food_catalog_import(input_import_id uuid)
returns table (inserted_count bigint, updated_count bigint)
language plpgsql security definer set search_path=public as $$
declare
  invalid_count bigint; existing_count bigint; staged_count bigint; import_source text;
begin
  select source_type into import_source from public.food_data_imports where id=input_import_id;
  if import_source is null then raise exception 'Import % does not exist',input_import_id; end if;
  select count(*) into staged_count from public.food_catalog_staging where import_id=input_import_id;
  if staged_count=0 then raise exception 'Import % has no staged records',input_import_id; end if;
  select count(*) into invalid_count from public.food_catalog_staging s
  where s.import_id=input_import_id and (s.fdc_id is null or btrim(s.description)=''
    or s.source_type not in ('usda_foundation','usda_fndds','usda_branded','usda_sr_legacy','usda_experimental')
    or s.source_type<>import_source
    or (s.calories is not null and s.calories<0) or (s.protein_g is not null and s.protein_g<0)
    or (s.carbohydrates_g is not null and s.carbohydrates_g<0) or (s.fat_g is not null and s.fat_g<0)
    or (s.serving_size is not null and s.serving_size<=0)
    or (s.gtin_upc is not null and char_length(public.normalize_food_barcode(s.gtin_upc)) not in (8,12,13,14)));
  if invalid_count>0 then
    update public.food_data_imports set status='failed',completed_at=now(),records_rejected=invalid_count,
      error_summary=format('%s staged records failed validation',invalid_count) where id=input_import_id;
    raise exception 'Import % has % invalid staged records',input_import_id,invalid_count;
  end if;
  select count(*) into existing_count from public.food_catalog fc join public.food_catalog_staging s on s.fdc_id=fc.fdc_id where s.import_id=input_import_id;
  insert into public.food_catalog (
    fdc_id,source_type,description,brand_owner,brand_name,gtin_upc,food_category,serving_size,serving_unit,
    household_serving_text,nutrition_basis_size,nutrition_basis_unit,serving_options,calories,protein_g,
    carbohydrates_g,fat_g,fiber_g,sugar_g,saturated_fat_g,sodium_mg,nutrient_data,publication_date,
    available_date,modified_date,status,imported_at,updated_at)
  select s.fdc_id,s.source_type,s.description,s.brand_owner,s.brand_name,public.normalize_food_barcode(s.gtin_upc),
    s.food_category,s.serving_size,s.serving_unit,s.household_serving_text,s.nutrition_basis_size,
    s.nutrition_basis_unit,s.serving_options,s.calories,s.protein_g,s.carbohydrates_g,s.fat_g,s.fiber_g,
    s.sugar_g,s.saturated_fat_g,s.sodium_mg,s.nutrient_data,s.publication_date,s.available_date,s.modified_date,
    'active',now(),now() from public.food_catalog_staging s where s.import_id=input_import_id
  on conflict(fdc_id) do update set source_type=excluded.source_type,description=excluded.description,
    brand_owner=excluded.brand_owner,brand_name=excluded.brand_name,gtin_upc=excluded.gtin_upc,
    food_category=excluded.food_category,serving_size=excluded.serving_size,serving_unit=excluded.serving_unit,
    household_serving_text=excluded.household_serving_text,nutrition_basis_size=excluded.nutrition_basis_size,
    nutrition_basis_unit=excluded.nutrition_basis_unit,serving_options=excluded.serving_options,
    calories=excluded.calories,protein_g=excluded.protein_g,carbohydrates_g=excluded.carbohydrates_g,
    fat_g=excluded.fat_g,fiber_g=excluded.fiber_g,sugar_g=excluded.sugar_g,saturated_fat_g=excluded.saturated_fat_g,
    sodium_mg=excluded.sodium_mg,nutrient_data=excluded.nutrient_data,publication_date=excluded.publication_date,
    available_date=excluded.available_date,modified_date=excluded.modified_date,status='active',updated_at=now();

  -- A completed full release is authoritative for this USDA source: records absent from it are retired.
  update public.food_catalog fc set status='retired',updated_at=now()
  where fc.source_type=import_source and fc.status<>'retired'
    and not exists(select 1 from public.food_catalog_staging s where s.import_id=input_import_id and s.fdc_id=fc.fdc_id);

  update public.food_data_imports set completed_at=now(),records_read=staged_count,
    records_inserted=staged_count-existing_count,records_updated=existing_count,status='completed',error_summary=null
  where id=input_import_id;
  delete from public.food_catalog_staging where import_id=input_import_id;
  return query select staged_count-existing_count,existing_count;
end;
$$;

grant execute on function public.search_food_catalog(text,integer,integer) to anon,authenticated;
grant execute on function public.search_food_by_barcode(text) to anon,authenticated;
grant execute on function public.canonical_food_gtin(text) to anon,authenticated;
grant execute on function public.food_gtin_check_digit_valid(text) to anon,authenticated;
grant execute on function public.expand_food_upce(text) to anon,authenticated;
grant execute on function public.food_gtin_equivalents(text) to anon,authenticated;
revoke all on function public.promote_food_catalog_import(uuid) from public,anon,authenticated;
grant execute on function public.promote_food_catalog_import(uuid) to service_role;
