# Agenda Prof — Fase 4

Melhorias incluídas nesta fase:

- Feriados nacionais marcados no calendário.
- Bloqueio para criar aula, compromisso ou avaliação em feriado nacional.
- Opções de lembrete para compromissos e avaliações.
- Lembrete padrão de aulas com 10 minutos de antecedência.
- Eventos das abas Hoje e Semana deixam de aparecer 30 minutos após o horário final.
- Toque em um evento para abrir opções de editar ou excluir.
- Mantém `android.package` como `com.agendaprof.app` e `STORAGE_KEY` como `agenda-prof-v2-data` para atualizar por cima do app atual.

Depois de substituir os arquivos, rode:

```bash
npm install
npx expo export --platform android
npx eas-cli build -p android --profile preview
```
