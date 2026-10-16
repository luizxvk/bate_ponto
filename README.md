# Bate Ponto

App Android pra bater o ponto das tarefas: você cadastra o que precisa fazer, recebe o lembrete no horário e bate o ponto quando termina. O espelho de ponto mostra o que foi batido (e o que faltou) dia a dia.

- Tarefas de uma vez, todo dia ou de segunda a sexta
- Lembrete com botões "Bater ponto" e "Lembrar em 15 min" direto na notificação
- Dados ficam no aparelho

Feito com Vite + Capacitor 8 (`@capacitor/local-notifications`).

## Rodar

```bash
npm install
npm run dev
```

## Baixar o APK

Todo push na `main` gera o APK pelo GitHub Actions e publica em Releases. Link fixo da versão mais nova:

https://github.com/luizxvk/bate_ponto/releases/latest/download/bate-ponto.apk

Pra gerar sem push: aba Actions > APK > Run workflow.

## Gerar o APK local

Precisa do Android SDK em `android/local.properties`:

```bash
npm run apk
```
