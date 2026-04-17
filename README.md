# Agenda Prof V2

Versão 2 do app Agenda Prof, com foco em organização da rotina docente.

## Melhorias incluídas
- visual reformulado e mais moderno
- botão `+` no canto inferior da tela
- abas: Hoje, Semana, Calendário, Gestão e Configurações
- cadastro de escolas com cor de identificação
- cadastro de turmas e disciplinas reutilizáveis
- inclusão separada de aulas e compromissos
- compromissos com repetição diária, semanal e anual
- calendário clicável para escolher a data
- aba `Tarefas da Semana`
- visão mensal no calendário
- layout ajustado para não estourar a tela

## Como fazer o build online no Codespaces
1. Envie os arquivos deste projeto para o GitHub.
2. Abra o repositório em `Code > Codespaces`.
3. No terminal, rode:

```bash
npm install
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Se for a primeira vez usando EAS no projeto, rode antes:

```bash
npx eas-cli build:configure
```

Na pergunta da plataforma, escolha `Android`.

## Observações
- Essa versão usa armazenamento local com AsyncStorage.
- Login Google e sincronização real com Google Agenda/Drive ainda não foram ativados.
- O ícone foi baseado na logo gerada para o Agenda Prof.
