// =====================================================================
// Modelos de texto de cada público.
// {nome} vira o nome do convidado quando o convite abre.
// Cada linha de "paragrafos" é um parágrafo da carta.
// Para mudar o texto padrão de um público, edite aqui.
// =====================================================================
(function () {
  var CONVITE = 'É com muita alegria que convidamos você para a Banca Final IDL Tech, o encerramento da Trilha 2026.';
  var CONVITE_PLURAL = 'É com muita alegria que convidamos vocês para a Banca Final IDL Tech, o encerramento da Trilha 2026.';
  var PERCURSO = 'Ao longo do ano, nossos trilheiros identificaram problemas reais de suas comunidades e construíram, em grupo, projetos para enfrentá-los.';

  // g = 'o' (ele) ou 'a' (ela)
  var MODELOS = {
    especial: {
      rotulo: 'Convidado especial',
      campoNome: 'Nome do convidado',
      tratamento: true,
      textos: function (g) {
        return {
          chamada: 'Convite para',
          titulo_a: '{nome}, você é noss' + g,
          titulo_b: 'convidad' + g + ' especial',
          saudacao: 'Querid' + g + ' {nome},',
          paragrafos: [CONVITE, PERCURSO + ' Agora chegou a hora de apresentarem o que construíram, e a sua presença tornará esse dia ainda mais especial.'].join('\n'),
          despedida: 'Com carinho,',
          pergunta: 'Podemos contar com a sua presença?'
        };
      }
    },
    banca: {
      rotulo: 'Banca',
      campoNome: 'Nome do membro da banca',
      tratamento: true,
      textos: function (g) {
        return {
          chamada: 'Convite para a Banca Final',
          titulo_a: '{nome}, você foi convidad' + g,
          titulo_b: 'para a nossa banca',
          saudacao: 'Querid' + g + ' {nome},',
          paragrafos: [CONVITE, PERCURSO + ' Na Banca Final, eles apresentam esses projetos, suas aprendizagens e o percurso que viveram. O seu papel será ouvir, avaliar e reconhecer esse caminho junto com eles.'].join('\n'),
          despedida: 'Com gratidão,',
          pergunta: 'Podemos contar com você na banca?'
        };
      }
    },
    coordenacao: {
      rotulo: 'Coordenação',
      campoNome: 'Nome da instituição parceira',
      tratamento: false,
      textos: function () {
        return {
          chamada: 'Convite para a coordenação',
          titulo_a: 'Vocês são nossos',
          titulo_b: 'convidados de honra',
          saudacao: 'Prezada coordenação,',
          paragrafos: [CONVITE_PLURAL, 'A Trilha deste ano foi construída junto, e a parceria com {nome} foi parte essencial desse percurso. Agora os trilheiros vão apresentar os projetos que desenvolveram, e será uma honra viver esse momento ao lado de vocês.'].join('\n'),
          despedida: 'Com gratidão,',
          pergunta: 'Podemos contar com a presença de vocês?'
        };
      }
    },
    familia: {
      rotulo: 'Família',
      campoNome: 'Nome do trilheiro',
      tratamento: false,
      textos: function () {
        return {
          chamada: 'Convite para a família de',
          titulo_a: 'Vocês fazem parte',
          titulo_b: 'deste percurso',
          saudacao: 'Querida família de {nome},',
          paragrafos: [CONVITE_PLURAL, 'Ao longo do ano, {nome} viveu a Trilha junto com seu grupo: identificou um problema real da comunidade e ajudou a construir um projeto para enfrentá-lo. Agora chegou a hora de apresentar esse caminho, e ter vocês ali torna esse momento ainda mais significativo.', 'Este convite é válido para {nome} e um responsável.'].join('\n'),
          despedida: 'Com carinho,',
          pergunta: 'Podemos contar com a presença de vocês?'
        };
      }
    }
  };

  window.MODELOS = MODELOS;
  window.CAMPOS_TEXTO = ['chamada', 'titulo_a', 'titulo_b', 'saudacao', 'paragrafos', 'despedida', 'pergunta'];
  window.textosDoModelo = function (publico, g) {
    var m = MODELOS[publico] || MODELOS.especial;
    return m.textos(g === 'a' ? 'a' : 'o');
  };
})();
