-- ─────────────────────────────────────────────────────────────────────────────
-- Obituaries: family relations become free text ("wife of" + "Late Abdul Qadir").
-- Run once in Supabase SQL Editor, AFTER obituaries_migration.sql. Safe to re-run.
-- (Replaces one function; no data changes. Older posts keep working.)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public._obit_clean(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
  v_passed  date;
  v_janaza  date;
  v_gender  text := lower(coalesce(p ->> 'gender', ''));
  v_rels    jsonb := '[]'::jsonb;
  v_rel     jsonb;
  v_relname text;
  v_label   text;
  v_age     integer;
  v_kind    text := nullif(lower(coalesce(p ->> 'leaves_from_kind', '')), '');
  v_mobile  text := regexp_replace(coalesce(p ->> 'poster_mobile', ''), '[^0-9+]', '', 'g');
begin
  if v_gender not in ('male', 'female') then
    raise exception 'Please choose male or female.';
  end if;

  begin
    v_passed := (p ->> 'passed_on')::date;
  exception when others then
    raise exception 'Please enter a valid date of passing.';
  end;
  if v_passed is null then raise exception 'Please enter the date of passing.'; end if;
  if v_passed > v_today + 1 or v_passed < v_today - 30 then
    raise exception 'The date of passing must be within the last 30 days.';
  end if;

  if nullif(p ->> 'janaza_date', '') is not null then
    begin
      v_janaza := (p ->> 'janaza_date')::date;
    exception when others then
      raise exception 'Please enter a valid janaza date.';
    end;
    if v_janaza < v_passed or v_janaza > v_passed + 4 then
      raise exception 'The janaza date should be within a few days of the date of passing.';
    end if;
  end if;

  if nullif(p ->> 'age', '') is not null then
    begin
      v_age := (p ->> 'age')::integer;
    exception when others then
      raise exception 'Please enter the age as a number.';
    end;
    if v_age < 0 or v_age > 130 then raise exception 'Please enter a valid age.'; end if;
  end if;

  if v_kind is not null and v_kind not in ('residence', 'other') then v_kind := null; end if;

  if jsonb_typeof(coalesce(p -> 'relations', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid family relations.';
  end if;
  if jsonb_array_length(coalesce(p -> 'relations', '[]'::jsonb)) > 8 then
    raise exception 'Please list at most 8 family relations.';
  end if;
  for v_rel in select * from jsonb_array_elements(coalesce(p -> 'relations', '[]'::jsonb)) loop
    -- Free text, e.g. label "wife of" + name "Late Abdul Qadir". (Older posts used {rel, late}.)
    v_label   := coalesce(public._obit_text(v_rel, 'label', 40, 'Relation'),
                          nullif(lower(btrim(coalesce(v_rel ->> 'rel', ''))), ''));
    v_relname := public._obit_text(v_rel, 'name', 80, 'Relative''s name');
    if v_label is null and v_relname is null then continue; end if;
    if v_label is null or v_relname is null then
      raise exception 'Please fill both parts of each family line (for example "wife of" and the name).';
    end if;
    if coalesce((v_rel ->> 'late')::boolean, false) and v_relname !~* '^late\s' then
      v_relname := 'Late ' || v_relname;
    end if;
    v_rels := v_rels || jsonb_build_array(jsonb_build_object('label', v_label, 'name', v_relname));
  end loop;

  if char_length(v_mobile) < 8 or char_length(v_mobile) > 16 then
    raise exception 'Please enter your mobile number (it is kept private).';
  end if;

  return jsonb_build_object(
    'honorific',         public._obit_text(p, 'honorific', 20, 'Title'),
    'name',              public._obit_text(p, 'name', 80, 'Name', true),
    'gender',            v_gender,
    'relations',         v_rels,
    'city',              public._obit_text(p, 'city', 60, 'City', true),
    'residence_area',    public._obit_text(p, 'residence_area', 60, 'Area'),
    'native_place',      public._obit_text(p, 'native_place', 60, 'Native place'),
    'age',               v_age,
    'passed_on',         v_passed,
    'janaza_date',       v_janaza,
    'janaza_place',      public._obit_text(p, 'janaza_place', 120, 'Janaza place'),
    'janaza_timing',     public._obit_text(p, 'janaza_timing', 120, 'Janaza timing'),
    'leaves_from_kind',  v_kind,
    'leaves_from_other', public._obit_text(p, 'leaves_from_other', 120, 'Place the janaza leaves from'),
    'leaves_from_time',  public._obit_text(p, 'leaves_from_time', 40, 'Time the janaza leaves'),
    'burial_text',       public._obit_text(p, 'burial_text', 120, 'Burial place'),
    'message',           public._obit_text(p, 'message', 500, 'Message'),
    'poster_name',       public._obit_text(p, 'poster_name', 60, 'Your name', true),
    'poster_relation',   public._obit_text(p, 'poster_relation', 40, 'Your relationship'),
    'poster_mobile',     v_mobile
  );
end;
$$;
