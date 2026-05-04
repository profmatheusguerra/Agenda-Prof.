# Agenda Prof — Fase 2

Melhorias incluídas nesta fase:

- Opção de **Aula recorrente** ou **Aula isolada** no cadastro de nova aula.
- Campo de **Data inicial** para aulas recorrentes.
- Campo de **Data da aula isolada** para aulas únicas.
- Aulas recorrentes só aparecem a partir da data inicial selecionada.
- Aulas isoladas aparecem apenas no dia específico escolhido.
- Horário final automático mantido: ao digitar 07:00, o fim muda para 07:50, mas continua editável.
- `android.package` mantido como `com.agendaprof.app` para instalar como atualização.
- `STORAGE_KEY` mantido como `agenda-prof-v2-data` para preservar dados locais.

## Antes do build

```bash
npm install
npx expo export --platform android
```

Se passar sem erro:

```bash
npx eas-cli build -p android --profile preview
```

## Importante

Não desinstale a versão anterior do celular. Instale este APK por cima para manter os dados.
