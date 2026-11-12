"use strict";
/* Jarvis — DEMO per il portfolio.
   Sostituisce il collegamento con il programma vero: tutto gira nel browser, con dati inventati e risposte preparate.
   Non c'è nessun server, nessuna chiave, nessun dato personale. */
(function () {
  const SECONDI_ATTESA_EVENTI = 25;
  const tema = { nome: "blu", effetti: true };
  const eventi = [];
  let ultimoIdentificativo = 0;
  let attesaEventi = [];
  let introMostrata = false;

  const dati = {
    stato: "attesa",
    ricordi: [
      "Il gatto si chiama Tom",
      "Il portfolio è su GitHub Pages",
      "Studiare React giovedì sera",
    ],
    promemoria: ["Chiamare il commercialista — domani 10:00"],
    liste: { Spesa: ["latte", "pane", "uova"], "Da fare": ["aggiornare il CV", "inviare la fattura"] },
    sistemi: [
      ["RETE", "ok", "ONLINE", "demo"], ["INTELLIGENZA", "ok", "ATTIVA", "risposte preparate"],
      ["TELEGRAM", "ok", "COLLEGATO", "demo"], ["POSTA", "ok", "ATTIVA", "demo"], ["METEO", "ok", "AGGIORNATO", "demo"],
      ["VOCE", "spento", "SILENZIOSA", "disattivata nella demo"], ["ASCOLTO", "spento", "SPENTO", ""],
      ["TELEFONO", "ok", "PRONTO", "demo"], ["MONITOR PC", "ok", "ATTIVO", "demo"],
    ],
    pc: { cpu: 18, ram: 46, ram_usata_gb: 7.4, ram_totale_gb: 16, disco_libero_gb: 312, batteria: 87, in_carica: false, gpu: 52 },
    meteo: {
      codice: 2, temperatura: 17, citta: "Pescara", descrizione: "Parzialmente nuvoloso", aggiornato: "demo", percepita: 16, umidita: 68,
      vento: 14, direzione_vento: "NE", raffiche: 24, alba: "06:58", tramonto: "16:52",
      ore: [
        { ora: "15:00", temperatura: 17, pioggia: 5 }, { ora: "16:00", temperatura: 16, pioggia: 5 }, { ora: "17:00", temperatura: 15, pioggia: 10 },
        { ora: "18:00", temperatura: 14, pioggia: 15 }, { ora: "19:00", temperatura: 13, pioggia: 20 }, { ora: "20:00", temperatura: 13, pioggia: 20 },
      ],
      giorni: [
        { etichetta: "Oggi", descrizione: "Nuvoloso", minima: 11, massima: 18, pioggia: 20 },
        { etichetta: "Domani", descrizione: "Sereno", minima: 10, massima: 19, pioggia: 0 },
        { etichetta: "Dopodomani", descrizione: "Pioggia leggera", minima: 12, massima: 16, pioggia: 55 },
      ],
    },
    messaggi: [],
  };

  function oraAdesso() {
    return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }

  function aggiungereEvento(evento) {
    ultimoIdentificativo += 1;
    evento.id = ultimoIdentificativo;
    eventi.push(evento);
    if (eventi.length > 400) {
      eventi.shift();
    }
    const inAttesa = attesaEventi;
    attesaEventi = [];
    for (const risolvi of inAttesa) {
      risolvi();
    }
  }

  function dire(autore, testo) {
    const messaggio = { tipo: "messaggio", autore, testo, ora: oraAdesso() };
    dati.messaggi.push({ autore, testo, ora: messaggio.ora });
    aggiungereEvento(messaggio);
  }

  function impostareStatoDemo(nomeStato) {
    dati.stato = nomeStato;
    aggiungereEvento({ tipo: "stato", valore: nomeStato });
  }

  function pubblicareRicordi() {
    aggiungereEvento({ tipo: "ricordi", ricordi: dati.ricordi.slice(), promemoria: dati.promemoria.slice() });
  }

  function pubblicareListe() {
    aggiungereEvento({ tipo: "liste", valore: JSON.parse(JSON.stringify(dati.liste)) });
  }

  const pausa = (millisecondi) => new Promise((risolvi) => setTimeout(risolvi, millisecondi));

  /* ---------------------------------------------------------------- il "cervello" della demo */

  const SUGGERIMENTI = "Prova: “che ore sono”, “che tempo fa”, “ricorda che domani ho il dentista”, “aggiungi birra alla spesa”, "
    + "“timer 2 minuti”, “come sta il pc”, “stato dei sistemi”, “cosa sai fare” oppure “chi è Marco”.";

  const NON_DISPONIBILE = "Questa funzione nella versione reale agisce sul PC (o sulla tua posta), ma questa è solo una demo: "
    + "qui non tocco niente e non ho accesso a dati veri. " + SUGGERIMENTI;

  function capitalizzare(testo) {
    return testo.charAt(0).toUpperCase() + testo.slice(1);
  }

  function durataInSecondi(testo) {
    const trovata = testo.match(/(\d+)\s*(second[oi]|sec|s|minut[oi]|min|m|or[ae]|h)\b/);
    if (!trovata) {
      return null;
    }
    const numero = Number(trovata[1]);
    const unita = trovata[2];
    if (/^(second|sec|s$)/.test(unita)) { return numero; }
    if (/^(minut|min|m$)/.test(unita)) { return numero * 60; }
    return numero * 3600;
  }

  function formattareDurata(secondi) {
    if (secondi >= 3600) { return Math.round(secondi / 360) / 10 + " ore"; }
    if (secondi >= 60) { return Math.round(secondi / 6) / 10 + " minuti"; }
    return secondi + " secondi";
  }

  function rispondere(testoOriginale) {
    const testo = testoOriginale.toLowerCase().replace(/[’]/g, "'").replace(/^jarvis[, ]+/, "").trim();
    let corrispondenza;

    if (/^(ciao|salve|buongiorno|buonasera|hey|ehi)\b/.test(testo)) {
      return "Ciao! Sono Jarvis, in versione demo. " + SUGGERIMENTI;
    }
    if (/che ore sono|che ora [eè]|l'ora/.test(testo)) {
      return "Sono le " + oraAdesso() + ".";
    }
    if (/che giorno|data di oggi|che data/.test(testo)) {
      return "Oggi è " + new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".";
    }
    if (/tempo|meteo|piov|ombrello/.test(testo)) {
      return "A Pescara ci sono 17° e il cielo è parzialmente nuvoloso. Nel pomeriggio qualche nuvola in più, "
        + "probabilità di pioggia bassa (5–20%). Domani sereno, massima 19°. (Dati inventati per la demo.)";
    }
    corrispondenza = testo.match(/(?:imposta |metti |avvia )?(?:un |il )?timer(?: di| da)?\s+(.+)/) || testo.match(/(?:avvisami|ricordami) tra\s+(.+)/);
    if (corrispondenza) {
      const secondi = durataInSecondi(corrispondenza[1]);
      if (!secondi || secondi > 3600) {
        return "Dimmi una durata fino a un'ora, per esempio “timer 2 minuti” (nella demo è così).";
      }
      const etichetta = "Timer " + formattareDurata(secondi);
      dati.liste.Timer = (dati.liste.Timer || []).concat([etichetta]);
      pubblicareListe();
      setTimeout(() => {
        dati.liste.Timer = (dati.liste.Timer || []).filter((voce) => voce !== etichetta);
        if (dati.liste.Timer.length === 0) { delete dati.liste.Timer; }
        pubblicareListe();
        dire("JARVIS", "⏰ Timer finito: " + formattareDurata(secondi) + ".");
      }, secondi * 1000);
      return "Timer impostato: " + formattareDurata(secondi) + ". Te lo dico qui quando scade.";
    }
    corrispondenza = testo.match(/^(?:aggiungi|metti|segna)\s+(.+?)\s+(?:alla|nella|sulla)\s+(?:lista della )?spesa$/);
    if (corrispondenza) {
      const nuove = corrispondenza[1].split(/\s*,\s*|\s+e\s+/).map((voce) => voce.replace(/^(il|lo|la|le|i|gli|un|una)\s+/, "").trim()).filter(Boolean);
      const davveroNuove = nuove.filter((voce) => !(dati.liste.Spesa || []).includes(voce));
      dati.liste.Spesa = (dati.liste.Spesa || []).concat(davveroNuove);
      pubblicareListe();
      return davveroNuove.length ? "Aggiunto alla spesa: " + davveroNuove.join(", ") + " (ora " + dati.liste.Spesa.length + " voci)." : "Era già tutto nella spesa.";
    }
    corrispondenza = testo.match(/^(?:togli|rimuovi|elimina)\s+(?:il |la |le |i |gli )?(.+?)\s+dalla spesa$/);
    if (corrispondenza) {
      const prima = (dati.liste.Spesa || []).length;
      dati.liste.Spesa = (dati.liste.Spesa || []).filter((voce) => voce.toLowerCase() !== corrispondenza[1]);
      pubblicareListe();
      return dati.liste.Spesa.length < prima ? "Tolto dalla spesa: " + corrispondenza[1] + "." : "Non trovo “" + corrispondenza[1] + "” nella spesa.";
    }
    if (/cosa devo comprare|lista della spesa|^\/spesa$|mostra la spesa/.test(testo)) {
      return (dati.liste.Spesa || []).length ? "Nella spesa hai:\n" + dati.liste.Spesa.map((voce, indice) => (indice + 1) + ". " + voce).join("\n") : "La spesa è vuota.";
    }
    corrispondenza = testo.match(/^(?:ricorda|ricordati)(?: che| di)?\s+(.+)/);
    if (corrispondenza) {
      dati.ricordi.push(capitalizzare(corrispondenza[1]));
      pubblicareRicordi();
      return "Fatto, me lo ricordo: " + corrispondenza[1] + ". (Nella demo resta solo finché non chiudi la pagina.)";
    }
    if (/^\/memoria$|cosa ricordi|cosa sai di me|i miei ricordi/.test(testo)) {
      return dati.ricordi.map((voce, indice) => (indice + 1) + ". " + voce).join("\n");
    }
    if (/^\/promemoria$|promemoria/.test(testo)) {
      return "Promemoria:\n" + dati.promemoria.map((voce, indice) => (indice + 1) + ". " + voce).join("\n");
    }
    if (/come sta il (pc|computer)|^\/stato$|stato del pc|batteria/.test(testo)) {
      return "PC (dati inventati): CPU " + dati.pc.cpu + "%, RAM " + dati.pc.ram + "% (" + dati.pc.ram_usata_gb + "/" + dati.pc.ram_totale_gb
        + " GB), disco libero " + dati.pc.disco_libero_gb + " GB, batteria " + dati.pc.batteria + "%.";
    }
    if (/stato dei sistemi|sistemi/.test(testo)) {
      return "Sistemi:\n" + dati.sistemi.map((riga) => "• " + riga[0] + ": " + riga[2]).join("\n");
    }
    if (/^\/briefing$|briefing/.test(testo)) {
      return "Buongiorno! Oggi: nuvoloso, 11–18° a Pescara. Hai 1 promemoria (chiamare il commercialista, domani 10:00), "
        + dati.liste["Da fare"].length + " cose da fare e " + (dati.liste.Spesa || []).length + " voci nella spesa. Nessuna mail importante. (Demo.)";
    }
    if (/^\/mail$|mail|posta/.test(testo)) {
      return "Nella demo non c'è nessuna casella di posta collegata. Nella versione vera ti avviso quando arriva una mail importante e posso leggerla o prepararti una bozza.";
    }
    if (/cosa sai fare|cosa puoi fare|aiuto|^\/aiuto$|^\/comandi$|funzioni/.test(testo)) {
      return "Nella versione reale (gira sul PC di Marco, gratis con Gemini) so: rispondere a domande con Gemini e il web, ricordare cose, "
        + "leggere la posta, calendario e promemoria, timer e sveglie, liste della spesa, controllare il PC (aprire programmi, file, volume), "
        + "parlare con la voce, ascoltare a comando, e funzionare da Telegram e dal telefono. Qui vedi una demo con risposte preparate. " + SUGGERIMENTI;
    }
    if (/chi sei|come ti chiami|cosa sei/.test(testo)) {
      return "Sono Jarvis, un assistente personale stile Iron Man creato da Marco: gratuito, in italiano, con interfaccia animata. Questa è la demo: le risposte sono preparate.";
    }
    if (/chi (è|e') marco|chi ti ha (creato|fatto)|chi ti ha programmato|marco/.test(testo)) {
      return "Marco Rapone, Full-Stack Developer di Pescara. Ha costruito Jarvis da zero con Python e JavaScript. Trovi gli altri suoi progetti nel portfolio.";
    }
    if (/grazie|bravo|perfetto/.test(testo)) {
      return "Di niente!";
    }
    if (testo.startsWith("/") || /apri |volume|schermo|webcam|musica|screenshot|spegni|blocca|password|file|notizie|agenda|argomenti|appunti|telefono|monitor|plugin|voce|annulla/.test(testo)) {
      return NON_DISPONIBILE;
    }
    return "Nella versione vera qui risponderei con Gemini. Questa è una demo con risposte preparate, quindi non so rispondere a tutto. " + SUGGERIMENTI;
  }

  async function elaborareRichiesta(testo) {
    dire("TU (PC)", testo);
    if (/^\/(pulisci|nuova)$/.test(testo.toLowerCase())) {
      aggiungereEvento({ tipo: "pulisci" });
      dati.messaggi.length = 0;
      return;
    }
    impostareStatoDemo("elaboro");
    await pausa(500 + Math.random() * 500);
    const risposta = rispondere(testo);
    // la risposta compare a pezzi, come con lo streaming vero
    const parole = risposta.split(/(?<=\s)/);
    let visibile = "";
    for (const parola of parole) {
      visibile += parola;
      aggiungereEvento({ tipo: "bozza", testo: visibile });
      await pausa(28 + Math.random() * 30);
    }
    impostareStatoDemo("parlo");
    dire("JARVIS", risposta);
    await pausa(700);
    impostareStatoDemo("attesa");
  }

  /* ---------------------------------------------------------------- finto server */

  function pubblicareMonitor() {
    const vicino = (valore, scarto, minimo, massimo) => Math.max(minimo, Math.min(massimo, Math.round(valore + (Math.random() - 0.5) * scarto)));
    dati.pc.cpu = vicino(dati.pc.cpu, 14, 4, 60);
    dati.pc.ram = vicino(dati.pc.ram, 4, 38, 60);
    dati.pc.ram_usata_gb = Math.round(dati.pc.ram * dati.pc.ram_totale_gb) / 100;
    dati.pc.gpu = vicino(dati.pc.gpu, 4, 44, 66);
    aggiungereEvento({ tipo: "pc", valore: Object.assign({}, dati.pc) });
  }
  setInterval(pubblicareMonitor, 4000);

  function risposta(corpo, stato) {
    return new Response(JSON.stringify(corpo), { status: stato || 200, headers: { "Content-Type": "application/json" } });
  }

  function istantanea() {
    const mostrareIntro = !introMostrata;
    introMostrata = true;
    return {
      ultimo: ultimoIdentificativo, tema: tema.nome, effetti: tema.effetti, intro: mostrareIntro,
      stato: {
        stato: dati.stato, meteo: dati.meteo, ricordi: dati.ricordi.slice(), promemoria: dati.promemoria.slice(),
        liste: JSON.parse(JSON.stringify(dati.liste)), pc: Object.assign({}, dati.pc), sistemi: dati.sistemi, mail: [],
        muto: true, conferme: true, ascolto: false, conferma: null,
      },
      messaggi: dati.messaggi.slice(-40),
    };
  }

  async function aspettareEventi(dopo) {
    if (!eventi.some((evento) => evento.id > dopo)) {
      await Promise.race([new Promise((risolvi) => attesaEventi.push(risolvi)), pausa(SECONDI_ATTESA_EVENTI * 1000)]);
    }
    const nuovi = eventi.filter((evento) => evento.id > dopo);
    return { eventi: nuovi, ultimo: Math.max(dopo, ultimoIdentificativo) };
  }

  const fetchVero = window.fetch.bind(window);
  window.fetch = async function (indirizzo, opzioni) {
    const percorso = String(indirizzo);
    if (!percorso.includes("/api/")) {
      return fetchVero(indirizzo, opzioni);
    }
    const corpo = opzioni && opzioni.body ? JSON.parse(opzioni.body) : {};
    if (percorso.includes("/api/stato")) { return risposta(istantanea()); }
    if (percorso.includes("/api/eventi")) {
      const dopo = Number((percorso.match(/da=(\d+)/) || [0, 0])[1]);
      return risposta(await aspettareEventi(dopo));
    }
    if (percorso.includes("/api/invia")) {
      if (corpo.testo) { elaborareRichiesta(String(corpo.testo).slice(0, 300)); }
      return risposta({ ok: true });
    }
    if (percorso.includes("/api/impostazione")) {
      if (corpo.chiave === "tema") { tema.nome = corpo.valore; }
      if (corpo.chiave === "effetti") { tema.effetti = Boolean(corpo.valore); }
      return risposta({ ok: true });
    }
    if (percorso.includes("/api/pulisci")) {
      aggiungereEvento({ tipo: "pulisci" });
      dati.messaggi.length = 0;
      return risposta({ ok: true });
    }
    if (percorso.includes("/api/microfono")) {
      dire("SISTEMA", "Nella demo il microfono è disattivato: scrivi nella casella qui sotto.");
      return risposta({ ok: true });
    }
    if (percorso.includes("/api/carica")) {
      return risposta({ errore: "Nella demo non si caricano file." }, 400);
    }
    return risposta({ ok: true });
  };

  // messaggio di benvenuto
  dati.messaggi.push({ autore: "JARVIS", ora: oraAdesso(), testo: "Benvenuto! Questa è la demo di Jarvis, l'assistente personale creato da Marco. " + SUGGERIMENTI });
})();
