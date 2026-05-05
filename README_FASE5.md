# Agenda Prof — Fase 5

Correções e melhorias aplicadas:

- Feriados nacionais marcados em vermelho no calendário.
- Aulas, compromissos e avaliações não aparecem em feriados nacionais.
- Datas de feriados continuam bloqueadas para novos cadastros.
- Abas Hoje e Semana atualizam automaticamente a cada minuto.
- Eventos deixam de aparecer 30 minutos após o horário final.
- Eventos podem ser tocados para editar ou excluir.
- Mantido o pacote Android `com.agendaprof.app` para instalar como atualização.
- Mantida a chave local `agenda-prof-v2-data` para preservar os dados.

## Como testar

```bash
npm install
npx expo export --platform android
```

Se passar sem erro:

```bash
npx eas-cli build -p android --profile preview
```

Instale o APK por cima do app atual, sem desinstalar.
