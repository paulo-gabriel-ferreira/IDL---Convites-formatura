# Convites IDL

Site de convites individuais da Banca Final IDL Tech.

- `/` é o painel: cria, edita e acompanha os convites (precisa de login).
- `/c/nome-do-convidado-xxxx` é o convite que o convidado recebe.

## 1. Supabase (banco de dados)

1. Crie um projeto em supabase.com (plano gratuito).
2. Vá em **SQL Editor > New query**, cole todo o arquivo `supabase/schema.sql` e clique em **Run**.
3. Vá em **Authentication > Users > Add user > Create new user**, coloque o e-mail e a senha que vão entrar no painel e marque **Auto Confirm User**. Repita para cada pessoa da equipe que vai usar.
4. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. Assim ninguém cria conta sozinho.
5. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

## 2. Ligar o site ao banco

Abra `js/config.js` e cole a URL e a chave nos lugares indicados.

## 3. Vercel (hospedagem)

1. Suba esta pasta para um repositório no GitHub.
2. Em vercel.com, clique em **Add New > Project**, escolha o repositório e clique em **Deploy**. Não precisa mudar nenhuma configuração.
3. Pronto: o painel fica em `https://seu-projeto.vercel.app` e cada convite em `https://seu-projeto.vercel.app/c/...`.

## Onde mudar cada coisa

- Nome, data, horário, local, WhatsApp e mensagens: no painel, em **Dados do evento**. Muda em todos os convites na hora, inclusive nos já enviados.
- Texto de um convite: no painel, abrindo o convite.
- Texto padrão de cada público (o que já vem preenchido): `js/modelos.js`.
- Visual do convite: `convite.html`.
