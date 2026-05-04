# Agenda Prof — Fase 1

Melhorias aplicadas nesta versão:

- Visual claro alinhado ao logo do Agenda Prof.
- Header com logo real em vez de “AP”.
- Ícone com respiro/padding para reduzir cortes no Android.
- Modal de escola/turma/disciplina maior e com melhor espaçamento.
- Campo “Início” da aula calcula automaticamente o término com +50 minutos, mantendo o campo “Fim” editável.

## Como testar

```bash
npm install
npx expo export --platform android
```

Se passar sem erro:

```bash
npx eas-cli build -p android --profile preview
```
