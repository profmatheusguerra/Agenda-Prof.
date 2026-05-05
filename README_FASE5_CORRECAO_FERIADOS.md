# Agenda Prof — Fase 5.1 Correção de Feriados

Correção aplicada:

- Feriados nacionais agora aparecem visualmente no calendário com fundo vermelho claro e etiqueta **FER**.
- Quando o feriado estiver selecionado, o dia fica em vermelho forte.
- A legenda do calendário mostra "Feriado nacional" e "Evento".
- Aulas, compromissos e avaliações recorrentes não são exibidos em feriados nacionais.
- Ao selecionar um feriado, a agenda do dia mostra o card de feriado e não lista eventos.
- Mantido o pacote Android `com.agendaprof.app` para instalar como atualização.
- Mantida a chave local `agenda-prof-v2-data` para preservar os dados.
- `versionCode` atualizado para 7.

Teste sugerido:

1. Abrir o calendário em setembro de 2026.
2. Selecionar 07/09/2026.
3. O dia deve aparecer como feriado e sem aulas/eventos.
