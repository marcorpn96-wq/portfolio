import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // './' = percorsi relativi: funziona su GitHub Pages con qualsiasi nome di repository.
  // (In Escape-Room qui c'è '/Escape-Room/'; se preferisci lo stesso stile metti '/nome-repo/')
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // Quando aggiungi una nuova pagina (es. progetto-dyson.html) registrala qui:
        // dyson: resolve(import.meta.dirname, 'progetto-dyson.html'),
      }
    }
  }
})
