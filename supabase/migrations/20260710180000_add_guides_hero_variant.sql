-- 20260710180000_add_guides_hero_variant.sql
-- Give `guides` the one field the prototype renders that the table never modelled.
--
-- GuidesHubScreen and GuideArticleScreen both draw their hero with
-- `<HeroImage variant={g.heroVariant} />`. There are no photographs yet — the
-- hero is a generated SVG whose look is chosen by a variant name ('default',
-- 'artcaffe', 'talisman'). `hero_image_url` is the column for the day real
-- photography exists; until then the variant is the actual editorial choice, and
-- it has to survive the round trip through the database or every guide renders
-- with the same hero.
--
-- Nullable with no default: a guide without a variant falls back to 'default' in
-- the mapper, exactly as the prototype's `HeroImage` already does.
ALTER TABLE guides ADD COLUMN hero_variant text;

COMMENT ON COLUMN guides.hero_variant IS
  'HeroImage variant name for the generated SVG hero. Superseded by hero_image_url once real photography exists.';
