-- USDA FoodData Central catalog infrastructure.
-- Keeps the existing public.foods table intact for a controlled migration.

create extension if not exists pg_trgm;

create table if not exists public.food_data_imports (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('usda_foundation', 'usda_fndds', 'usda_branded')),
  source_version text,
  release_date date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_read bigint not null default 0,
  records_inserted bigint not null default 0,
  records_updated bigint not null default 0,
  records_rejected bigint not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_summary text
);

create table if not exists public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  fdc_id bigint not null unique,
  source_type text not null check (source_type in ('usda_foundation', 'usda_fndds', 'usda_branded')),
  description text not null,
  brand_owner text,
  brand_name text,
  gtin_upc text,
  food_category text,
  serving_size numeric check (serving_size is null or serving_size > 0),
  serving_unit text,
  household_serving_text text,
  calories numeric check (calories is null or calories >= 0),
  protein_g numeric check (protein_g is null or protein_g >= 0),
  carbohydrates_g numeric check (carbohydrates_g is null or carbohydrates_g >= 0),
  fat_g numeric check (fat_g is null or fat_g >= 0),
  fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  sugar_g numeric check (sugar_g is null or sugar_g >= 0),
  saturated_fat_g numeric check (saturated_fat_g is null or saturated_fat_g >= 0),
  sodium_mg numeric check (sodium_mg is null or sodium_mg >= 0),
  nutrient_data jsonb not null default '{}'::jsonb,
  publication_date date,
  available_date date,
  modified_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'retired')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_catalog_staging (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.food_data_imports(id) on delete cascade,
  fdc_id bigint not null,
  source_type text not null,
  description text not null,
  brand_owner text,
  brand_name text,
  gtin_upc text,
  food_category text,
  serving_size numeric,
  serving_unit text,
  household_serving_text text,
  calories numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric,
  sodium_mg numeric,
  nutrient_data jsonb not null default '{}'::jsonb,
  publication_date date,
  available_date date,
  modified_date date
);

create table if not exists public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  barcode text,
  category text,
  serving_size numeric check (serving_size is null or serving_size > 0),
  serving_unit text,
  household_serving_text text,
  calories numeric not null check (calories >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbohydrates_g numeric not null check (carbohydrates_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  sugar_g numeric check (sugar_g is null or sugar_g >= 0),
  saturated_fat_g numeric check (saturated_fat_g is null or saturated_fat_g >= 0),
  sodium_mg numeric check (sodium_mg is null or sodium_mg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, barcode)
);

create table if not exists public.food_user_metadata (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.food_catalog(id) on delete cascade,
  is_favorite boolean not null default false,
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  preferred_serving_size numeric check (preferred_serving_size is null or preferred_serving_size > 0),
  preferred_serving_unit text,
  primary key (user_id, food_id)
);

create index if not exists food_catalog_description_trgm_idx
on public.food_catalog using gin (lower(description) gin_trgm_ops);

create index if not exists food_catalog_brand_trgm_idx
on public.food_catalog using gin (lower(coalesce(brand_name, '')) gin_trgm_ops);

create index if not exists food_catalog_barcode_idx
on public.food_catalog (gtin_upc)
where gtin_upc is not null;

create index if not exists food_catalog_fdc_idx
on public.food_catalog (fdc_id);

create index if not exists food_catalog_source_idx
on public.food_catalog (source_type, status);

create unique index if not exists food_catalog_staging_import_fdc_idx
on public.food_catalog_staging (import_id, fdc_id);

create index if not exists user_foods_name_trgm_idx
on public.user_foods using gin (lower(name) gin_trgm_ops);

create index if not exists user_foods_user_barcode_idx
on public.user_foods (user_id, barcode)
where barcode is not null;

create index if not exists food_user_metadata_recent_idx
on public.food_user_metadata (user_id, last_used_at desc nulls last);

alter table public.food_catalog enable row level security;
alter table public.food_catalog_staging enable row level security;
alter table public.food_data_imports enable row level security;
alter table public.user_foods enable row level security;
alter table public.food_user_metadata enable row level security;

-- The USDA catalog is public reference data. Ordinary clients may read it but
-- receive no insert/update/delete policy. Catalog writes are service-role only.
create policy "Public clients can read food catalog"
on public.food_catalog
for select
to anon, authenticated
using (true);

create policy "Users can read own custom foods"
on public.user_foods
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can add own custom foods"
on public.user_foods
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own custom foods"
on public.user_foods
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own custom foods"
on public.user_foods
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own food metadata"
on public.food_user_metadata
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can add own food metadata"
on public.food_user_metadata
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own food metadata"
on public.food_user_metadata
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own food metadata"
on public.food_user_metadata
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.normalize_food_barcode(input_barcode text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when input_barcode is null then null
    else nullif(regexp_replace(trim(input_barcode), '[^0-9]', '', 'g'), '')
  end;
$$;

create or replace function public.search_food_catalog(
  search_query text,
  result_limit integer default 25,
  result_offset integer default 0
)
returns table (
  id uuid,
  source_type text,
  fdc_id bigint,
  description text,
  brand_name text,
  gtin_upc text,
  food_category text,
  serving_size numeric,
  serving_unit text,
  household_serving_text text,
  calories numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric,
  sodium_mg numeric,
  result_rank double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with input as (
    select
      lower(regexp_replace(trim(coalesce(search_query, '')), '\s+', ' ', 'g')) as q,
      least(greatest(coalesce(result_limit, 25), 1), 50) as lim,
      greatest(coalesce(result_offset, 0), 0) as off
  ),
  candidates as (
    select
      fc.id,
      fc.source_type,
      fc.fdc_id,
      fc.description,
      fc.brand_name,
      fc.gtin_upc,
      fc.food_category,
      fc.serving_size,
      fc.serving_unit,
      fc.household_serving_text,
      fc.calories,
      fc.protein_g,
      fc.carbohydrates_g,
      fc.fat_g,
      fc.fiber_g,
      fc.sugar_g,
      fc.saturated_fat_g,
      fc.sodium_mg,
      (
        case
          when lower(fc.description) = i.q then 1000
          when lower(fc.description) like i.q || '%' then 800
          when lower(fc.description) like '%' || i.q || '%' then 600
          else 0
        end
        + case
            when lower(coalesce(fc.brand_name, '') || ' ' || fc.description) = i.q then 900
            when lower(coalesce(fc.brand_name, '') || ' ' || fc.description) like i.q || '%' then 700
            when lower(coalesce(fc.brand_name, '') || ' ' || fc.description) like '%' || i.q || '%' then 450
            else 0
          end
        + case
            when not exists (
              select 1
              from unnest(string_to_array(i.q, ' ')) as token
              where lower(concat_ws(' ', fc.brand_name, fc.description)) not like '%' || token || '%'
            ) then 150
            else 0
          end
        + similarity(lower(fc.description), i.q) * 120
        + similarity(lower(concat_ws(' ', fc.brand_name, fc.description)), i.q) * 80
        + case fc.source_type
            when 'usda_foundation' then 30
            when 'usda_fndds' then 20
            when 'usda_branded' then 10
            else 0
          end
        + case when fc.calories is not null then 2 else 0 end
        + case when fc.protein_g is not null then 2 else 0 end
        + case when fc.carbohydrates_g is not null then 2 else 0 end
        + case when fc.fat_g is not null then 2 else 0 end
        + case when fc.serving_size is not null then 2 else 0 end
        + case when coalesce(fum.is_favorite, false) then 120 else 0 end
        + least(coalesce(fum.use_count, 0), 100) * 0.75
        + case
            when fum.last_used_at >= now() - interval '7 days' then 30
            when fum.last_used_at >= now() - interval '30 days' then 15
            else 0
          end
      )::double precision as result_rank
    from public.food_catalog fc
    cross join input i
    left join public.food_user_metadata fum
      on fum.food_id = fc.id
     and fum.user_id = auth.uid()
    where fc.status = 'active'
      and char_length(i.q) between 2 and 120
      and (
        lower(fc.description) like '%' || i.q || '%'
        or lower(coalesce(fc.brand_name, '')) like '%' || i.q || '%'
        or similarity(lower(fc.description), i.q) >= 0.16
        or similarity(lower(concat_ws(' ', fc.brand_name, fc.description)), i.q) >= 0.16
      )
  )
  select
    candidates.id,
    candidates.source_type,
    candidates.fdc_id,
    candidates.description,
    candidates.brand_name,
    candidates.gtin_upc,
    candidates.food_category,
    candidates.serving_size,
    candidates.serving_unit,
    candidates.household_serving_text,
    candidates.calories,
    candidates.protein_g,
    candidates.carbohydrates_g,
    candidates.fat_g,
    candidates.fiber_g,
    candidates.sugar_g,
    candidates.saturated_fat_g,
    candidates.sodium_mg,
    candidates.result_rank
  from candidates
  order by candidates.result_rank desc, candidates.description asc, candidates.fdc_id asc
  limit (select lim from input)
  offset (select off from input);
$$;

create or replace function public.search_food_by_barcode(input_barcode text)
returns table (
  id uuid,
  source_type text,
  fdc_id bigint,
  description text,
  brand_name text,
  gtin_upc text,
  food_category text,
  serving_size numeric,
  serving_unit text,
  household_serving_text text,
  calories numeric,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  saturated_fat_g numeric,
  sodium_mg numeric
)
language sql
stable
set search_path = public
as $$
  with input as (
    select public.normalize_food_barcode(input_barcode) as barcode
  )
  select
    fc.id,
    fc.source_type,
    fc.fdc_id,
    fc.description,
    fc.brand_name,
    fc.gtin_upc,
    fc.food_category,
    fc.serving_size,
    fc.serving_unit,
    fc.household_serving_text,
    fc.calories,
    fc.protein_g,
    fc.carbohydrates_g,
    fc.fat_g,
    fc.fiber_g,
    fc.sugar_g,
    fc.saturated_fat_g,
    fc.sodium_mg
  from public.food_catalog fc
  cross join input i
  where fc.status = 'active'
    and i.barcode is not null
    and char_length(i.barcode) between 6 and 14
    and fc.gtin_upc = i.barcode
  order by
    case when fc.source_type = 'usda_branded' then 0 else 1 end,
    case when fc.calories is not null and fc.protein_g is not null
              and fc.carbohydrates_g is not null and fc.fat_g is not null then 0 else 1 end,
    fc.modified_date desc nulls last,
    fc.fdc_id desc
  limit 5;
$$;

create or replace function public.record_food_catalog_use(input_food_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.food_user_metadata (user_id, food_id, use_count, last_used_at)
  values (auth.uid(), input_food_id, 1, now())
  on conflict (user_id, food_id)
  do update set
    use_count = public.food_user_metadata.use_count + 1,
    last_used_at = excluded.last_used_at;
end;
$$;

create or replace function public.promote_food_catalog_import(input_import_id uuid)
returns table (inserted_count bigint, updated_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  invalid_count bigint;
  existing_count bigint;
  staged_count bigint;
begin
  select count(*) into staged_count
  from public.food_catalog_staging
  where import_id = input_import_id;

  if staged_count = 0 then
    raise exception 'Import % has no staged records', input_import_id;
  end if;

  select count(*) into invalid_count
  from public.food_catalog_staging s
  where s.import_id = input_import_id
    and (
      s.fdc_id is null
      or btrim(s.description) = ''
      or s.source_type not in ('usda_foundation', 'usda_fndds', 'usda_branded')
      or (s.calories is not null and s.calories < 0)
      or (s.protein_g is not null and s.protein_g < 0)
      or (s.carbohydrates_g is not null and s.carbohydrates_g < 0)
      or (s.fat_g is not null and s.fat_g < 0)
      or (s.serving_size is not null and s.serving_size <= 0)
      or (
        s.gtin_upc is not null
        and char_length(public.normalize_food_barcode(s.gtin_upc)) not between 6 and 14
      )
    );

  if invalid_count > 0 then
    update public.food_data_imports
    set status = 'failed',
        completed_at = now(),
        records_rejected = invalid_count,
        error_summary = format('%s staged records failed validation', invalid_count)
    where id = input_import_id;

    raise exception 'Import % has % invalid staged records', input_import_id, invalid_count;
  end if;

  select count(*) into existing_count
  from public.food_catalog fc
  join public.food_catalog_staging s on s.fdc_id = fc.fdc_id
  where s.import_id = input_import_id;

  insert into public.food_catalog (
    fdc_id,
    source_type,
    description,
    brand_owner,
    brand_name,
    gtin_upc,
    food_category,
    serving_size,
    serving_unit,
    household_serving_text,
    calories,
    protein_g,
    carbohydrates_g,
    fat_g,
    fiber_g,
    sugar_g,
    saturated_fat_g,
    sodium_mg,
    nutrient_data,
    publication_date,
    available_date,
    modified_date,
    status,
    imported_at,
    updated_at
  )
  select
    s.fdc_id,
    s.source_type,
    s.description,
    s.brand_owner,
    s.brand_name,
    public.normalize_food_barcode(s.gtin_upc),
    s.food_category,
    s.serving_size,
    s.serving_unit,
    s.household_serving_text,
    s.calories,
    s.protein_g,
    s.carbohydrates_g,
    s.fat_g,
    s.fiber_g,
    s.sugar_g,
    s.saturated_fat_g,
    s.sodium_mg,
    s.nutrient_data,
    s.publication_date,
    s.available_date,
    s.modified_date,
    'active',
    now(),
    now()
  from public.food_catalog_staging s
  where s.import_id = input_import_id
  on conflict (fdc_id) do update set
    source_type = excluded.source_type,
    description = excluded.description,
    brand_owner = excluded.brand_owner,
    brand_name = excluded.brand_name,
    gtin_upc = excluded.gtin_upc,
    food_category = excluded.food_category,
    serving_size = excluded.serving_size,
    serving_unit = excluded.serving_unit,
    household_serving_text = excluded.household_serving_text,
    calories = excluded.calories,
    protein_g = excluded.protein_g,
    carbohydrates_g = excluded.carbohydrates_g,
    fat_g = excluded.fat_g,
    fiber_g = excluded.fiber_g,
    sugar_g = excluded.sugar_g,
    saturated_fat_g = excluded.saturated_fat_g,
    sodium_mg = excluded.sodium_mg,
    nutrient_data = excluded.nutrient_data,
    publication_date = excluded.publication_date,
    available_date = excluded.available_date,
    modified_date = excluded.modified_date,
    status = 'active',
    updated_at = now();

  update public.food_data_imports
  set completed_at = now(),
      records_read = staged_count,
      records_inserted = staged_count - existing_count,
      records_updated = existing_count,
      status = 'completed',
      error_summary = null
  where id = input_import_id;

  delete from public.food_catalog_staging
  where import_id = input_import_id;

  return query select staged_count - existing_count, existing_count;
end;
$$;

-- Preserve immutable meal nutrition snapshots while allowing foods from the
-- new catalog and custom-food table to be referenced without violating the
-- legacy public.foods foreign key.
alter table public.meal_items
  add column if not exists food_source text,
  add column if not exists source_food_id text,
  add column if not exists fdc_id bigint,
  add column if not exists fiber_g numeric,
  add column if not exists sugar_g numeric,
  add column if not exists saturated_fat_g numeric,
  add column if not exists sodium_mg numeric;

revoke all on public.food_catalog_staging from anon, authenticated;
revoke all on public.food_data_imports from anon, authenticated;
revoke all on function public.promote_food_catalog_import(uuid) from public, anon, authenticated;
grant execute on function public.promote_food_catalog_import(uuid) to service_role;

grant execute on function public.search_food_catalog(text, integer, integer) to anon, authenticated;
grant execute on function public.search_food_by_barcode(text) to anon, authenticated;
grant execute on function public.normalize_food_barcode(text) to anon, authenticated;
grant execute on function public.record_food_catalog_use(uuid) to authenticated;
