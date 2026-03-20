# UNICEF · PF4C Intelligence Platform

Dashboard interattiva per l'analisi della finanza pubblica per l'infanzia.  
Sviluppata per il team **Public Finance for Children (PF4C)** di UNICEF.

## Struttura del progetto

```
unicef-pf4c/
├── index.html          ← Punto di ingresso (aprire questo file)
├── css/
│   └── style.css       ← Tutti gli stili
├── js/
│   ├── data.js         ← Dataset (IMF · World Bank · UNICEF · UNDP) — 380KB
│   ├── globe.js        ← Globo 3D (Three.js)
│   └── app.js          ← Logica applicazione, grafici, pannelli
└── README.md
```

## Come usare

### In locale
Apri `index.html` direttamente nel browser (doppio click).  
Richiede connessione internet solo per caricare:
- Three.js (globo 3D) da `cdnjs.cloudflare.com`
- PapaParse (upload CSV) da `cdnjs.cloudflare.com`
- Font Noto Sans da Google Fonts
- Texture del globo da `cdn.jsdelivr.net`

I **dati** (201 paesi, 35 indicatori) sono embedded in `js/data.js` e funzionano offline.

### Su Netlify (hosting gratuito)
1. Vai su [app.netlify.com/drop](https://app.netlify.com/drop)
2. Trascina l'intera cartella `unicef-pf4c/`
3. Online in 30 secondi

### Su GitHub Pages
1. Crea un repository GitHub
2. Carica tutti i file mantenendo la struttura delle cartelle
3. Settings → Pages → Branch: main → Save

## Funzionalità

| Feature | Descrizione |
|---------|-------------|
| 🌍 Globo 3D | Texture NASA Blue Marble, rotazione drag, marker per regione |
| 📊 Pannello paese | KPI, serie storiche, grafici sparkline, download CSV |
| ⊞ Confronto | Tutti i 201 paesi, selezione multipla, grafici comparativi |
| ↑ Upload CSV | Supporto file IMF/World Bank/OECD con auto-detect colonne |
| ☾/☀ Dark/Light | Toggle tema |

## Dataset incluso

| Fonte | Indicatori |
|-------|-----------|
| **IMF** | GDP, popolazione, spesa pubblica, revenue, FDI, debito |
| **World Bank** | Mortalità U5, istruzione, alfabetizzazione, salute |
| **UNICEF** | Povertà infantile, protezione sociale |
| **UNDP** | Multidimensional Poverty Index (MPI) |
| **Trade** | Esportazioni USA, tariffe, perdite potenziali |

Anni coperti: **2018–2024** · Paesi: **201** · Indicatori: **35**

## Upload CSV personalizzato

Il sistema accetta file CSV con:
- Colonna `iso3` (codice paese ISO 3166-1 alpha-3) — **obbligatoria**
- Colonna `year` (anno YYYY) — **obbligatoria**
- Qualsiasi altra colonna → diventa automaticamente un indicatore

Fonti riconosciute automaticamente dal nome file: `IMF`, `WB`, `OECD`, `UNICEF`.

---
*UNICEF Public Finance for Children · Global Child Development Monitor*
