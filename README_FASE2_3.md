# Agenda Prof — Fase 2 + Fase 3

Pacote com as melhorias da Fase 2 e Fase 3 aplicadas sobre a base V2.

## Mantido para instalar como atualização

- `android.package`: `com.agendaprof.app`
- `STORAGE_KEY`: `agenda-prof-v2-data`

Não desinstale o app anterior antes de instalar o novo APK, para preservar os dados locais.

## Fase 2 incluída

- Aula recorrente ou aula isolada.
- Campo de data inicial para aula recorrente.
- Campo de data para aula isolada.
- Aula recorrente só aparece a partir da data inicial.
- Aula isolada aparece apenas no dia escolhido.
- Horário final automático: início + 50 minutos.
- Campo de fim continua editável manualmente.
- Contagem no fim da aba Semana: “Você possui X aulas semanais 😅”.

## Fase 3 incluída

- Nova opção no botão `+`: Nova avaliação.
- Nova aba inferior: Avaliações.
- Calendário de avaliações.
- Cadastro de avaliação por escola, turma, disciplina, data e horário.
- Campo opcional para registrar nome/observação do arquivo da prova.
- Ao salvar avaliação, o app tenta criar lembretes automáticos nas duas aulas anteriores da turma/disciplina:
  “Avaliação dessa turma dia X, foco na revisão!!!”

## Como testar

```bash
npm install
npx expo export --platform android
```

Se não houver erro:

```bash
npx eas-cli build -p android --profile preview
```
