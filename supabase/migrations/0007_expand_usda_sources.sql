alter table public.food_catalog
  drop constraint if exists food_catalog_source_type_check;

alter table public.food_catalog
  add constraint food_catalog_source_type_check
  check (source_type in (
    'usda_foundation',
    'usda_fndds',
    'usda_branded',
    'usda_sr_legacy',
    'usda_experimental'
  ));

alter table public.food_catalog_staging
  drop constraint if exists food_catalog_staging_source_type_check;

alter table public.food_catalog_staging
  add constraint food_catalog_staging_source_type_check
  check (source_type in (
    'usda_foundation',
    'usda_fndds',
    'usda_branded',
    'usda_sr_legacy',
    'usda_experimental'
  ));
