# Agenda Prof — Fase 5.3 corrigida

Correções incluídas:

- Feriados nacionais marcados visualmente no calendário com etiqueta `FER`.
- 07/09 aparece como feriado nacional e não exibe aulas, compromissos ou avaliações.
- Eventos/aulas/avaliações não são gerados nem exibidos em feriados nacionais.
- Aba Configurações inclui o campo `Fim do ano letivo` no formato `AAAA-MM-DD`.
- Aulas recorrentes, aulas isoladas, compromissos e avaliações só aparecem até o fim do ano letivo, se preenchido.
- Bloqueio de cadastro após o fim do ano letivo.
- Abas Hoje e Semana ocultam eventos 30 minutos após o horário final.
- Eventos são clicáveis para editar ou excluir.
- Mantido `android.package`: `com.agendaprof.app`.
- Mantido `STORAGE_KEY`: `agenda-prof-v2-data`.

## Teste

```bash
npm install
npx expo export --platform android
```

Se passar:

```bash
npx eas-cli build -p android --profile preview
```

Instale o APK por cima do app atual. Não desinstale o app antigo.
