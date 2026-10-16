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

## Gerar o APK

No Ionic Appflow: build Android, tipo debug ou release. O Appflow roda `npm run build` (sai em `dist/`) e sincroniza o projeto `android/`.

Local (precisa do Android SDK em `android/local.properties`):

```bash
npm run apk
```
