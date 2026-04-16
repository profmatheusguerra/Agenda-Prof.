# Agenda Prof.

MVP em Expo/React Native para organização da rotina do professor.

## O que este projeto já faz

- login simulado com conta Google (modo de teste)
- tela inicial com aulas do dia e tarefas
- botão `+` para cadastrar tarefas
- tela **Gestão** para cadastrar escolas e turmas
- tela **Configurações** com nome do professor e preferências
- salvamento local com AsyncStorage
- exclusão automática da tarefa ao marcar como concluída

## O que ainda é futuro

- login Google real
- integração real com Google Agenda
- backup e sincronização com Google Drive
- notificações push
- edição e exclusão individual de escolas/turmas

## Estrutura principal

- `App.js` — aplicativo completo em um único arquivo
- `app.json` — configuração do Expo
- `eas.json` — perfis de build (APK preview / AAB production)
- `.devcontainer/devcontainer.json` — facilita uso no GitHub Codespaces

## Build online recomendado: GitHub Codespaces + Expo EAS

### 1. Criar um repositório no GitHub

No navegador:

1. Acesse GitHub e faça login.
2. Clique em **New repository**.
3. Nome sugerido: `agenda-prof`.
4. Crie o repositório vazio.

### 2. Enviar os arquivos deste projeto

Dentro do repositório recém-criado:

1. Clique em **Add file** → **Upload files**.
2. Envie todos os arquivos desta pasta.
3. Confirme em **Commit changes**.

### 3. Abrir no Codespaces

1. No repositório, clique no botão **Code**.
2. Abra a aba **Codespaces**.
3. Clique em **Create codespace on main**.
4. Aguarde o ambiente abrir no navegador.

### 4. Instalar e entrar no Expo

No terminal do Codespaces, execute:

```bash
npm install
npx eas-cli login
```

Faça login com sua conta Expo quando o terminal pedir.
Se não tiver conta, crie em `https://expo.dev/signup`.

### 5. Gerar APK de teste

Ainda no terminal, execute:

```bash
npx eas-cli build -p android --profile preview
```

Quando perguntarem sobre credenciais do Android, escolha deixar o Expo gerenciar.

### 6. Baixar o APK

Ao final, o terminal mostrará um link do Expo.
Abra esse link, faça login na mesma conta Expo e baixe o arquivo `.apk`.

## Publicação futura na Play Store

Para a Play Store, o ideal é usar o perfil `production`, que gera `.aab`:

```bash
npx eas-cli build -p android --profile production
```

## Observações importantes

- Este MVP foi feito para ser simples e fácil de evoluir.
- O login Google está apenas simulado para testes visuais/funcionais.
- Para login Google real e sincronização com Calendar/Drive, será preciso criar um projeto no Google Cloud e configurar credenciais OAuth.
