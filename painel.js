(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var cfg = window.CONVITES_CONFIG || {};
  var configurado = !!(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_URL.indexOf('SEU-PROJETO') === -1);
  var db = configurado ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  var EVENTO_PADRAO = {
    nome: 'Banca Final IDL Tech', subtitulo: 'Encerramento da Trilha 2026',
    dia_semana: 'Sábado', dia: '14', mes: 'de novembro', hora_inicio: '8h', hora_fim: 'às 13h',
    local_nome: 'Sebrae Prado Velho', local_endereco: 'Rua Cyro Vellozo, 59 - Prado Velho, Curitiba - PR, 80220-300',
    whatsapp: '5511917041808',
    mensagem_rsvp: 'Olá! Quero confirmar presença na Banca Final IDL Tech, no dia 14/11. Convite: {nome}',
    mensagem_envio: 'Olá! O Instituto Dente de Leão preparou um convite para você. É só abrir o link: {link}'
  };

  var st = {
    convites: [],
    evento: Object.assign({}, EVENTO_PADRAO),
    atual: null,          // convite aberto no editor (como está no banco) ou null se for novo
    sujo: false,
    modeloAnterior: null  // textos do modelo aplicado por último
  };

  // ------------------------------------------------------------------ utilidades
  function aviso(txt) {
    var el = $('#aviso');
    el.textContent = txt;
    el.classList.add('on');
    clearTimeout(aviso.t);
    aviso.t = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }
  function troca(txt, mapa) {
    var s = String(txt || '');
    Object.keys(mapa).forEach(function (k) { s = s.split('{' + k + '}').join(mapa[k]); });
    return s;
  }
  function data(d) { return d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
  function dataHora(d) {
    if (!d) return '';
    var x = new Date(d);
    return x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function normalizar(n) {
    return String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function slugify(n) {
    return normalizar(n).replace(/ /g, '-').slice(0, 40).replace(/-+$/, '') || 'convite';
  }
  function novoSlug(nome) {
    var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    crypto.getRandomValues(new Uint8Array(4)).forEach(function (x) { s += a[x % a.length]; });
    return slugify(nome) + '-' + s;
  }
  function linkDe(c) { return location.origin + '/c/' + c.slug; }
  function copiar(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    var t = document.createElement('textarea');
    t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
    return Promise.resolve();
  }
  function rotulo(publico) { return (window.MODELOS[publico] || window.MODELOS.especial).rotulo; }
  function erroDb(e) {
    console.error(e);
    aviso('Não foi possível salvar. Confira a internet e tente de novo.');
  }

  // ------------------------------------------------------------------ navegação
  function mostrar(v) {
    ['login', 'lista', 'editor', 'evento'].forEach(function (n) { $('#v-' + n).hidden = n !== v; });
    $('#topo').hidden = v === 'login';
    window.scrollTo(0, 0);
  }
  function ir(rota) {
    if (st.sujo && !confirm('Há alterações não salvas neste convite. Sair mesmo assim?')) return;
    st.sujo = false;
    if (location.hash === '#' + rota) rotear(); else location.hash = rota;
  }
  function rotear() {
    var h = location.hash.replace(/^#/, '') || '/';
    if (h === '/evento') { abrirEvento(); return; }
    if (h === '/novo') { abrirEditor(null); return; }
    var m = h.match(/^\/convite\/(.+)$/);
    if (m) {
      var c = st.convites.find(function (x) { return x.id === m[1]; });
      if (c) { abrirEditor(c); return; }
    }
    renderLista();
    mostrar('lista');
  }
  var pularRota = false;
  window.addEventListener('hashchange', function () { if (!pularRota) rotear(); pularRota = false; });
  // muda o endereço sem reabrir a tela (usado depois de salvar ou duplicar)
  function trocarEndereco(rota) {
    if (location.hash === '#' + rota) return;
    pularRota = true;
    location.hash = rota;
  }
  window.addEventListener('beforeunload', function (e) { if (st.sujo) { e.preventDefault(); e.returnValue = ''; } });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (!b) return;
    e.preventDefault();
    var alvo = b.dataset.ir;
    ir(alvo === 'lista' ? '/' : '/' + alvo);
  });

  // ------------------------------------------------------------------ login
  $('#f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#login-erro'), btn = $('button', f);
    err.hidden = true; btn.disabled = true; btn.textContent = 'Entrando…';
    db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Entrar';
      if (r.error) {
        err.textContent = /invalid/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar: ' + r.error.message;
        err.hidden = false; return;
      }
      f.senha.value = '';
      iniciar();
    });
  });
  $('#sair').addEventListener('click', function () {
    if (st.sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    st.sujo = false;
    db.auth.signOut().then(function () { mostrar('login'); });
  });

  // ------------------------------------------------------------------ dados
  function carregar() {
    return Promise.all([
      db.from('convites').select('*').order('criado_em', { ascending: false }),
      db.from('evento').select('*').eq('id', 1).maybeSingle()
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      st.convites = r[0].data || [];
      if (r[1].data) st.evento = Object.assign({}, EVENTO_PADRAO, r[1].data);
    });
  }
  function substituir(c) {
    var i = st.convites.findIndex(function (x) { return x.id === c.id; });
    if (i > -1) st.convites[i] = c; else st.convites.unshift(c);
  }
  function marcarEnviado(c, enviado) {
    return db.from('convites').update({ enviado_em: enviado ? new Date().toISOString() : null })
      .eq('id', c.id).select().single().then(function (r) {
        if (r.error) { erroDb(r.error); return c; }
        substituir(r.data);
        return r.data;
      });
  }
  function enviarZap(c) {
    var msg = troca(st.evento.mensagem_envio, { nome: c.nome, link: linkDe(c) });
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    if (!c.enviado_em) return marcarEnviado(c, true);
    return Promise.resolve(c);
  }

  // ------------------------------------------------------------------ lista
  function situacao(c) {
    if (c.aberturas > 0) return { cls: 'aberto', txt: 'Aberto' };
    if (c.enviado_em) return { cls: 'enviado', txt: 'Enviado' };
    return { cls: '', txt: 'Não enviado' };
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function renderLista() {
    var busca = normalizar($('#busca').value);
    var pub = $('#f-publico').value, sit = $('#f-situacao').value;
    var todos = st.convites;

    var env = todos.filter(function (c) { return c.enviado_em; }).length;
    var abe = todos.filter(function (c) { return c.aberturas > 0; }).length;
    $('#resumo').textContent = todos.length
      ? plural(todos.length, 'convite', 'convites') + ', ' + plural(env, 'enviado', 'enviados') + ' e ' + plural(abe, 'aberto', 'abertos') + ' pelo convidado.'
      : 'Nenhum convite criado ainda.';

    var lista = todos.filter(function (c) {
      if (pub && c.publico !== pub) return false;
      if (sit === 'nao' && c.enviado_em) return false;
      if (sit === 'enviado' && !c.enviado_em) return false;
      if (sit === 'aberto' && !(c.aberturas > 0)) return false;
      if (busca && normalizar(c.nome + ' ' + c.anotacao).indexOf(busca) === -1) return false;
      return true;
    });

    var ul = $('#lista');
    ul.innerHTML = '';
    lista.forEach(function (c) {
      var s = situacao(c);
      var li = document.createElement('li');
      li.className = 'item';
      li.tabIndex = 0;
      li.innerHTML =
        '<div><div class="item-nome"></div><div class="item-meta"></div></div>' +
        '<span class="chip ' + s.cls + '"></span>' +
        '<div class="item-acoes"><button class="btn sec" data-a="copiar">Copiar link</button><button class="btn sec" data-a="zap">WhatsApp</button></div>';
      $('.item-nome', li).textContent = c.nome;
      $('.item-meta', li).textContent = rotulo(c.publico) + ', criado em ' + data(c.criado_em) + (c.anotacao ? '. ' + c.anotacao : '');
      $('.chip', li).textContent = s.txt;
      if (c.aberturas > 0) $('.chip', li).title = 'Aberto ' + plural(c.aberturas, 'vez', 'vezes') + ', a última em ' + dataHora(c.ultima_abertura);

      li.addEventListener('click', function (e) {
        var a = e.target.closest('[data-a]');
        if (!a) { ir('/convite/' + c.id); return; }
        e.stopPropagation();
        if (a.dataset.a === 'copiar') copiar(linkDe(c)).then(function () { aviso('Link copiado'); });
        if (a.dataset.a === 'zap') enviarZap(c).then(renderLista);
      });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === li) ir('/convite/' + c.id); });
      ul.appendChild(li);
    });

    var vazio = $('#vazio');
    vazio.hidden = lista.length > 0;
    if (!lista.length) {
      vazio.innerHTML = todos.length
        ? '<div><strong>Nenhum convite com esses filtros</strong>Limpe a busca ou escolha outro público.</div>'
        : '<img src="/assets/simbolo.png" alt=""><div><strong>Crie o primeiro convite</strong>Cada convite ganha um link próprio para enviar ao convidado.</div><button class="btn prim" data-ir="novo">Novo convite</button>';
    }
  }
  ['#busca', '#f-publico', '#f-situacao'].forEach(function (s) { $(s).addEventListener('input', renderLista); });
  $('#novo').addEventListener('click', function () { ir('/novo'); });

  // opções de público nos selects
  Object.keys(window.MODELOS).forEach(function (k) {
    ['#f-publico', '#ed-publico', '#v-publico'].forEach(function (s) {
      var o = document.createElement('option'); o.value = k; o.textContent = rotulo(k); $(s).appendChild(o);
    });
  });

  // ------------------------------------------------------------------ editor
  var F = $('#f-convite');
  var CAMPOS = window.CAMPOS_TEXTO;

  function genero(form) { var r = $('input[name="genero"]:checked', form); return r ? r.value : 'o'; }
  function setGenero(form, g) { $$('input[name="genero"]', form).forEach(function (r) { r.checked = r.value === g; }); }

  function lerForm() {
    var o = { nome: F.nome.value.trim(), publico: F.publico.value, anotacao: F.anotacao.value.trim() };
    CAMPOS.forEach(function (k) { o[k] = F[k].value; });
    return o;
  }
  function aplicarTextos(t) { CAMPOS.forEach(function (k) { F[k].value = t[k] || ''; }); }
  function textosIguais(a) {
    var atual = lerForm();
    return CAMPOS.every(function (k) { return (atual[k] || '').trim() === (a[k] || '').trim(); });
  }
  function atualizarAvisoModelo() {
    var modelo = window.textosDoModelo(F.publico.value, genero(F));
    $('#ed-modelo-aviso').hidden = textosIguais(modelo);
  }
  function ajustarCamposPublico() {
    var m = window.MODELOS[F.publico.value];
    $('#ed-nome-rot').textContent = m.campoNome;
    $('#ed-trat-box').style.visibility = m.tratamento ? 'visible' : 'hidden';
  }
  function trocarModelo() {
    var novo = window.textosDoModelo(F.publico.value, genero(F));
    var editado = st.modeloAnterior && !textosIguais(st.modeloAnterior);
    if (!editado || confirm('Trocar os textos pelo modelo de ' + rotulo(F.publico.value) + '? As edições que você fez nos textos serão substituídas.')) {
      aplicarTextos(novo);
    }
    st.modeloAnterior = novo;
    ajustarCamposPublico();
    alterou();
  }
  F.publico.addEventListener('change', trocarModelo);
  $$('input[name="genero"]', F).forEach(function (r) { r.addEventListener('change', trocarModelo); });
  $('#ed-reaplicar').addEventListener('click', function () {
    if (!confirm('Voltar ao texto padrão? As edições que você fez nos textos serão substituídas.')) return;
    aplicarTextos(window.textosDoModelo(F.publico.value, genero(F)));
    alterou();
  });

  function alterou() {
    st.sujo = true;
    $('#ed-estado').textContent = st.atual ? 'Alterações não salvas' : 'Ainda não salvo';
    atualizarAvisoModelo();
    clearTimeout(alterou.t);
    alterou.t = setTimeout(enviarPrevia, 120);
  }
  F.addEventListener('input', function (e) { if (e.target.name !== 'publico' && e.target.name !== 'genero') alterou(); });

  function abrirEditor(c, base) {
    st.atual = c;
    st.sujo = false;
    F.reset();
    if (c) {
      F.nome.value = c.nome;
      F.publico.value = c.publico in window.MODELOS ? c.publico : 'especial';
      F.anotacao.value = c.anotacao || '';
      setGenero(F, /^Querida /.test(c.saudacao) || / convidada/.test(c.titulo_b) ? 'a' : 'o');
      aplicarTextos(c);
    } else {
      var pub = (base && base.publico) || 'especial';
      F.publico.value = pub;
      setGenero(F, (base && base.genero) || 'o');
      aplicarTextos(base || window.textosDoModelo(pub, genero(F)));
    }
    st.modeloAnterior = window.textosDoModelo(F.publico.value, genero(F));
    ajustarCamposPublico();
    atualizarAvisoModelo();
    $('#ed-titulo').textContent = c ? c.nome : 'Novo convite';
    $('#ed-estado').textContent = c ? 'Salvo em ' + dataHora(c.atualizado_em) : '';
    $('#ed-salvar').textContent = c ? 'Salvar alterações' : 'Salvar e gerar link';
    renderEnvio();
    recarregarPrevia(true);
    mostrar('editor');
    if (!c) F.nome.focus();
  }

  function renderEnvio() {
    var c = st.atual;
    $('#ed-envio').hidden = !c;
    if (!c) return;
    $('#ed-link').value = linkDe(c);
    $('#ed-abrir').href = linkDe(c) + '?painel=1';
    $('#ed-marcar').textContent = c.enviado_em ? 'Desmarcar envio' : 'Marcar como enviado';
    var partes = [];
    partes.push(c.enviado_em ? 'Enviado em ' + dataHora(c.enviado_em) + '.' : 'Ainda não enviado.');
    partes.push(c.aberturas > 0
      ? 'O convidado abriu ' + plural(c.aberturas, 'vez', 'vezes') + ', a última em ' + dataHora(c.ultima_abertura) + '.'
      : 'Ainda não foi aberto pelo convidado.');
    partes.push('O link não muda se você editar o nome ou os textos.');
    $('#ed-situacao').textContent = partes.join(' ');
  }

  F.addEventListener('submit', function (e) {
    e.preventDefault();
    var dados = lerForm();
    if (!dados.nome) { F.nome.focus(); aviso('Escreva o nome antes de salvar'); return; }
    var btn = $('#ed-salvar'); btn.disabled = true;

    var req;
    if (st.atual) {
      req = db.from('convites').update(dados).eq('id', st.atual.id).select().single();
    } else {
      req = inserir([dados]).then(function (r) { return { data: r.data && r.data[0], error: r.error }; });
    }
    req.then(function (r) {
      btn.disabled = false;
      if (r.error) { erroDb(r.error); return; }
      var novo = !st.atual;
      substituir(r.data);
      st.atual = r.data;
      st.sujo = false;
      $('#ed-titulo').textContent = r.data.nome;
      $('#ed-estado').textContent = 'Salvo em ' + dataHora(r.data.atualizado_em);
      $('#ed-salvar').textContent = 'Salvar alterações';
      renderEnvio();
      if (novo) {
        trocarEndereco('/convite/' + r.data.id);
        aviso('Convite criado. O link já pode ser enviado.');
        $('#ed-envio').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        aviso('Alterações salvas');
      }
    });
  });

  // insere com slug novo; se o slug já existir, tenta de novo
  function inserir(lista, tentativa) {
    tentativa = tentativa || 0;
    var linhas = lista.map(function (d) { return Object.assign({}, d, { slug: novoSlug(d.nome) }); });
    return db.from('convites').insert(linhas).select().then(function (r) {
      if (r.error && r.error.code === '23505' && tentativa < 3) return inserir(lista, tentativa + 1);
      return r;
    });
  }

  $('#ed-copiar').addEventListener('click', function () { copiar($('#ed-link').value).then(function () { aviso('Link copiado'); }); });
  $('#ed-zap').addEventListener('click', function () {
    if (st.sujo) { aviso('Salve as alterações antes de enviar'); return; }
    enviarZap(st.atual).then(function (c) { st.atual = c; renderEnvio(); });
  });
  $('#ed-marcar').addEventListener('click', function () {
    marcarEnviado(st.atual, !st.atual.enviado_em).then(function (c) {
      st.atual = c; renderEnvio(); aviso(c.enviado_em ? 'Marcado como enviado' : 'Envio desmarcado');
    });
  });
  $('#ed-duplicar').addEventListener('click', function () {
    var base = lerForm();
    base.genero = genero(F);
    if (st.sujo && !confirm('Há alterações não salvas neste convite. Duplicar mesmo assim?')) return;
    st.sujo = false;
    trocarEndereco('/novo');
    abrirEditor(null, base);
    aviso('Cópia criada. Escreva o nome do novo convidado.');
  });
  $('#ed-excluir').addEventListener('click', function () {
    var c = st.atual;
    if (!confirm('Excluir o convite de ' + c.nome + '? O link enviado deixará de funcionar.')) return;
    db.from('convites').delete().eq('id', c.id).then(function (r) {
      if (r.error) { erroDb(r.error); return; }
      st.convites = st.convites.filter(function (x) { return x.id !== c.id; });
      st.sujo = false;
      aviso('Convite excluído');
      ir('/');
    });
  });

  // ------------------------------------------------------------------ prévia
  var iframe = $('#previa');
  function recarregarPrevia(aberto) {
    iframe.src = '/convite.html?preview=1' + (aberto ? '&aberto=1' : '') + '&t=' + Date.now();
    $('#ver-abertura').textContent = aberto ? 'Ver abertura do envelope' : 'Ver convite aberto';
    $('#ver-abertura').dataset.aberto = aberto ? '1' : '0';
  }
  $('#ver-abertura').addEventListener('click', function () { recarregarPrevia(this.dataset.aberto !== '1'); });
  function enviarPrevia() {
    if (!iframe.contentWindow || $('#v-editor').hidden) return;
    var c = lerForm();
    if (!c.nome) c.nome = window.MODELOS[c.publico].campoNome.replace(/^Nome d[oa] /, '');
    iframe.contentWindow.postMessage({ tipo: 'convite-previa', convite: c, evento: st.evento }, location.origin);
  }
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.tipo === 'previa-pronta') enviarPrevia();
  });

  // ------------------------------------------------------------------ evento
  var FE = $('#f-evento');
  function abrirEvento() {
    Object.keys(EVENTO_PADRAO).forEach(function (k) { if (FE[k]) FE[k].value = st.evento[k] || ''; });
    $('#ev-estado').textContent = st.evento.atualizado_em ? 'Salvo em ' + dataHora(st.evento.atualizado_em) : '';
    mostrar('evento');
  }
  FE.addEventListener('input', function () { $('#ev-estado').textContent = 'Alterações não salvas'; });
  FE.addEventListener('submit', function (e) {
    e.preventDefault();
    var dados = {};
    Object.keys(EVENTO_PADRAO).forEach(function (k) { dados[k] = FE[k].value.trim(); });
    dados.whatsapp = dados.whatsapp.replace(/\D/g, '');
    db.from('evento').upsert(Object.assign({ id: 1 }, dados)).select().single().then(function (r) {
      if (r.error) { erroDb(r.error); return; }
      st.evento = Object.assign({}, EVENTO_PADRAO, r.data);
      FE.whatsapp.value = st.evento.whatsapp;
      $('#ev-estado').textContent = 'Salvo em ' + dataHora(st.evento.atualizado_em);
      aviso('Dados do evento salvos');
    });
  });

  // ------------------------------------------------------------------ criar vários
  var D = $('#d-varios'), FV = $('#f-varios');
  function ajustarTratVarios() {
    $('#v-trat-box').style.visibility = window.MODELOS[FV.publico.value].tratamento ? 'visible' : 'hidden';
  }
  $('#abrir-varios').addEventListener('click', function () {
    FV.reset(); $('#v-erro').hidden = true; ajustarTratVarios(); D.showModal();
  });
  FV.publico.addEventListener('change', ajustarTratVarios);
  FV.addEventListener('submit', function (e) {
    if (e.submitter && e.submitter.value === 'cancelar') return;
    e.preventDefault();
    var vistos = {};
    var nomes = FV.nomes.value.split(/\n+/).map(function (s) { return s.trim(); })
      .filter(function (s) { if (!s || vistos[s.toLowerCase()]) return false; vistos[s.toLowerCase()] = 1; return true; });
    var err = $('#v-erro');
    if (!nomes.length) { err.textContent = 'Escreva pelo menos um nome.'; err.hidden = false; return; }
    if (nomes.length > 300) { err.textContent = 'Crie no máximo 300 convites por vez.'; err.hidden = false; return; }
    var pub = FV.publico.value, textos = window.textosDoModelo(pub, genero(FV));
    var btn = $('#v-criar'); btn.disabled = true; btn.textContent = 'Criando…';
    inserir(nomes.map(function (n) { return Object.assign({ nome: n, publico: pub, anotacao: '' }, textos); })).then(function (r) {
      btn.disabled = false; btn.textContent = 'Criar convites';
      if (r.error) { err.textContent = 'Não foi possível criar os convites. Confira a internet e tente de novo.'; err.hidden = false; console.error(r.error); return; }
      r.data.slice().reverse().forEach(substituir);
      D.close();
      $('#f-publico').value = pub; $('#f-situacao').value = ''; $('#busca').value = '';
      renderLista();
      aviso(plural(r.data.length, 'convite criado', 'convites criados'));
    });
  });

  // ------------------------------------------------------------------ início
  function iniciar() {
    return carregar().then(function () { rotear(); }).catch(function (e) {
      console.error(e);
      if (e && /JWT|auth/i.test(e.message || '')) { mostrar('login'); return; }
      rotear();
      aviso('Não foi possível carregar os convites. Recarregue a página.');
    });
  }

  if (!configurado) {
    mostrar('login');
    var err = $('#login-erro');
    err.textContent = 'O site ainda não está ligado ao Supabase. Preencha o arquivo js/config.js (veja o LEIA-ME).';
    err.hidden = false;
    $$('#f-login input, #f-login button').forEach(function (el) { el.disabled = true; });
    return;
  }

  db.auth.getSession().then(function (r) {
    if (r.data && r.data.session) iniciar(); else mostrar('login');
  });
  db.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') mostrar('login'); });
})();
