-- =====================================================================
-- Convites IDL — banco de dados (Supabase)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Pode rodar de novo sem problema: não apaga convites já criados.
-- =====================================================================

-- ---------- Dados do evento (uma linha só, vale para todos os convites)
create table if not exists public.evento (
  id              int primary key default 1 check (id = 1),
  nome            text not null default 'Banca Final IDL Tech',
  subtitulo       text not null default 'Encerramento da Trilha 2026',
  dia_semana      text not null default 'Sábado',
  dia             text not null default '14',
  mes             text not null default 'de novembro',
  hora_inicio     text not null default '8h',
  hora_fim        text not null default 'às 13h',
  local_nome      text not null default 'Sebrae Prado Velho',
  local_endereco  text not null default 'Rua Cyro Vellozo, 59 - Prado Velho, Curitiba - PR, 80220-300',
  whatsapp        text not null default '5511917041808',
  mensagem_rsvp   text not null default 'Olá! Quero confirmar presença na Banca Final IDL Tech, no dia 14/11. Convite: {nome}',
  mensagem_envio  text not null default 'Olá! O Instituto Dente de Leão preparou um convite para você. É só abrir o link: {link}',
  atualizado_em   timestamptz not null default now()
);
insert into public.evento (id) values (1) on conflict (id) do nothing;

-- ---------- Convites (um por convidado)
create table if not exists public.convites (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nome              text not null,
  publico           text not null default 'especial',
  chamada           text not null default 'Convite para',
  titulo_a          text not null default '',
  titulo_b          text not null default '',
  saudacao          text not null default '',
  paragrafos        text not null default '',
  despedida         text not null default '',
  pergunta          text not null default '',
  anotacao          text not null default '',   -- só aparece no painel, nunca no convite
  enviado_em        timestamptz,
  aberturas         int not null default 0,
  primeira_abertura timestamptz,
  ultima_abertura   timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists convites_criado_em_idx on public.convites (criado_em desc);

-- ---------- Atualiza "atualizado_em" sozinho
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

drop trigger if exists convites_tocar on public.convites;
create trigger convites_tocar before update on public.convites
for each row execute function public.tocar_atualizado_em();

drop trigger if exists evento_tocar on public.evento;
create trigger evento_tocar before update on public.evento
for each row execute function public.tocar_atualizado_em();

-- ---------- Segurança
-- Só quem entra no painel (com login) lê e edita as tabelas.
-- Quem recebe o link NÃO consegue listar os convites: só abre o próprio.
alter table public.evento   enable row level security;
alter table public.convites enable row level security;

drop policy if exists "painel evento"   on public.evento;
drop policy if exists "painel convites" on public.convites;
create policy "painel evento"   on public.evento   for all to authenticated using (true) with check (true);
create policy "painel convites" on public.convites for all to authenticated using (true) with check (true);

-- ---------- Função pública: abre um convite pelo link
-- Devolve o convite + os dados do evento e conta a abertura.
-- (p_registrar = false quando quem abre é o próprio painel)
create or replace function public.abrir_convite(p_slug text, p_registrar boolean default true)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare c public.convites%rowtype; e public.evento%rowtype;
begin
  select * into c from public.convites where slug = p_slug;
  if not found then return null; end if;
  select * into e from public.evento where id = 1;

  if p_registrar then
    update public.convites
       set aberturas = aberturas + 1,
           primeira_abertura = coalesce(primeira_abertura, now()),
           ultima_abertura = now()
     where id = c.id;
  end if;

  return json_build_object(
    'convite', json_build_object(
      'nome', c.nome, 'chamada', c.chamada, 'titulo_a', c.titulo_a, 'titulo_b', c.titulo_b,
      'saudacao', c.saudacao, 'paragrafos', c.paragrafos, 'despedida', c.despedida, 'pergunta', c.pergunta),
    'evento', json_build_object(
      'nome', e.nome, 'subtitulo', e.subtitulo, 'dia_semana', e.dia_semana, 'dia', e.dia, 'mes', e.mes,
      'hora_inicio', e.hora_inicio, 'hora_fim', e.hora_fim, 'local_nome', e.local_nome,
      'local_endereco', e.local_endereco, 'whatsapp', e.whatsapp, 'mensagem_rsvp', e.mensagem_rsvp)
  );
end $$;

revoke all on function public.abrir_convite(text, boolean) from public;
grant execute on function public.abrir_convite(text, boolean) to anon, authenticated;
