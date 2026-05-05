# Agenda Prof — Fase 5.8 REAL

Esta versão foi gerada com arquivos na raiz do ZIP e com marcação visível no app.

## Como confirmar que o App.js correto foi aplicado
No Codespace, rode:

```bash
grep -n "Versão 5.8 ativa" App.js
grep -n "Fim do ano letivo" App.js
grep -n "FER" App.js
grep -n "HOLIDAY_LABELS" App.js
grep -n "isEventExpiredForTodayWeek" App.js
grep -n "versionCode" app.json
```

O app deve mostrar em Configurações:

**Versão 5.8 ativa — feriados, ano letivo e eventos vencidos**

## Melhorias incluídas
- Feriados nacionais fixos marcados no calendário com etiqueta FER.
- Feriados não exibem aulas e compromissos recorrentes.
- Cadastro bloqueado em feriados nacionais.
- Campo “Fim do ano letivo (AAAA-MM-DD)” em Configurações.
- Eventos após o fim do ano letivo não aparecem e são bloqueados no cadastro.
- Eventos das abas Hoje e Semana somem 30 minutos após o horário final.
- Eventos clicáveis para Editar ou Excluir.
- App mantém o pacote Android com.agendaprof.app.
- App mantém a chave de dados agenda-prof-v2-data.

## Build
```bash
npm install
npx expo export --platform android
npx eas-cli build -p android --profile preview --clear-cache
```
