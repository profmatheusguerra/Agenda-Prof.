# Agenda Prof — Fase 5.6 verificada

Este pacote está em estrutura **raiz**: ao descompactar, os arquivos `App.js`, `app.json`, `package.json`, `eas.json`, `babel.config.js`, `README.md` e a pasta `assets/` ficam diretamente dentro da pasta do projeto.

## Correções incluídas no App.js

- Feriados nacionais fixos e móveis calculados por ano.
- Marcação visual de feriados no calendário com a etiqueta `FER`.
- Legenda do calendário: Feriado nacional / Evento.
- Eventos/aulas/compromissos não são exibidos em feriados.
- Bloqueio ao tentar salvar aula ou compromisso em feriado nacional.
- Campo `Fim do ano letivo (AAAA-MM-DD)` na aba Configurações.
- Eventos não aparecem após a data definida em `Fim do ano letivo`.
- Eventos das abas Hoje e Semana são ocultados 30 minutos após o horário final.
- O app atualiza a checagem de horário a cada 1 minuto.
- Toque no evento abre opções para editar ou excluir.
- Tela de Configurações exibe `Versão 5.6 ativa`, para você confirmar visualmente que a versão correta foi instalada.

## Manutenção da atualização

- `android.package`: `com.agendaprof.app`
- `STORAGE_KEY`: `agenda-prof-v2-data`
- `versionCode`: 56

Instale o APK por cima do app atual, sem desinstalar.
