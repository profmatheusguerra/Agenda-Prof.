# Agenda Prof — Fase 5.2

Inclui a correção dos feriados nacionais da Fase 5.1 e adiciona o campo **Fim do ano letivo** na aba **Configurações**.

## Novidades
- Campo **Fim do ano letivo** em Configurações, no formato `AAAA-MM-DD` (ex.: `2026-12-20`).
- Aulas recorrentes, aulas isoladas, compromissos e avaliações só são exibidos até essa data.
- O cadastro de aula, compromisso e avaliação é bloqueado caso a data ultrapasse o fim do ano letivo configurado.
- Se o campo ficar em branco, o app não aplica limite de fim do ano letivo.
- Mantém o pacote Android `com.agendaprof.app` e a chave local `agenda-prof-v2-data`, para instalar como atualização e preservar os dados.

## Teste sugerido
1. Abra **Configurações**.
2. Preencha **Fim do ano letivo** com `2026-12-20`.
3. Verifique no calendário que aulas recorrentes deixam de aparecer depois dessa data.
4. Tente cadastrar evento depois da data limite para confirmar o bloqueio.
