create table if not exists public.html_files (
  id text primary key,
  name text not null,
  content text not null,
  saved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create extension if not exists pgcrypto with schema extensions;

grant usage on schema public to anon;
grant select, insert, update, delete on public.html_files to anon;

alter table public.html_files enable row level security;

drop policy if exists "Allow public read html files" on public.html_files;
create policy "Allow public read html files"
on public.html_files
for select
to anon
using (true);

drop policy if exists "Allow public insert html files" on public.html_files;
create policy "Allow public insert html files"
on public.html_files
for insert
to anon
with check (true);

drop policy if exists "Allow public update html files" on public.html_files;
create policy "Allow public update html files"
on public.html_files
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public delete html files" on public.html_files;
create policy "Allow public delete html files"
on public.html_files
for delete
to anon
using (true);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('student', 'teacher')),
  session_token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  session_created_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.app_users
add column if not exists session_token text not null default encode(extensions.gen_random_bytes(32), 'hex');

alter table public.app_users
add column if not exists session_created_at timestamptz not null default now();

alter table public.app_users enable row level security;

drop function if exists public.digitxt_sign_up(text, text, text);
create or replace function public.digitxt_sign_up(
  p_password text,
  p_role text,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_username text := lower(trim(p_username));
begin
  if v_username = '' or length(v_username) < 3 then
    raise exception 'Username must be at least 3 characters.';
  end if;

  if p_password is null or length(p_password) < 4 then
    raise exception 'Password must be at least 4 characters.';
  end if;

  if p_role not in ('student', 'teacher') then
    raise exception 'Choose student or teacher.';
  end if;

  insert into public.app_users (username, password_hash, role)
  values (v_username, extensions.crypt(p_password, extensions.gen_salt('bf')), p_role)
  returning * into v_user;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role,
    'sessionToken', v_user.session_token,
    'createdAt', v_user.created_at
  );
exception
  when unique_violation then
    raise exception 'That username is already taken.';
end;
$$;

drop function if exists public.digitxt_sign_in(text, text);
create or replace function public.digitxt_sign_in(
  p_password text,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_username text := lower(trim(p_username));
begin
  select *
  into v_user
  from public.app_users
  where username = v_username
    and password_hash = extensions.crypt(p_password, password_hash);

  if v_user.id is null then
    raise exception 'Invalid username or password.';
  end if;

  update public.app_users
  set
    session_token = encode(extensions.gen_random_bytes(32), 'hex'),
    session_created_at = now()
  where id = v_user.id
  returning * into v_user;

  return jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role,
    'sessionToken', v_user.session_token,
    'createdAt', v_user.created_at
  );
end;
$$;

grant execute on function public.digitxt_sign_up(text, text, text) to anon;
grant execute on function public.digitxt_sign_in(text, text) to anon;

create table if not exists public.chapter_books (
  id text primary key,
  title text not null,
  author text,
  year text,
  cover_image text,
  file_name text,
  content text not null,
  contents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);

alter table public.chapter_books
add column if not exists author text,
add column if not exists year text,
add column if not exists cover_image text,
add column if not exists file_name text,
add column if not exists content text not null default '',
add column if not exists contents jsonb not null default '[]'::jsonb,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists saved_at timestamptz not null default now();

grant select, insert, update, delete on public.chapter_books to anon;

alter table public.chapter_books enable row level security;

drop policy if exists "Allow public read chapter books" on public.chapter_books;
create policy "Allow public read chapter books"
on public.chapter_books
for select
to anon
using (true);

drop policy if exists "Allow public insert chapter books" on public.chapter_books;
create policy "Allow public insert chapter books"
on public.chapter_books
for insert
to anon
with check (true);

drop policy if exists "Allow public update chapter books" on public.chapter_books;
create policy "Allow public update chapter books"
on public.chapter_books
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public delete chapter books" on public.chapter_books;
create policy "Allow public delete chapter books"
on public.chapter_books
for delete
to anon
using (true);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  chapter_book_id text not null references public.chapter_books(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (user_id, chapter_book_id)
);

grant select, insert, update, delete on public.student_enrollments to anon;

alter table public.student_enrollments enable row level security;

drop policy if exists "Allow public read student enrollments" on public.student_enrollments;
create policy "Allow public read student enrollments"
on public.student_enrollments
for select
to anon
using (true);

drop policy if exists "Allow public insert student enrollments" on public.student_enrollments;
create policy "Allow public insert student enrollments"
on public.student_enrollments
for insert
to anon
with check (true);

drop policy if exists "Allow public update student enrollments" on public.student_enrollments;
create policy "Allow public update student enrollments"
on public.student_enrollments
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public delete student enrollments" on public.student_enrollments;
create policy "Allow public delete student enrollments"
on public.student_enrollments
for delete
to anon
using (true);

create table if not exists public.student_activity_saves (
  id text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  chapter_book_id text references public.chapter_books(id) on delete set null,
  chapter_id text,
  book_title text,
  chapter_title text,
  content text not null,
  activity_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);

alter table public.student_activity_saves
add column if not exists updated_at timestamptz not null default now();

delete from public.student_activity_saves s
using (
  select
    id,
    row_number() over (
      partition by user_id, chapter_book_id, chapter_id
      order by updated_at desc, saved_at desc
    ) as copy_rank
  from public.student_activity_saves
) ranked
where s.id = ranked.id
  and ranked.copy_rank > 1;

create unique index if not exists student_activity_saves_student_chapter_idx
on public.student_activity_saves (user_id, chapter_book_id, chapter_id);

revoke all on public.student_activity_saves from anon;

alter table public.student_activity_saves enable row level security;

drop policy if exists "Allow public read student activity saves" on public.student_activity_saves;

drop policy if exists "Allow public insert student activity saves" on public.student_activity_saves;

drop policy if exists "Allow public update student activity saves" on public.student_activity_saves;

drop function if exists public.digitxt_save_student_activity(jsonb, text, text, text, text, text, jsonb, text);
create or replace function public.digitxt_save_student_activity(
  p_activity_state jsonb,
  p_book_title text,
  p_chapter_book_id text,
  p_chapter_id text,
  p_chapter_title text,
  p_content text,
  p_metadata jsonb,
  p_session_token text
)
returns public.student_activity_saves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_save public.student_activity_saves;
begin
  select *
  into v_user
  from public.app_users
  where session_token = p_session_token
    and role = 'student';

  if v_user.id is null then
    raise exception 'Please sign in as a student before saving activity.';
  end if;

  insert into public.student_activity_saves (
    id,
    user_id,
    chapter_book_id,
    chapter_id,
    book_title,
    chapter_title,
    content,
    activity_state,
    metadata,
    updated_at
  )
  values (
    extract(epoch from clock_timestamp())::text || '-' || encode(extensions.gen_random_bytes(8), 'hex'),
    v_user.id,
    nullif(p_chapter_book_id, ''),
    p_chapter_id,
    p_book_title,
    p_chapter_title,
    p_content,
    coalesce(p_activity_state, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (user_id, chapter_book_id, chapter_id)
  do update set
    book_title = excluded.book_title,
    chapter_title = excluded.chapter_title,
    content = excluded.content,
    activity_state = excluded.activity_state,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into v_save;

  return v_save;
end;
$$;

drop function if exists public.digitxt_list_student_activity_saves(uuid);
drop function if exists public.digitxt_list_student_activity_saves(text);
create or replace function public.digitxt_list_student_activity_saves(
  p_session_token text
)
returns table (
  id text,
  user_id uuid,
  chapter_book_id text,
  chapter_id text,
  book_title text,
  chapter_title text,
  content text,
  activity_state jsonb,
  metadata jsonb,
  saved_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.user_id,
    s.chapter_book_id,
    s.chapter_id,
    s.book_title,
    s.chapter_title,
    s.content,
    s.activity_state,
    s.metadata,
    s.saved_at,
    s.updated_at
  from public.student_activity_saves s
  join public.app_users u
    on u.id = s.user_id
  where u.session_token = p_session_token
    and u.role = 'student'
  order by s.updated_at desc;
$$;

drop function if exists public.digitxt_ensure_student_book_copy(text, text);
create or replace function public.digitxt_ensure_student_book_copy(
  p_chapter_book_id text,
  p_session_token text
)
returns setof public.student_activity_saves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_book public.chapter_books;
begin
  select *
  into v_user
  from public.app_users
  where session_token = p_session_token
    and role = 'student';

  if v_user.id is null then
    raise exception 'Please sign in as a student before opening this chapter book.';
  end if;

  select *
  into v_book
  from public.chapter_books
  where id = p_chapter_book_id;

  if v_book.id is null then
    raise exception 'This chapter book could not be found.';
  end if;

  insert into public.student_activity_saves (
    id,
    user_id,
    chapter_book_id,
    chapter_id,
    book_title,
    chapter_title,
    content,
    activity_state,
    metadata,
    updated_at
  )
  select
    extract(epoch from clock_timestamp())::text || '-' || encode(extensions.gen_random_bytes(8), 'hex') || '-' || chapter_number::text,
    v_user.id,
    v_book.id,
    coalesce(nullif(chapter_item->>'id', ''), 'chapter-' || chapter_number::text),
    v_book.title,
    coalesce(nullif(chapter_item->>'title', ''), 'Chapter ' || chapter_number::text),
    '',
    jsonb_build_object(
      'studentBookCopy', true,
      'seededFromBookOpen', true,
      'notes', ''
    ),
    jsonb_build_object(
      'originalSavedAt', coalesce(chapter_item->>'savedAt', ''),
      'copiedAt', now(),
      'noteOnly', true
    ),
    now()
  from jsonb_array_elements(v_book.contents) with ordinality as chapters(chapter_item, chapter_number)
  on conflict (user_id, chapter_book_id, chapter_id)
  do nothing;

  return query
  select *
  from public.student_activity_saves
  where user_id = v_user.id
    and chapter_book_id = v_book.id
  order by updated_at desc, saved_at desc;
end;
$$;

drop function if exists public.digitxt_delete_student_activity_save(text, text);
create or replace function public.digitxt_delete_student_activity_save(
  p_activity_id text,
  p_session_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  select *
  into v_user
  from public.app_users
  where session_token = p_session_token
    and role = 'student';

  if v_user.id is null then
    raise exception 'Please sign in as a student before deleting saved activity.';
  end if;

  delete from public.student_activity_saves
  where id = p_activity_id
    and user_id = v_user.id;
end;
$$;

grant execute on function public.digitxt_save_student_activity(jsonb, text, text, text, text, text, jsonb, text) to anon;
grant execute on function public.digitxt_list_student_activity_saves(text) to anon;
grant execute on function public.digitxt_ensure_student_book_copy(text, text) to anon;
grant execute on function public.digitxt_delete_student_activity_save(text, text) to anon;

notify pgrst, 'reload schema';
