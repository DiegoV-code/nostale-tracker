# Nostale Tracker v4

Tracker di mercato per NosTale. Monitora prezzi, gestisci magazzino e vendite al bazar con segnali di trading automatici.

![Windows](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848F)
![License](https://img.shields.io/badge/license-Private-red)

## Funzionalita

- **Tracking prezzi** — Registra i prezzi di mercato con supporto eventi e note
- **Segnali di trading** — Analisi automatica: FORTE COMPRA / COMPRA / NELLA NORMA / SOPRA MEDIA / TROPPO CARO / VENDI
- **Magazzino** — Gestisci acquisti con ROI e profitto stimato
- **Bazar (In Vendita)** — Traccia listing con tempo di vendita e margini
- **Grafici** — Andamento intraday e multi-giorno con Recharts
- **Pagina Analisi** — Tabella ordinabile con segnale, ROI%, tempo vendita, profitto
- **Capital Overview** — Dashboard con investito, al bazar, profitti realizzati
- **Target personali** — Imposta prezzo di acquisto/vendita ideale per ogni item
- **Quick-add** — Inserimento rapido prezzi con Ctrl+Q
- **Categorie** — Organizza gli item per categoria, modificabile in qualsiasi momento
- **Protezione anomalie** — Avviso se il prezzo inserito devia troppo dalla media
- **Auto-update** — Aggiornamento automatico da GitHub Releases
- **Export CSV** — Esporta lo storico prezzi

## Screenshot

> *TODO: aggiungere screenshot*

## Installazione

Scarica l'ultimo installer dalla pagina [Releases](https://github.com/DiegoV-code/nostale-tracker/releases).

Esegui `Nostale Tracker Setup X.X.X.exe` e segui le istruzioni.

## Sviluppo

```bash
# Installa dipendenze
npm install

# Avvia in modalita sviluppo
npm run dev

# Build frontend
npm run build

# Crea installer
npm run dist
```

## Struttura progetto

```
├── electron/
│   ├── main.js          # Processo principale Electron
│   └── preload.js       # Bridge IPC sicuro
├── src/
│   └── App.jsx          # App React (single-file)
├── public/
│   └── icon.ico         # Icona applicazione
└── package.json         # Config, build, publish
```

## Dati

I dati vengono salvati in:
```
%APPDATA%\nostale-tracker\NostaleData\data.json
```

Viene creato automaticamente un backup (`data.backup.json`) ad ogni salvataggio.

## Rilascio nuova versione

1. Aggiorna la versione in `package.json`
2. Commit e push
3. Crea un tag: `git tag vX.X.X && git push origin vX.X.X`
4. La GitHub Action builda e pubblica automaticamente la release
5. Le app installate ricevono l'aggiornamento al riavvio

## Stack

- Electron 31
- React 18
- Vite 5
- Recharts
- electron-updater
