-- Additive extension of the existing owner-protected coach settings.
-- Null means unset. Existing protein targets and AI preferences stay unchanged.
alter table public.ai_coach_settings
 add column carbs_goal numeric check (carbs_goal > 0 and carbs_goal <= 1000),
 add column fat_goal numeric check (fat_goal > 0 and fat_goal <= 500);

comment on column public.ai_coach_settings.carbs_goal is 'User-entered daily carbohydrate goal in grams; null means unset.';
comment on column public.ai_coach_settings.fat_goal is 'User-entered daily fat goal in grams; null means unset.';
