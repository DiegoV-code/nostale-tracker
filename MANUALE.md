# Nostale Tracker — Manuale d'uso

**Versione:** 4.4.1
**Piattaforma:** Windows
**Autore:** Diego Vianello

---

## Indice

1. [Installazione e aggiornamenti](#1-installazione-e-aggiornamenti)
2. [Panoramica interfaccia](#2-panoramica-interfaccia)
3. [Dashboard](#3-dashboard)
4. [Gestione Item](#4-gestione-item)
5. [Prezzi](#5-prezzi)
6. [Magazzino](#6-magazzino)
7. [In Vendita (Bazar per item)](#7-in-vendita-bazar-per-item)
8. [Grafici](#8-grafici)
9. [Pagina Bazar](#9-pagina-bazar)
10. [Pagina Analisi](#10-pagina-analisi)
11. [Nos Dollari (N$)](#11-nos-dollari-n)
12. [Quick-Add](#12-quick-add)
13. [Segnali di trading](#13-segnali-di-trading)
14. [Eventi](#14-eventi)
15. [Target personali](#15-target-personali)
16. [Dati e backup](#16-dati-e-backup)
17. [Scorciatoie da tastiera](#17-scorciatoie-da-tastiera)
18. [Formati accettati](#18-formati-accettati)
19. [FAQ e risoluzione problemi](#19-faq-e-risoluzione-problemi)

---

## 1. Installazione e aggiornamenti

### Prima installazione

1. Vai su [Releases](https://github.com/DiegoV-code/nostale-tracker/releases)
2. Scarica il file `Nostale.Tracker.Setup.X.X.X.exe`
3. Esegui l'installer — si installa automaticamente e crea un collegamento sul desktop

### Aggiornamenti automatici

L'app controlla automaticamente se ci sono aggiornamenti ad ogni avvio.

- **Barra gialla "Preparazione aggiornamento..."** — il download sta iniziando
- **Barra di progresso con percentuale** — il download e' in corso
- **Pulsante verde "Aggiorna ora"** — il download e' completato, clicca per installare e riavviare

Non serve scaricare manualmente dalle Releases dopo la prima installazione.

---

## 2. Panoramica interfaccia

L'interfaccia e' divisa in tre aree:

### Barra superiore (titlebar)

Da sinistra a destra:
- **Nome app e versione**
- **Selettore evento** — imposta l'evento attivo del giorno (influenza i segnali)
- **QUICK** — apre il pannello di inserimento rapido prezzi
- **N$** — apre la pagina Nos Dollari
- **Stato salvataggio** — mostra se i dati sono stati salvati
- **Icona cartella** — apre la cartella dati su disco

### Sidebar sinistra

- **Navigazione** — 4 tab: Dashboard, Bazar, Analisi, Aggiungi (+)
- **Barra di ricerca** — filtra gli item per nome
- **Ordinamento** — A-Z, Prezzo, Segnale
- **Filtro categoria** — mostra solo una categoria specifica
- **Lista item** — clicca su un item per aprire la sua scheda dettaglio

### Area principale (destra)

Mostra il contenuto della pagina selezionata (dashboard, dettaglio item, analisi, bazar, ND).

---

## 3. Dashboard

La pagina principale mostra:

### Capital Overview (barra in alto)

- **Investito in stock** — valore totale del magazzino (tutti gli item)
- **Al Bazar** — valore totale dei listing attivi
- **Profitto realizzato** — guadagno totale dalle vendite chiuse (tasse incluse)
- **Item tracciati** — numero di item nel portafoglio

### Schede item

Ogni item ha una scheda con:
- Prezzo attuale e variazione rispetto al precedente
- Segnale di trading (con colore e icona)
- Percentuale vs media storica
- Trend a 7 giorni
- Target acquisto/vendita (se impostati)
- Quantita' in magazzino e al bazar
- Profitto stimato
- Tempo medio di vendita

Clicca su una scheda per aprire il dettaglio dell'item.

---

## 4. Gestione Item

### Creare un nuovo item

1. Clicca il tab **+** nella sidebar
2. Inserisci il **nome** dell'item (esattamente come appare in gioco)
3. Seleziona una **categoria** (opzionale)
4. Clicca **AGGIUNGI ITEM**

### Categorie disponibili

Accessori, Armi, Armature, Consumabili, Materiali, Rune, Pet, Costume, Item Shop ND, Altro

La categoria puo' essere cambiata in qualsiasi momento dalla scheda dettaglio dell'item.

### Rinominare un item

Nella scheda dettaglio, clicca l'icona matita accanto al nome.

### Eliminare un item

Nella scheda dettaglio, clicca il pulsante rosso con il cestino. **Attenzione: l'eliminazione e' permanente** e cancella tutti i prezzi, lotti e listing dell'item.

### Copiare il nome

Clicca l'icona di copia accanto al nome, oppure clicca l'item nella sidebar (il nome viene copiato automaticamente).

---

## 5. Prezzi

Tab **Prezzi** nella scheda dettaglio di un item.

### Registrare un prezzo

1. Inserisci il prezzo nel campo (supporta formati come `150k`, `1.5kk`, vedi [Formati accettati](#18-formati-accettati))
2. Aggiungi una nota opzionale (es. "dump", "raro", "rialzo")
3. Clicca **REGISTRA PREZZO**

Il sistema avvisa se il prezzo devia molto dalla media storica (possibile errore di digitazione).

### Segnare "Esaurito al Bazar"

Se l'item non e' disponibile al bazar, clicca il pulsante **ESAURITO**. Questo verra' registrato nello storico e influenzera' il segnale di trading.

### Storico prezzi

Sotto il form appare la lista di tutti i prezzi registrati, dal piu' recente al piu' vecchio, con:
- Data e ora
- Prezzo
- Evento attivo al momento della registrazione
- Nota

Puoi eliminare un singolo prezzo con il pulsante X.

---

## 6. Magazzino

Tab **Magazzino** nella scheda dettaglio di un item.

Il magazzino traccia gli acquisti. Quando compri un item in gioco, registralo qui.

### Registrare un acquisto

1. Inserisci la **quantita'**
2. Inserisci il **prezzo unitario** di acquisto
3. Nota opzionale
4. Clicca **AGGIUNGI LOTTO**

### Barra statistiche

- **IN STOCK** — pezzi totali in magazzino
- **INVESTITO** — oro speso in totale
- **MEDIA ACQUISTO** — prezzo medio ponderato per pezzo
- **VALORE ATTUALE** — stock x prezzo di mercato attuale
- **PROFITTO STIMATO** — differenza tra valore attuale e investito

### Relazione con il Bazar

Quando metti un item in vendita al Bazar (tab In Vendita), i pezzi vengono **automaticamente rimossi dal magazzino**. Se cancelli un listing attivo, i pezzi tornano in magazzino.

I lotti vengono consumati in ordine **FIFO** (First In, First Out) — i piu' vecchi vengono usati per primi.

---

## 7. In Vendita (Bazar per item)

Tab **In Vendita** nella scheda dettaglio di un item.

### Mettere in vendita

1. Inserisci la **quantita'** da mettere in vendita
2. Inserisci il **prezzo al Bazar** (prezzo unitario di vendita)
3. Inserisci le **tasse del Bazar** (costo di esposizione della slot)
4. Clicca **METTI IN VENDITA**

Prima di confermare, il sistema mostra:
- **Lotti dal magazzino (FIFO)** — quali lotti verranno consumati
- **Pezzi coperti** — quanti item sono coperti dal magazzino
- **Costo totale** e **media acquisto** dei lotti coinvolti
- **Profitto stimato** (gia' al netto delle tasse)

### Vendita parziale

Se metti 999 pezzi in uno slot e qualcuno ne compra solo 10:

1. Clicca **VENDUTO** sul listing
2. Appare un campo quantita' (pre-compilato con il totale)
3. Modifica la quantita' (es. 10)
4. Conferma con il segno di spunta

Il listing resta attivo con la quantita' rimanente (989). Nello storico viene creata una vendita per i 10 pezzi.

Se li comprano tutti, lascia la quantita' piena e conferma.

### Listing attivi ("Al Bazar Ora")

Ogni listing mostra:
- Data di messa in vendita
- Da quanto tempo e' in vendita (verde = oggi, giallo = 1-2gg, rosso = 3+ giorni)
- Quantita', prezzo unitario, totale
- Profitto stimato (al netto delle tasse)
- Tasse di esposizione

### Storico vendite

Le vendite completate mostrano:
- Tempo impiegato per vendere
- Profitto realizzato (al netto delle tasse)
- Lotti originali consumati

### Tasse di esposizione

Le tasse del Bazar vengono sottratte da **tutti** i calcoli di profitto: nel listing, nello storico, nella stat bar, nella pagina analisi e nel capital overview della dashboard.

---

## 8. Grafici

Tab **Grafici** nella scheda dettaglio di un item.

### Grafico intraday

Mostra tutti i prezzi registrati nel giorno selezionato. Usa il selettore giorni per navigare tra le date.

### Grafico multi-giorno

Mostra l'andamento su tutti i giorni con dati, con:
- **Linea blu** — media giornaliera
- **Linea verde** — media giorni normali (senza eventi)
- **Linea arancione** — media giorni con eventi
- **Area grigia** — range min/max del giorno

---

## 9. Pagina Bazar

Accessibile dal tab **Bazar** nella sidebar.

Mostra una **panoramica globale** di tutti i listing attivi su tutti gli item.

### Barra statistiche

- **Slot attive** — numero totale di slot in vendita
- **Pezzi totali** — somma di tutti i pezzi al bazar
- **Valore al Bazar** — valore totale di tutti i listing
- **Tasse totali** — somma di tutte le tasse di esposizione
- **Profitto atteso** — profitto totale stimato (al netto delle tasse)

### Tabella listing

Ogni riga mostra: nome item, quantita', prezzo, totale, tasse, profitto, da quanto tempo e' in vendita.

Clicca su una riga per andare direttamente alla sezione "In Vendita" di quell'item.

---

## 10. Pagina Analisi

Accessibile dal tab **Analisi** nella sidebar.

Tabella comparativa di tutti gli item con colonne ordinabili:

| Colonna | Descrizione |
|---------|-------------|
| ITEM | Nome dell'item |
| PREZZO | Ultimo prezzo registrato |
| VS MEDIA | % rispetto alla media storica |
| STOCK | Quantita' in magazzino |
| AL BAZAR | Quantita' in vendita |
| ROI% | Return on Investment medio sulle vendite chiuse |
| TEMPO VEND. | Tempo medio di vendita |
| PROFITTO | Profitto totale realizzato |
| TREND 7GG | Variazione % negli ultimi 7 giorni |
| STABILITA' | Stabile / Moderata / Instabile (basata sulla volatilita') |

Clicca sulle intestazioni per ordinare. Clicca su un item per aprirne il dettaglio.

---

## 11. Nos Dollari (N$)

Accessibile dal pulsante **N$** nella barra superiore.

Questa sezione serve per calcolare la profittabilita' degli item acquistabili con Nos Dollari nel NosMall.

### Configurazione iniziale

1. **Imposta il tasso ND** — quanti ori costa 1 NosDollar (es. `5k` = 5.000 ori per ND). Il valore viene salvato permanentemente.
2. **Crea gli item** — crea i nuovi item e assegna la categoria **"Item Shop ND"**
3. **Registra i prezzi di mercato** — come per qualsiasi altro item, registra i prezzi nel tab Prezzi
4. **Configura ND e pezzi** — nella sezione "CONFIGURA ITEM ND" in fondo alla pagina:
   - **ND** — quanti NosDollari costa l'item nel NosMall (numero intero)
   - **PZ** — quanti pezzi ottieni per acquisto (numero intero)

### Calcolatore ND

In alto c'e' un calcolatore rapido: inserisci quanti ND vuoi comprare e vedi subito il costo in oro.

### Formula del profitto

```
Costo oro  = ND per item x Tasso ND
Ricavo     = Prezzo mercato x Pezzi per acquisto
Profitto   = Ricavo - Costo oro
```

### Tabella profittabilita'

Mostra tutti gli item "Item Shop ND" ordinati dal piu' profittevole, con:
- ND per item, pezzi, prezzo di mercato
- Costo in oro, ricavo stimato, profitto

### Sconti evento

Durante gli eventi NosMall, gli item hanno prezzi scontati in ND.

**Sconto globale:** in alto c'e' un selettore con le percentuali comuni: OFF, -10%, -15%, -20%, -25%, -30%, -40%, -50%. Quando attivi uno sconto globale, tutti i calcoli vengono aggiornati automaticamente.

**Sconto per-item:** nella sezione "CONFIGURA ITEM ND", ogni item ha il suo selettore di sconto. Utile quando solo alcuni item sono scontati.

Lo sconto globale ha **priorita'** su quello per-item. Il costo scontato in ND viene arrotondato per eccesso (Math.ceil).

Nella tabella, il prezzo scontato appare in arancione con il prezzo base barrato.

---

## 12. Quick-Add

Accessibile dal pulsante **QUICK** nella barra superiore o con **Ctrl+Q**.

Permette di registrare rapidamente i prezzi di piu' item di fila:

1. Seleziona un item dal menu a tendina (il nome viene copiato automaticamente)
2. Inserisci il prezzo
3. Nota opzionale
4. Clicca **SALVA** o premi **Invio**

Dopo il salvataggio:
- Il prezzo viene registrato
- L'app passa automaticamente all'item successivo nella lista
- Il nome del nuovo item viene copiato negli appunti
- Il cursore torna sul campo prezzo

Premi **Esc** per chiudere il pannello Quick-Add.

In basso appare la lista degli ultimi prezzi inseriti nella sessione corrente.

---

## 13. Segnali di trading

Ogni item con almeno **3 prezzi registrati** riceve un segnale automatico basato sul confronto tra il prezzo attuale e la media storica.

| Segnale | Colore | Condizione | Significato |
|---------|--------|------------|-------------|
| FORTE COMPRA | Verde | -15% o piu' sotto la media | Ottimo momento per comprare |
| COMPRA | Verde chiaro | -6% a -15% sotto la media | Buon momento per acquistare |
| COMPRA ★ | Verde | Prezzo <= target acquisto | Hai raggiunto il tuo obiettivo |
| NELLA NORMA | Giallo | Entro il +/-6% dalla media | Nessuna azione urgente |
| VENDI | Blu | +12% sopra il prezzo di acquisto | Valuta di vendere |
| VENDI ★ | Blu | Prezzo >= target vendita | Hai raggiunto il tuo obiettivo |
| SOPRA MEDIA | Arancione | +6% a +15% sopra la media | Aspetta o vendi |
| TROPPO CARO | Rosso | +15% o piu' sopra la media | Non comprare |
| ESAURITO AL BZ | Viola | Ultimo dato = esaurito | Non disponibile al bazar |

I segnali usano la media dei prezzi **senza eventi** come riferimento (se ci sono almeno 3 dati senza eventi). Altrimenti usano la media generale.

I **target personalizzati** (COMPRA ★ e VENDI ★) hanno priorita' massima sugli altri segnali.

---

## 14. Eventi

Nella barra superiore c'e' il selettore evento del giorno. Ogni prezzo registrato viene associato all'evento attivo.

### Eventi disponibili

| Evento | Effetto tipico |
|--------|---------------|
| Nessun evento | Giorno normale |
| Happy Hour NosDollari | Sconti ND |
| Doppio Oro Drop | Piu' oro nel gioco |
| Doppio Drop Item | Piu' item droppati |
| EXP Doppia | Esperienza raddoppiata |
| EXP Fata Doppia | EXP fata raddoppiata |
| Perfezionamento | Bonus upgrade |
| Evento Rune | Drop rune aumentato |
| Sconto NosMall | Sconti nel NosMall |
| Server NosFire | Evento server speciale |
| Bonus Weekend | Bonus del fine settimana |
| Evento Stagionale | Evento stagionale (Natale, Pasqua, ecc.) |
| Altro | Evento personalizzato |

Gli eventi influenzano:
- I segnali di trading (la media "senza eventi" e' il riferimento principale)
- I grafici (mostrano linee separate per prezzi evento vs normali)
- Le statistiche (media evento vs media normale)

---

## 15. Target personali

Nella scheda dettaglio di ogni item, nella barra segnale/target:

1. Clicca **modifica**
2. Imposta:
   - **Compra se <=** — prezzo sotto il quale vuoi acquistare
   - **Vendi se >=** — prezzo sopra il quale vuoi vendere
3. Clicca **SALVA**

Quando il prezzo raggiunge un target, il segnale cambia in **COMPRA ★** o **VENDI ★** con priorita' massima.

---

## 16. Dati e backup

### Posizione dati

```
%APPDATA%\nostale-tracker\NostaleData\data.json
```

Per aprire la cartella, clicca l'icona cartella nella barra superiore.

### Backup automatico

Ad ogni salvataggio viene creato un backup:
```
%APPDATA%\nostale-tracker\NostaleData\data.backup.json
```

### Salvataggio

I dati vengono salvati automaticamente dopo ogni modifica (con un piccolo ritardo per raggruppare i cambiamenti). Lo stato appare nella barra superiore.

### Migrazione / trasferimento

Per trasferire i dati su un altro PC, copia il file `data.json` nella stessa posizione sul nuovo computer.

---

## 17. Scorciatoie da tastiera

| Scorciatoia | Azione |
|-------------|--------|
| Ctrl+Q | Apri/chiudi Quick-Add |
| Esc | Chiudi Quick-Add |
| Invio | Conferma azione nel campo attivo |

---

## 18. Formati accettati

I campi prezzo accettano diversi formati:

| Input | Valore |
|-------|--------|
| `150000` | 150.000 ori |
| `150k` | 150.000 ori |
| `1.5kk` | 1.500.000 ori |
| `2kk` | 2.000.000 ori |
| `1.2kkk` | 1.200.000.000 ori |

I valori vengono mostrati in formato abbreviato:
- Sotto 1.000: `950 ori`
- 1.000 — 999.999: `150k`
- 1.000.000 — 999.999.999: `1.5kk`
- Sopra 1.000.000.000: `1.2kkk`

---

## 19. FAQ e risoluzione problemi

### L'app non si aggiorna

Chiudi completamente l'app (anche dalla system tray) e riaprila. L'aggiornamento viene scaricato in background e applicato al riavvio.

### Ho perso i dati

Controlla il file di backup in `%APPDATA%\nostale-tracker\NostaleData\data.backup.json`. Rinominalo in `data.json` per ripristinarlo.

### Il prezzo che ho inserito e' sbagliato

Nella lista prezzi, clicca la X accanto al prezzo per eliminarlo, poi reinseriscilo correttamente.

### Ho messo in vendita per sbaglio

Clicca la X sul listing attivo. I lotti verranno ripristinati nel magazzino.

### Il profitto non torna

Verifica di aver inserito le **tasse di esposizione** al momento della messa in vendita. Le tasse vengono sottratte dal profitto in tutti i calcoli.

### Dove trovo la cartella dati?

Clicca l'icona cartella nella barra superiore, oppure naviga manualmente a:
```
%APPDATA%\nostale-tracker\NostaleData\
```

### Come trasferisco i dati su un nuovo PC?

Copia il file `data.json` dalla cartella dati del vecchio PC alla stessa posizione sul nuovo PC.

---

*Nostale Tracker e' un tool non ufficiale creato da un fan. Non e' affiliato a Gameforge o al team di sviluppo di NosTale.*
