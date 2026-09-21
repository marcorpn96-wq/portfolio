# Portfolio — Marco Rapone

Stessa struttura di lavoro di **Escape-Room** (Vite + npm + GitHub Pages).

## Comandi

```bash
npm install        # solo la prima volta
npm run dev        # server locale con ricarica automatica → http://localhost:5173
npm run build      # crea la cartella dist/ (sito pronto da pubblicare)
npm run preview    # prova la versione di dist/ in locale
npm run deploy     # pubblica dist/ su GitHub Pages (branch gh-pages)
```

## Dove si modifica cosa

| Cosa                              | File / cartella      |
| --------------------------------- | -------------------- |
| Testi e struttura della pagina    | `index.html`         |
| Stili                             | `src/style.css`      |
| Animazioni e comportamento (JS)   | `src/main.js`        |
| Immagini e video                  | `public/img/`        |
| CV in PDF                         | `public/cv/Marco_Rapone_CV.pdf` |
| Configurazione build / nuove pagine | `vite.config.js`   |

Nell'HTML le immagini si scrivono con `/img/nome-file.webp` (la cartella `public/` è la radice).

## Aggiungere una nuova pagina

1. Crea il file, es. `progetto-dyson.html`, e in fondo aggiungi `<script type="module" src="/src/main.js"></script>`.
2. Registralo in `vite.config.js` dentro `rollupOptions.input`.
