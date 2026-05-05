# Agenda Prof — Fase 5.4 corrigida

Correções aplicadas nesta versão:

- Feriados nacionais fixos e móveis são marcados no calendário com etiqueta `FER`.
- Feriados bloqueiam a seleção de data no seletor de calendário.
- Aulas e compromissos recorrentes não aparecem em feriados nacionais.
- Aba Configurações recebeu o campo `Fim do ano letivo (AAAA-MM-DD)`.
- Aulas, compromissos e recorrências não aparecem depois da data de fim do ano letivo.
- O cadastro de aula/compromisso é bloqueado se a data estiver em feriado ou depois do fim do ano letivo.
- Aba Hoje e Semana ocultam eventos 30 minutos após o horário final/horário do evento.
- A checagem de eventos passados atualiza automaticamente a cada 1 minuto.
- Eventos são clicáveis para editar ou excluir.
- Mantido `android.package`: `com.agendaprof.app`.
- Mantido `STORAGE_KEY`: `agenda-prof-v2-data`.

## Teste recomendado

```bash
npm install
npx expo export --platform android
```

Se passar sem erro:

```bash
npx eas-cli build -p android --profile preview
```

Instale por cima do app atual, sem desinstalar.
