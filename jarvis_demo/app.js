"use strict";

// Un raggio negativo (può capitare per un frame durante le animazioni) farebbe fermare il disegno: lo portiamo a zero.
(function () {
  const arcoOriginale = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, raggio, ...altri) {
    return arcoOriginale.call(this, x, y, Math.max(0, raggio), ...altri);
  };
})();
/* Jarvis — finestra moderna. Parla con finestra_web.py tramite il server locale. */

const elemento = (identificativo) => document.getElementById(identificativo);

const ETICHETTE_STATO = { attesa: "IN ATTESA", ascolto: "TI ASCOLTO", elaboro: "ELABORO", parlo: "PARLO" };
const PARAMETRI_STATO = {
  attesa: { colore: "principale", velocita: 1.0, ampiezza: 0.12 },
  ascolto: { colore: "ascolto", velocita: 2.2, ampiezza: 0.85 },
  elaboro: { colore: "elabora", velocita: 4.0, ampiezza: 0.45 },
  parlo: { colore: "principale", velocita: 2.5, ampiezza: 1.0 },
};
const FASI_INTRO = ["INITIALIZING", "LOADING MODULES", "CALIBRATING", "CONNECTING", "SYNCHRONIZING", "SYSTEM ONLINE"];
const DURATA_INTRO_MILLISECONDI = 4200;
const MASSIMO_MESSAGGI_A_SCHERMO = 300;
const MASSIMO_ALLEGATI = 8;
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const situazione = {
  ultimo: 0,
  stato: "attesa",
  effetti: true,
  tema: "blu",
  muto: false,
  conferme: true,
  ascolto: false,
  allegati: [],
  scadenzaConferma: 0,
  scrittureInCorso: 0,
};

/* ------------------------------------------------------------------ comunicazione */

async function chiamare(percorso, dati) {
  const risposta = await fetch(percorso, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Jarvis": "1" },
    body: JSON.stringify(dati || {}),
  });
  if (risposta.status === 401) {
    mostrareScollegato();
  }
  return risposta;
}

function mostrareScollegato() {
  elemento("scollegato").hidden = false;
}

function inviare(testo, conAllegati) {
  const testoPulito = (testo || "").trim();
  const nomiAllegati = conAllegati ? situazione.allegati.filter((allegato) => allegato.nome).map((allegato) => allegato.nome) : [];
  if (!testoPulito && nomiAllegati.length === 0) {
    return;
  }
  chiamare("/api/invia", { testo: testoPulito, allegati: nomiAllegati }).catch(() => aggiungereMessaggio({ autore: "SISTEMA", testo: "Non riesco a parlare con Jarvis: è ancora acceso?", ora: oraAttuale() }, false));
  if (conAllegati && nomiAllegati.length) {
    situazione.allegati = [];
    disegnareAllegati();
  }
}

async function avviare() {
  const corrispondenza = location.hash.match(/k=([\w-]+)/);
  if (corrispondenza) {
    history.replaceState(null, "", location.pathname);
    try {
      await chiamare("/api/accesso", { chiave: corrispondenza[1] });
    } catch (errore) { /* gestito sotto */ }
  }
  let istantanea;
  try {
    const risposta = await fetch("/api/stato");
    if (!risposta.ok) {
      mostrareScollegato();
      return;
    }
    istantanea = await risposta.json();
  } catch (errore) {
    mostrareScollegato();
    return;
  }
  applicareIstantanea(istantanea);
  if (istantanea.intro && situazione.effetti) {
    mostrareIntro();
  }
  ascoltareEventi();
}

function applicareIstantanea(istantanea) {
  situazione.ultimo = istantanea.ultimo;
  impostareTema(istantanea.tema, false);
  impostareEffetti(istantanea.effetti, false);
  const stato = istantanea.stato;
  impostareStato(stato.stato);
  disegnareMeteo(stato.meteo);
  disegnareRicordi(stato.ricordi, stato.promemoria);
  disegnareListe(stato.liste);
  disegnareStatoPc(stato.pc);
  disegnareSistemi(stato.sistemi);
  disegnareMail(stato.mail);
  impostareInterruttore("interruttore-voce", !stato.muto);
  impostareInterruttore("interruttore-conferme", stato.conferme);
  impostareInterruttore("interruttore-ascolto", stato.ascolto);
  situazione.muto = stato.muto;
  mostrareConferma(stato.conferma);
  elemento("registro").replaceChildren();
  for (const messaggio of istantanea.messaggi) {
    aggiungereMessaggio(messaggio, false);
  }
  scorrereInFondo(true);
}

async function ascoltareEventi() {
  let erroriDiFila = 0;
  while (true) {
    try {
      const risposta = await fetch("/api/eventi?da=" + situazione.ultimo);
      if (risposta.status === 401 || risposta.status === 403) {
        mostrareScollegato();
        return;
      }
      const dati = await risposta.json();
      erroriDiFila = 0;
      if (dati.ricarica) {
        location.reload();
        return;
      }
      for (const evento of dati.eventi) {
        applicareEvento(evento);
      }
      situazione.ultimo = Math.max(situazione.ultimo, dati.ultimo);
    } catch (errore) {
      erroriDiFila += 1;
      if (erroriDiFila === 4) {
        // Jarvis è stato chiuso: questa finestra non serve più
        window.close();
        mostrareScollegato();
      }
      await new Promise((risolvi) => setTimeout(risolvi, 1500));
    }
  }
}

function applicareEvento(evento) {
  switch (evento.tipo) {
    case "messaggio": aggiungereMessaggio(evento, true); break;
    case "stato": impostareStato(evento.valore); break;
    case "meteo": disegnareMeteo(evento.valore); break;
    case "ricordi": disegnareRicordi(evento.ricordi, evento.promemoria); break;
    case "liste": disegnareListe(evento.valore); break;
    case "pc": disegnareStatoPc(evento.valore); break;
    case "bozza": mostrareBozza(evento.testo); break;
    case "sistemi": disegnareSistemi(evento.valore); break;
    case "mail": disegnareMail(evento.valore); break;
    case "conferma": mostrareConferma(evento.valore); break;
    case "conferme": impostareInterruttore("interruttore-conferme", evento.valore); break;
    case "muto": situazione.muto = evento.valore; impostareInterruttore("interruttore-voce", !evento.valore); break;
    case "ascolto": impostareInterruttore("interruttore-ascolto", evento.valore); break;
    case "qr": mostrareQr(evento); break;
    case "pulisci": elemento("registro").replaceChildren(); break;
    case "chiudi": window.close(); break;
    case "fuoco": window.focus(); elemento("campo").focus(); break;
    default: break;
  }
}

/* ------------------------------------------------------------------ stato, tema, effetti */

function impostareStato(nomeStato) {
  if (!PARAMETRI_STATO[nomeStato]) {
    return;
  }
  situazione.stato = nomeStato;
  if (nomeStato === "attesa") {
    const bozzaRimasta = document.querySelector(".messaggio.bozza");   // pulizia di sicurezza
    if (bozzaRimasta) { bozzaRimasta.remove(); }
  }
  document.body.dataset.stato = nomeStato;
  elemento("etichetta-stato").textContent = ETICHETTE_STATO[nomeStato];
  elemento("sistema-stato").textContent = ETICHETTE_STATO[nomeStato].toLowerCase();
}

function impostareTema(nomeTema, salvare) {
  if (!["blu", "rosso", "minimale"].includes(nomeTema)) {
    nomeTema = "blu";
  }
  situazione.tema = nomeTema;
  document.body.dataset.tema = nomeTema;
  for (const pulsante of document.querySelectorAll(".tema")) {
    pulsante.classList.toggle("scelto", pulsante.dataset.tema === nomeTema);
  }
  leggereColoriTema();
  if (salvare) {
    chiamare("/api/impostazione", { chiave: "tema", valore: nomeTema });
  }
}

function impostareEffetti(attivi, salvare) {
  situazione.effetti = Boolean(attivi);
  document.body.classList.toggle("senza-effetti", !situazione.effetti);
  impostareInterruttore("interruttore-effetti", situazione.effetti);
  if (salvare) {
    chiamare("/api/impostazione", { chiave: "effetti", valore: situazione.effetti });
  }
}

function impostareInterruttore(identificativo, acceso) {
  elemento(identificativo).dataset.acceso = acceso ? "true" : "false";
  if (identificativo === "interruttore-conferme") { situazione.conferme = Boolean(acceso); }
  if (identificativo === "interruttore-ascolto") { situazione.ascolto = Boolean(acceso); }
}

/* ------------------------------------------------------------------ messaggi */

function oraAttuale() {
  const adesso = new Date();
  return String(adesso.getHours()).padStart(2, "0") + ":" + String(adesso.getMinutes()).padStart(2, "0");
}

function classePerAutore(autore) {
  if (autore === "JARVIS") { return "jarvis"; }
  if (autore.startsWith("TU")) { return "utente"; }
  return "sistema";
}

function riempireConCollegamenti(contenitore, testo) {
  contenitore.replaceChildren();
  const espressione = /https?:\/\/[^\s<>"')\]]+/g;
  let posizione = 0;
  let corrispondenza;
  while ((corrispondenza = espressione.exec(testo)) !== null) {
    if (corrispondenza.index > posizione) {
      contenitore.append(testo.slice(posizione, corrispondenza.index));
    }
    const collegamento = document.createElement("a");
    collegamento.textContent = corrispondenza[0];
    collegamento.dataset.indirizzo = corrispondenza[0];
    contenitore.append(collegamento);
    posizione = corrispondenza.index + corrispondenza[0].length;
  }
  if (posizione < testo.length) {
    contenitore.append(testo.slice(posizione));
  }
}

/* Le fonti in fondo a una risposta ("Fonti:" + elenco di link) non vengono mostrate in chiaro:
   diventano un pulsante "Fonti (n)" che apre un piccolo menu con i link. */
function separareFonti(testo) {
  const trovati = Array.from(testo.matchAll(/\n+[ \t]*\**Fonti?\**[ \t]*:[ \t]*/gi));
  if (!trovati.length) { return { principale: testo, fonti: [] }; }
  const ultimo = trovati[trovati.length - 1];
  const coda = testo.slice(ultimo.index + ultimo[0].length);
  const fonti = [];
  const gia = new Set();
  for (const riga of coda.split(/\n+/)) {
    const pulita = riga.trim();
    if (!pulita) { continue; }
    const indirizzi = pulita.match(/https?:\/\/[^\s<>"')\]]+/g);
    if (!indirizzi) { return { principale: testo, fonti: [] }; }
    for (const indirizzo of indirizzi) {
      const indirizzoPulito = indirizzo.replace(/[.,;]+$/, "");
      if (gia.has(indirizzoPulito)) { continue; }
      gia.add(indirizzoPulito);
      let titolo = pulita.split(indirizzo)[0].replace(/^[\s\-•*\d.)]+/, "").replace(/[\s:(\-–]+$/, "").trim();
      if (!titolo || indirizzi.length > 1) {
        try { titolo = new URL(indirizzoPulito).hostname.replace(/^www\./, ""); } catch (eccezione) { titolo = "fonte"; }
      }
      fonti.push({ titolo: titolo.slice(0, 90), indirizzo: indirizzoPulito });
    }
  }
  if (!fonti.length) { return { principale: testo, fonti: [] }; }
  return { principale: testo.slice(0, ultimo.index).trimEnd(), fonti };
}

function creareMenuFonti(fonti) {
  const contenitore = document.createElement("div");
  contenitore.className = "fonti";
  const pulsante = document.createElement("button");
  pulsante.type = "button";
  pulsante.className = "fonti-pulsante";
  pulsante.setAttribute("aria-expanded", "false");
  const etichetta = "Fonti (" + fonti.length + ")";
  pulsante.textContent = etichetta + " ▾";
  const menu = document.createElement("div");
  menu.className = "fonti-menu";
  menu.hidden = true;
  for (const fonte of fonti) {
    const collegamento = document.createElement("a");
    collegamento.dataset.indirizzo = fonte.indirizzo;
    collegamento.title = fonte.indirizzo;
    const titolo = document.createElement("span");
    titolo.textContent = fonte.titolo;
    const dominio = document.createElement("small");
    try { dominio.textContent = new URL(fonte.indirizzo).hostname.replace(/^www\./, ""); } catch (eccezione) { dominio.textContent = ""; }
    collegamento.append(titolo, dominio);
    menu.append(collegamento);
  }
  pulsante.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    pulsante.setAttribute("aria-expanded", String(!menu.hidden));
    pulsante.textContent = etichetta + (menu.hidden ? " ▾" : " ▴");
    if (!menu.hidden) { scorrereInFondo(false); }
  });
  contenitore.append(pulsante, menu);
  return contenitore;
}

function mostrareBozza(testo) {
  // risposta di Jarvis che sta arrivando: compare man mano e viene sostituita dal messaggio finale
  const registro = elemento("registro");
  let blocco = registro.querySelector(".messaggio.bozza");
  if (!testo) {
    if (blocco) { blocco.remove(); }
    return;
  }
  const eraInFondo = registro.scrollHeight - registro.scrollTop - registro.clientHeight < 120;
  if (!blocco) {
    blocco = document.createElement("article");
    blocco.className = "messaggio jarvis bozza";
    const intestazione = document.createElement("header");
    const nome = document.createElement("span");
    nome.textContent = "Jarvis";
    const orario = document.createElement("time");
    orario.textContent = oraAttuale();
    intestazione.append(nome, orario);
    const corpoBozza = document.createElement("div");
    corpoBozza.classList.add("cursore");
    corpoBozza.append(document.createTextNode(""));
    blocco.append(intestazione, corpoBozza);
    registro.append(blocco);
  }
  blocco.lastElementChild.firstChild.data = testo;
  if (eraInFondo) { registro.scrollTop = registro.scrollHeight; }
}

function aggiungereMessaggio(messaggio, nuovo) {
  const registro = elemento("registro");
  const bozzaPrecedente = registro.querySelector(".messaggio.bozza");
  const avevaBozza = Boolean(bozzaPrecedente);
  if (bozzaPrecedente) { bozzaPrecedente.remove(); }
  const eraInFondo = registro.scrollHeight - registro.scrollTop - registro.clientHeight < 80;
  const classe = classePerAutore(messaggio.autore);
  const blocco = document.createElement("article");
  blocco.className = "messaggio " + classe;
  const intestazione = document.createElement("header");
  const nome = document.createElement("span");
  nome.textContent = messaggio.autore === "JARVIS" ? "Jarvis" : messaggio.autore.replace(/^TU \((.+)\)$/, "Tu · $1");
  const orario = document.createElement("time");
  orario.textContent = messaggio.ora || oraAttuale();
  intestazione.append(nome, orario);
  const corpo = document.createElement("div");
  blocco.append(intestazione, corpo);
  registro.append(blocco);
  while (registro.children.length > MASSIMO_MESSAGGI_A_SCHERMO) {
    registro.firstElementChild.remove();
  }
  const { principale: testo, fonti } = classe === "jarvis" ? separareFonti(String(messaggio.testo || "")) : { principale: String(messaggio.testo || ""), fonti: [] };
  if (fonti.length) { blocco.append(creareMenuFonti(fonti)); }
  if (nuovo && situazione.effetti && classe === "jarvis" && testo.length > 0 && !avevaBozza) {
    scrivereComeMacchina(corpo, testo);
  } else {
    riempireConCollegamenti(corpo, testo);
  }
  if (eraInFondo || nuovo) {
    scorrereInFondo(!nuovo);
  }
}

function scrivereComeMacchina(contenitore, testo) {
  const nodoTesto = document.createTextNode("");
  contenitore.append(nodoTesto);
  contenitore.classList.add("cursore");
  const caratteriPerPasso = Math.max(2, Math.ceil(testo.length / 150));
  let posizione = 0;
  const registro = elemento("registro");
  function passo() {
    if (!contenitore.isConnected) {
      return;
    }
    posizione = Math.min(testo.length, posizione + caratteriPerPasso);
    nodoTesto.data = testo.slice(0, posizione);
    if (registro.scrollHeight - registro.scrollTop - registro.clientHeight < 140) {
      registro.scrollTop = registro.scrollHeight;
    }
    if (posizione < testo.length) {
      setTimeout(passo, 16);
    } else {
      contenitore.classList.remove("cursore");
      riempireConCollegamenti(contenitore, testo);
    }
  }
  passo();
}

function scorrereInFondo(subito) {
  const registro = elemento("registro");
  if (subito) {
    const precedente = registro.style.scrollBehavior;
    registro.style.scrollBehavior = "auto";
    registro.scrollTop = registro.scrollHeight;
    registro.style.scrollBehavior = precedente;
  } else {
    registro.scrollTop = registro.scrollHeight;
  }
}

function mostrareConferma(testo) {
  const barra = elemento("conferma");
  if (!testo) {
    barra.hidden = true;
    situazione.scadenzaConferma = 0;
    return;
  }
  elemento("conferma-testo").textContent = testo;
  barra.hidden = false;
  situazione.scadenzaConferma = Date.now() + 300000;
}

/* ------------------------------------------------------------------ pannelli */

function creareVoce(testo, titolo) {
  const voce = document.createElement("li");
  if (titolo) {
    const grassetto = document.createElement("b");
    grassetto.textContent = titolo;
    voce.append(grassetto);
  }
  voce.append(testo);
  return voce;
}

function creareVoceVuota(testo) {
  const voce = document.createElement("li");
  voce.className = "vuoto";
  voce.textContent = testo;
  return voce;
}

function disegnareRicordi(ricordi, promemoria) {
  ricordi = ricordi || [];
  promemoria = promemoria || [];
  const elencoRicordi = elemento("ricordi-elenco");
  elencoRicordi.replaceChildren();
  if (ricordi.length === 0) {
    elencoRicordi.append(creareVoceVuota("Nessun ricordo. Scrivi “ricorda che…” per salvarne uno."));
  }
  for (const ricordo of ricordi.slice(0, 30)) {
    elencoRicordi.append(creareVoce(ricordo.length > 140 ? ricordo.slice(0, 140) + "…" : ricordo));
  }
  elemento("ricordi-numero").textContent = ricordi.length ? String(ricordi.length) : "";
  const elencoPromemoria = elemento("promemoria-elenco");
  elencoPromemoria.replaceChildren();
  elemento("promemoria-titolo").hidden = promemoria.length === 0;
  for (const voce of promemoria.slice(0, 8)) {
    elencoPromemoria.append(creareVoce(voce));
  }
  elemento("sistema-ricordi").textContent = String(ricordi.length);
  elemento("sistema-promemoria").textContent = String(promemoria.length);
}

function disegnareListe(liste) {
  const contenitore = elemento("liste-sezioni");
  contenitore.replaceChildren();
  const ordine = ["Timer", "Spesa", "Da fare"];
  const nomi = Object.keys(liste || {}).sort((a, b) => {
    const posizioneA = ordine.indexOf(a) < 0 ? 99 : ordine.indexOf(a);
    const posizioneB = ordine.indexOf(b) < 0 ? 99 : ordine.indexOf(b);
    return posizioneA - posizioneB || a.localeCompare(b);
  });
  for (const nome of nomi) {
    const voci = liste[nome] || [];
    const titolo = document.createElement("header");
    titolo.className = "titolo-pannello secondario";
    const testoTitolo = document.createElement("span");
    testoTitolo.textContent = nome;
    const numero = document.createElement("small");
    numero.textContent = String(voci.length);
    titolo.append(testoTitolo, numero);
    const elenco = document.createElement("ul");
    elenco.className = "elenco";
    for (const voce of voci.slice(0, 20)) {
      elenco.append(creareVoce(voce));
    }
    contenitore.append(titolo, elenco);
  }
}

function disegnareMail(elencoMail) {
  elencoMail = elencoMail || [];
  elemento("sistema-mail").textContent = String(elencoMail.length);
}

function disegnareSistemi(righe) {
  righe = righe || [];
  window.jarvisSistemi = righe;
  const elenco = elemento("sistemi-elenco");
  elenco.replaceChildren();
  let operativi = 0;
  for (const [nome, stato, etichetta, dettaglio] of righe) {
    const voce = document.createElement("li");
    voce.className = "sistema-" + stato;
    voce.title = dettaglio || "";
    const punto = document.createElement("i");
    const nomeSistema = document.createElement("span");
    nomeSistema.textContent = nome;
    const esito = document.createElement("b");
    esito.textContent = etichetta;
    voce.append(punto, nomeSistema, esito);
    elenco.append(voce);
    if (stato === "ok") {
      operativi += 1;
    }
  }
  elemento("sistemi-riepilogo").textContent = righe.length ? operativi + "/" + righe.length + " operativi" : "";
}

function impostareBarraPc(nome, percentuale, avviso) {
  const barra = elemento("pc-" + nome + "-barra");
  barra.style.width = Math.max(0, Math.min(100, percentuale)) + "%";
  barra.classList.toggle("avviso", Boolean(avviso));
}

function disegnareStatoPc(dati) {
  if (!dati) {
    return;
  }
  const batteria = dati.batteria;
  elemento("pc-batteria").hidden = batteria === null || batteria === undefined;
  if (!elemento("pc-batteria").hidden) {
    elemento("pc-batteria-valore").textContent = batteria + "%" + (dati.in_carica ? " ⚡ in carica" : "");
    impostareBarraPc("batteria", batteria, batteria <= 20 && !dati.in_carica);
  }
  elemento("pc-carica").textContent = batteria === null || batteria === undefined ? "fisso" : (dati.in_carica ? "caricatore" : "a batteria");
  window.jarvisPc = dati;
  elemento("pc-cpu-valore").textContent = dati.cpu + "%";
  impostareBarraPc("cpu", dati.cpu, dati.cpu >= 90);
  elemento("pc-ram-valore").textContent = dati.ram + "% · " + dati.ram_usata_gb + "/" + dati.ram_totale_gb + " GB";
  impostareBarraPc("ram", dati.ram, dati.ram >= 90);
  elemento("pc-disco-valore").textContent = dati.disco_libero_gb + " GB";
  elemento("pc-gpu-riga").hidden = dati.gpu === null || dati.gpu === undefined;
  elemento("pc-gpu-valore").textContent = dati.gpu + " °C";
}

function disegnoIconaMeteo(codice) {
  const sole = '<circle cx="32" cy="32" r="11"/><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M49 15l-5 5M20 44l-5 5"/>';
  const nuvola = '<path d="M20 44h26a10 10 0 0 0 1-20 14 14 0 0 0-27 3 9 9 0 0 0 0 17z"/>';
  if (codice === 0 || codice === 1) { return sole; }
  if (codice === 2) { return '<circle cx="22" cy="22" r="8"/><path d="M22 6v4M6 22h4M11 11l3 3M33 11l-3 3"/><path d="M24 50h22a9 9 0 0 0 1-18 12 12 0 0 0-23 3 8 8 0 0 0 0 15z"/>'; }
  if (codice === 45 || codice === 48) { return '<path d="M12 22h40M8 32h48M12 42h40M18 52h28"/>'; }
  if ((codice >= 51 && codice <= 67) || (codice >= 80 && codice <= 82)) { return '<path d="M20 38h26a10 10 0 0 0 1-20 14 14 0 0 0-27 3 9 9 0 0 0 0 17z"/><path d="M22 46l-3 8M33 46l-3 8M44 46l-3 8"/>'; }
  if ((codice >= 71 && codice <= 77) || codice === 85 || codice === 86) { return '<path d="M20 38h26a10 10 0 0 0 1-20 14 14 0 0 0-27 3 9 9 0 0 0 0 17z"/><path d="M21 48h.1M32 52h.1M43 48h.1M26 56h.1M38 56h.1" stroke-width="5"/>'; }
  if (codice >= 95) { return '<path d="M20 38h26a10 10 0 0 0 1-20 14 14 0 0 0-27 3 9 9 0 0 0 0 17z"/><path d="M34 40l-7 10h8l-5 9"/>'; }
  return nuvola;
}

function disegnareMeteo(dati) {
  const icona = elemento("meteo-icona");
  if (!dati) {
    icona.innerHTML = disegnoIconaMeteo(3);
    elemento("meteo-temperatura").textContent = "--";
    elemento("meteo-descrizione").textContent = "Meteo non disponibile, riprovo tra poco…";
    for (const identificativo of ["meteo-dettagli", "meteo-ore", "meteo-giorni"]) {
      elemento(identificativo).replaceChildren();
    }
    elemento("meteo-aggiornato").textContent = "";
    return;
  }
  icona.innerHTML = disegnoIconaMeteo(Number(dati.codice));
  elemento("meteo-temperatura").textContent = dati.temperatura + "°";
  elemento("meteo-descrizione").textContent = dati.citta + " · " + dati.descrizione;
  elemento("meteo-aggiornato").textContent = (dati.aggiornato ? "ore " + dati.aggiornato : "") + (dati.obsoleto ? " (vecchio)" : "");

  const dettagli = elemento("meteo-dettagli");
  dettagli.replaceChildren();
  const coppie = [
    ["Percepita", dati.percepita + "°"],
    ["Umidità", (dati.umidita ?? "--") + "%"],
    ["Vento", dati.vento + " km/h " + (dati.direzione_vento || "")],
    ["Raffiche", (dati.raffiche ?? "--") + " km/h"],
    ["Alba", dati.alba || "--"],
    ["Tramonto", dati.tramonto || "--"],
  ];
  for (const [nome, valore] of coppie) {
    const riga = document.createElement("span");
    const grassetto = document.createElement("b");
    grassetto.textContent = valore;
    riga.append(nome + " ", grassetto);
    dettagli.append(riga);
  }

  const ore = elemento("meteo-ore");
  ore.replaceChildren();
  for (const ora of (dati.ore || []).slice(0, 6)) {
    const cella = document.createElement("div");
    const temperatura = document.createElement("b");
    temperatura.textContent = ora.temperatura + "°";
    const pioggia = document.createElement("i");
    pioggia.textContent = ora.pioggia === null || ora.pioggia === undefined ? "–" : ora.pioggia + "%";
    cella.append(String(ora.ora).slice(0, 2), temperatura, pioggia);
    ore.append(cella);
  }

  const giorni = elemento("meteo-giorni");
  giorni.replaceChildren();
  for (const giorno of dati.giorni || []) {
    const riga = document.createElement("div");
    const sinistra = document.createElement("span");
    const nome = document.createElement("b");
    nome.textContent = giorno.etichetta;
    sinistra.append(nome, " · " + giorno.descrizione);
    const destra = document.createElement("span");
    destra.textContent = giorno.minima + "°/" + giorno.massima + "°" + (giorno.pioggia === null || giorno.pioggia === undefined ? "" : "  " + giorno.pioggia + "%");
    riga.append(sinistra, destra);
    giorni.append(riga);
  }
}

function mostrareQr(evento) {
  if (evento.immagine) {
    elemento("qr-immagine").src = evento.immagine;
    elemento("qr-immagine").hidden = false;
  } else {
    elemento("qr-immagine").hidden = true;
  }
  elemento("qr-indirizzo").textContent = evento.indirizzo || "";
  elemento("qr-codice").textContent = evento.codice || "";
  elemento("velo-qr").hidden = false;
}

/* ------------------------------------------------------------------ allegati */

function disegnareAllegati() {
  const riga = elemento("allegati");
  const elenco = elemento("allegati-elenco");
  elenco.replaceChildren();
  riga.hidden = situazione.allegati.length === 0;
  for (const allegato of situazione.allegati) {
    const etichetta = document.createElement("span");
    etichetta.className = "allegato" + (allegato.nome ? "" : " in-corso");
    etichetta.append(allegato.titolo.length > 28 ? allegato.titolo.slice(0, 26) + "…" : allegato.titolo);
    const togli = document.createElement("button");
    togli.type = "button";
    togli.textContent = "×";
    togli.title = "Togli";
    togli.addEventListener("click", () => {
      situazione.allegati = situazione.allegati.filter((altro) => altro !== allegato);
      disegnareAllegati();
    });
    etichetta.append(togli);
    elenco.append(etichetta);
  }
}

async function caricareFile(elencoFile) {
  for (const file of elencoFile) {
    if (situazione.allegati.length >= MASSIMO_ALLEGATI) {
      aggiungereMessaggio({ autore: "SISTEMA", testo: "Puoi allegare al massimo " + MASSIMO_ALLEGATI + " file per volta.", ora: oraAttuale() }, false);
      break;
    }
    const allegato = { titolo: file.name, nome: null };
    situazione.allegati.push(allegato);
    disegnareAllegati();
    try {
      const risposta = await fetch("/api/carica", {
        method: "POST",
        headers: { "X-Jarvis": "1", "X-Nome-File": encodeURIComponent(file.name), "Content-Type": "application/octet-stream" },
        body: file,
      });
      const dati = await risposta.json();
      if (!risposta.ok || !dati.nome) {
        throw new Error(dati.errore || "caricamento non riuscito");
      }
      allegato.nome = dati.nome;
    } catch (errore) {
      situazione.allegati = situazione.allegati.filter((altro) => altro !== allegato);
      aggiungereMessaggio({ autore: "SISTEMA", testo: "Non ho potuto allegare " + file.name + ": " + errore.message, ora: oraAttuale() }, false);
    }
    disegnareAllegati();
  }
}

/* ------------------------------------------------------------------ intro */

function mostrareIntro() {
  const intro = elemento("intro");
  const punti = intro.querySelectorAll("#intro-punti i");
  document.body.classList.add("in-intro");
  intro.hidden = false;
  const inizio = performance.now();
  function passo(adesso) {
    const avanzamento = Math.min(1, Math.max(0, (adesso - inizio - 600) / (DURATA_INTRO_MILLISECONDI - 1100)));
    const numeroFase = Math.min(FASI_INTRO.length - 1, Math.floor(avanzamento * FASI_INTRO.length));
    elemento("intro-fase").textContent = FASI_INTRO[numeroFase];
    elemento("intro-avanzamento").style.width = (avanzamento * 100).toFixed(1) + "%";
    elemento("intro-percentuale").textContent = Math.round(avanzamento * 100) + "%";
    punti.forEach((punto, indice) => punto.classList.toggle("acceso", indice <= numeroFase));
    if (adesso - inizio < DURATA_INTRO_MILLISECONDI) {
      requestAnimationFrame(passo);
    } else {
      intro.classList.add("fine");
      document.body.classList.remove("in-intro");
      setTimeout(() => { intro.hidden = true; }, 800);
    }
  }
  requestAnimationFrame(passo);
}

/* ------------------------------------------------------------------ reattore */
/* Nucleo a due colori: metà azzurra e metà arancione, anelli concentrici con tacche, archi luminosi,
   mirino, colonne di dati e linee che escono verso l'esterno. Tutto disegnato al volo, senza immagini. */

const reattore = {
  tela: null, contesto: null, larghezza: 0, altezza: 0, densita: 1,
  colori: { principale: [0, 212, 255], ascolto: [45, 255, 154], elabora: [255, 176, 32] },
  colore: [0, 212, 255], velocita: 1, ampiezza: 0.12,
  fase: 0, faseOnde: 0, istantePrecedente: 0,
  linee: [], blocchi: [], colonne: [], onde: [], ultimaOnda: 0,
};
const DUE_PI = Math.PI * 2;
const ARANCIONE_FISSO = [255, 138, 40];

function leggereColoriTema() {
  const stile = getComputedStyle(document.body);
  for (const chiave of ["principale", "ascolto", "elabora"]) {
    const numeri = stile.getPropertyValue("--" + chiave).split(",").map((numero) => Number(numero.trim()));
    if (numeri.length === 3 && numeri.every((numero) => Number.isFinite(numero))) {
      reattore.colori[chiave] = numeri;
    }
  }
}

function preparareReattore() {
  reattore.tela = elemento("reattore");
  reattore.contesto = reattore.tela.getContext("2d");
  let seme = 11;
  const casuale = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  // linee che escono dal nucleo: partenza, lunghezza, eventuale gomito, puntino finale
  for (let numero = 0; numero < 34; numero += 1) {
    reattore.linee.push({
      angolo: casuale() * DUE_PI, partenza: 1.03 + casuale() * 0.1, lunghezza: 0.12 + casuale() * 0.5,
      gomito: casuale() > 0.55 ? (casuale() > 0.5 ? 1 : -1) * (0.05 + casuale() * 0.12) : 0,
      puntino: casuale() > 0.35, sfasamento: casuale() * DUE_PI, velocita: 0.4 + casuale() * 1.4,
    });
  }
  // piccoli rettangoli arancioni in alto
  for (let numero = 0; numero < 11; numero += 1) {
    const dalLatoSinistro = numero < 6;
    reattore.blocchi.push({
      angolo: (dalLatoSinistro ? -2.25 + casuale() * 0.9 : -1.15 + casuale() * 0.8),
      raggio: 1.08 + casuale() * 0.3, larghezza: 5 + casuale() * 12, altezza: 5 + casuale() * 9,
      sfasamento: casuale() * DUE_PI, velocita: 0.6 + casuale() * 1.6,
    });
  }
  // colonne di "dati": quattro gruppi ai lati
  for (const [lato, altezzaRelativa] of [[-1, -0.5], [-1, 0.28], [1, -0.58], [1, 0.3]]) {
    const righe = [];
    for (let riga = 0; riga < 15; riga += 1) {
      righe.push({ blocchi: 2 + Math.floor(casuale() * 5), larghezza: 0.3 + casuale() * 0.7 });
    }
    reattore.colonne.push({ lato, altezzaRelativa, righe, sfasamento: casuale() * DUE_PI });
  }
  const adattare = () => {
    const riquadro = reattore.tela.getBoundingClientRect();
    reattore.densita = Math.min(window.devicePixelRatio || 1, 2);
    reattore.larghezza = riquadro.width;
    reattore.altezza = riquadro.height;
    reattore.tela.width = Math.round(riquadro.width * reattore.densita);
    reattore.tela.height = Math.round(riquadro.height * reattore.densita);
  };
  new ResizeObserver(adattare).observe(reattore.tela);
  adattare();
  leggereColoriTema();
  requestAnimationFrame(disegnareReattore);
}

function mescolareColori(primo, secondo, quota) {
  return [primo[0] + (secondo[0] - primo[0]) * quota, primo[1] + (secondo[1] - primo[1]) * quota, primo[2] + (secondo[2] - primo[2]) * quota];
}

function tinta(colore, opacita) {
  return "rgba(" + Math.round(colore[0]) + "," + Math.round(colore[1]) + "," + Math.round(colore[2]) + "," + Math.max(0, Math.min(1, opacita)) + ")";
}

function disegnareReattore(adesso) {
  requestAnimationFrame(disegnareReattore);
  if (document.hidden || reattore.larghezza < 10) {
    reattore.istantePrecedente = adesso;
    return;
  }
  const intervallo = Math.min((adesso - reattore.istantePrecedente) / 1000 || 0.016, 0.1);
  reattore.istantePrecedente = adesso;
  const tempo = adesso / 1000;
  const parametri = PARAMETRI_STATO[situazione.stato] || PARAMETRI_STATO.attesa;
  const coloreObiettivo = reattore.colori[parametri.colore];
  const morbidezza = Math.min(1, intervallo * 6);
  for (let canale = 0; canale < 3; canale += 1) {
    reattore.colore[canale] += (coloreObiettivo[canale] - reattore.colore[canale]) * morbidezza;
  }
  reattore.velocita += (parametri.velocita - reattore.velocita) * Math.min(1, intervallo * 4);
  let ampiezzaObiettivo = parametri.ampiezza;
  if (situazione.stato === "parlo") {
    ampiezzaObiettivo *= 0.4 + 0.6 * Math.abs(Math.sin(reattore.faseOnde * 0.9) * Math.sin(reattore.faseOnde * 0.37 + 1));
  } else if (situazione.stato === "ascolto") {
    ampiezzaObiettivo *= 0.55 + 0.45 * Math.abs(Math.sin(reattore.faseOnde * 0.6));
  }
  reattore.ampiezza += (ampiezzaObiettivo - reattore.ampiezza) * Math.min(1, intervallo * 10);
  reattore.fase += intervallo * reattore.velocita;
  reattore.faseOnde += intervallo * 6 * reattore.velocita;

  const contesto = reattore.contesto;
  const effetti = situazione.effetti;
  const fase = reattore.fase;
  const energia = Math.min(1, reattore.ampiezza);
  const lato1 = reattore.colore;                       // metà "fredda": segue lo stato (azzurro, verde, ambra)
  const lato2 = situazione.tema === "minimale" ? [255, 170, 80] : (situazione.tema === "rosso" ? [255, 200, 90] : ARANCIONE_FISSO);
  const divisione = 0.35 * Math.sin(tempo * 0.12);     // il confine tra le due metà ondeggia piano

  contesto.setTransform(reattore.densita, 0, 0, reattore.densita, 0, 0);
  contesto.clearRect(0, 0, reattore.larghezza, reattore.altezza);
  const centroX = reattore.larghezza / 2;
  const centroY = reattore.altezza / 2 - 6;
  const raggio = Math.max(40, Math.min((reattore.altezza - 34) / 2 / 1.0, reattore.larghezza * 0.3));
  contesto.globalCompositeOperation = "lighter";
  contesto.lineCap = "butt";

  const colorePerAngolo = (angolo) => {
    const verso = Math.cos(angolo - divisione);            // +1 = lato destro (arancione)
    const quota = Math.min(1, Math.max(0, 0.5 + verso * 1.25));
    return mescolareColori(lato1, lato2, quota);
  };
  // arco a più segmenti, ognuno col suo colore (così il passaggio azzurro → arancione è graduale)
  const arco = (r, inizio, fine, spessore, opacita) => {
    const passi = Math.max(1, Math.ceil(Math.abs(fine - inizio) / 0.22));
    contesto.lineWidth = spessore;
    for (let passo = 0; passo < passi; passo += 1) {
      const a0 = inizio + ((fine - inizio) * passo) / passi;
      const a1 = inizio + ((fine - inizio) * (passo + 1)) / passi + 0.012;
      contesto.strokeStyle = tinta(colorePerAngolo((a0 + a1) / 2), opacita);
      contesto.beginPath();
      contesto.arc(centroX, centroY, r, a0, a1);
      contesto.stroke();
    }
  };
  // anello tratteggiato
  const anelloTratteggiato = (r, spessore, opacita, trattini, rotazione, riempimento) => {
    const passo = DUE_PI / trattini;
    contesto.lineWidth = spessore;
    const gruppi = 24;
    for (let gruppo = 0; gruppo < gruppi; gruppo += 1) {
      const da = Math.floor((gruppo * trattini) / gruppi);
      const a = Math.floor(((gruppo + 1) * trattini) / gruppi);
      contesto.strokeStyle = tinta(colorePerAngolo(rotazione + ((da + a) / 2) * passo), opacita);
      contesto.beginPath();
      for (let numero = da; numero < a; numero += 1) {
        const inizio = rotazione + numero * passo;
        contesto.moveTo(centroX + Math.cos(inizio) * r, centroY + Math.sin(inizio) * r);
        contesto.arc(centroX, centroY, r, inizio, inizio + passo * riempimento);
      }
      contesto.stroke();
    }
  };
  // tacche radiali
  const tacche = (r, lunghezza, quante, rotazione, opacita, lungheOgni, aggiuntaLunghe) => {
    contesto.lineWidth = 1;
    const gruppi = 24;
    for (let gruppo = 0; gruppo < gruppi; gruppo += 1) {
      const da = Math.floor((gruppo * quante) / gruppi);
      const a = Math.floor(((gruppo + 1) * quante) / gruppi);
      contesto.strokeStyle = tinta(colorePerAngolo(rotazione + (((da + a) / 2) * DUE_PI) / quante), opacita);
      contesto.beginPath();
      for (let numero = da; numero < a; numero += 1) {
        const angolo = rotazione + (numero * DUE_PI) / quante;
        const lunga = lungheOgni && numero % lungheOgni === 0;
        const fine = r + lunghezza + (lunga ? aggiuntaLunghe : 0);
        contesto.moveTo(centroX + Math.cos(angolo) * r, centroY + Math.sin(angolo) * r);
        contesto.lineTo(centroX + Math.cos(angolo) * fine, centroY + Math.sin(angolo) * fine);
      }
      contesto.stroke();
    }
  };
  const bagliore = (x, y, r, colore, intensita) => {
    const gradiente = contesto.createRadialGradient(x, y, 0, x, y, r);
    gradiente.addColorStop(0, "rgba(255,255,255," + Math.min(1, intensita) + ")");
    gradiente.addColorStop(0.18, tinta(colore, 0.85 * intensita));
    gradiente.addColorStop(0.55, tinta(colore, 0.22 * intensita));
    gradiente.addColorStop(1, tinta(colore, 0));
    contesto.fillStyle = gradiente;
    contesto.beginPath();
    contesto.arc(x, y, r, 0, DUE_PI);
    contesto.fill();
  };

  // alone di fondo, diviso in due metà
  const aloneSinistro = contesto.createRadialGradient(centroX - raggio * 0.25, centroY, 0, centroX, centroY, raggio * 1.35);
  aloneSinistro.addColorStop(0, tinta(lato1, 0.20 + 0.08 * energia));
  aloneSinistro.addColorStop(0.6, tinta(lato1, 0.05));
  aloneSinistro.addColorStop(1, tinta(lato1, 0));
  contesto.fillStyle = aloneSinistro;
  contesto.fillRect(centroX - raggio * 1.4, centroY - raggio * 1.4, raggio * 1.4, raggio * 2.8);
  const aloneDestro = contesto.createRadialGradient(centroX + raggio * 0.25, centroY, 0, centroX, centroY, raggio * 1.35);
  aloneDestro.addColorStop(0, tinta(lato2, 0.20 + 0.08 * energia));
  aloneDestro.addColorStop(0.6, tinta(lato2, 0.05));
  aloneDestro.addColorStop(1, tinta(lato2, 0));
  contesto.fillStyle = aloneDestro;
  contesto.fillRect(centroX, centroY - raggio * 1.4, raggio * 1.4, raggio * 2.8);

  // linee che escono dal nucleo, con gomiti e puntini
  contesto.lineWidth = 1;
  for (const linea of reattore.linee) {
    const lampeggio = effetti ? 0.55 + 0.45 * Math.sin(tempo * linea.velocita + linea.sfasamento) : 0.7;
    const colore = colorePerAngolo(linea.angolo);
    const inizioX = centroX + Math.cos(linea.angolo) * raggio * linea.partenza;
    const inizioY = centroY + Math.sin(linea.angolo) * raggio * linea.partenza;
    let fineX = centroX + Math.cos(linea.angolo) * raggio * (linea.partenza + linea.lunghezza);
    let fineY = centroY + Math.sin(linea.angolo) * raggio * (linea.partenza + linea.lunghezza);
    contesto.strokeStyle = tinta(colore, 0.5 * lampeggio);
    contesto.beginPath();
    contesto.moveTo(inizioX, inizioY);
    if (linea.gomito) {
      const mezzoX = (inizioX + fineX) / 2;
      const mezzoY = (inizioY + fineY) / 2;
      const deviazione = raggio * linea.gomito;
      contesto.lineTo(mezzoX, mezzoY);
      fineX = mezzoX + Math.cos(linea.angolo + Math.PI / 2) * deviazione + Math.cos(linea.angolo) * raggio * 0.05;
      fineY = mezzoY + Math.sin(linea.angolo + Math.PI / 2) * deviazione + Math.sin(linea.angolo) * raggio * 0.05;
    }
    contesto.lineTo(fineX, fineY);
    contesto.stroke();
    if (linea.puntino) {
      contesto.fillStyle = tinta(colore, 0.9 * lampeggio);
      contesto.beginPath();
      contesto.arc(fineX, fineY, 2, 0, DUE_PI);
      contesto.fill();
    }
  }

  // rettangolini arancioni
  for (const blocco of reattore.blocchi) {
    const luce = effetti ? 0.45 + 0.55 * Math.abs(Math.sin(tempo * blocco.velocita + blocco.sfasamento)) : 0.8;
    contesto.fillStyle = tinta(lato2, 0.75 * luce);
    contesto.fillRect(centroX + Math.cos(blocco.angolo) * raggio * blocco.raggio, centroY + Math.sin(blocco.angolo) * raggio * blocco.raggio, blocco.larghezza, blocco.altezza);
  }

  // colonne di dati
  for (const colonna of reattore.colonne) {
    const luce = effetti ? 0.5 + 0.5 * Math.sin(tempo * 1.3 + colonna.sfasamento) : 0.8;
    const baseX = centroX + colonna.lato * raggio * 1.2;
    const baseY = centroY + colonna.altezzaRelativa * raggio;
    const scorrimento = effetti ? Math.floor(tempo * 3 + colonna.sfasamento * 4) : 0;
    contesto.fillStyle = tinta(colorePerAngolo(colonna.lato > 0 ? 0 : Math.PI), 0.55 * luce + 0.15);
    for (let riga = 0; riga < colonna.righe.length; riga += 1) {
      const dati = colonna.righe[(riga + scorrimento) % colonna.righe.length];
      const y = baseY + riga * 5;
      let x = baseX;
      for (let blocco = 0; blocco < dati.blocchi; blocco += 1) {
        const larghezza = 3 + dati.larghezza * 6 + (blocco % 2) * 3;
        const sinistra = colonna.lato > 0 ? x : x - larghezza;
        contesto.fillRect(sinistra, y, larghezza, 2);
        x += colonna.lato * (larghezza + 3);
      }
    }
  }

  // cerchi sottili e tacche esterne
  arco(raggio * 1.0, 0, DUE_PI, 1, 0.35);
  tacche(raggio * 1.0, 4, 180, fase * 0.01, 0.35, 5, 5);
  arco(raggio * 0.96, 0, DUE_PI, 1, 0.16);

  // mirino: due linee che attraversano il nucleo, con tacche
  contesto.lineWidth = 1;
  for (const [direzioneX, direzioneY] of [[1, 0], [0, 1]]) {
    contesto.strokeStyle = tinta(mescolareColori(lato1, lato2, 0.5), 0.28);
    contesto.beginPath();
    contesto.moveTo(centroX - direzioneX * raggio * 1.0, centroY - direzioneY * raggio * 1.0);
    contesto.lineTo(centroX + direzioneX * raggio * 1.0, centroY + direzioneY * raggio * 1.0);
    contesto.stroke();
    for (let passo = -10; passo <= 10; passo += 1) {
      if (passo === 0) { continue; }
      const posizione = (passo / 10) * raggio * 0.96;
      const lunghezza = passo % 5 === 0 ? 7 : 3.5;
      contesto.beginPath();
      contesto.moveTo(centroX + direzioneX * posizione - direzioneY * lunghezza, centroY + direzioneY * posizione - direzioneX * lunghezza);
      contesto.lineTo(centroX + direzioneX * posizione + direzioneY * lunghezza, centroY + direzioneY * posizione + direzioneX * lunghezza);
      contesto.stroke();
    }
  }

  // anelli
  anelloTratteggiato(raggio * 0.90, 2, 0.8, 54, fase * 0.12, 0.62);
  arco(raggio * 0.82, 0, DUE_PI, 1.5, 0.5);
  anelloTratteggiato(raggio * 0.74, 3, 0.7, 36, -fase * 0.2, 0.45);
  tacche(raggio * 0.64, 6, 220, -fase * 0.05, 0.55, 5, 4);
  arco(raggio * 0.62, 0, DUE_PI, 1, 0.5);
  // fascia scura-luminosa (la "lente")
  arco(raggio * 0.54, 0, DUE_PI, 14, 0.09);
  arco(raggio * 0.5, 0, DUE_PI, 2, 0.65);
  anelloTratteggiato(raggio * 0.44, 2, 0.6, 28, fase * 0.35, 0.55);
  tacche(raggio * 0.34, 7, 120, fase * 0.09, 0.6, 4, 3);
  arco(raggio * 0.33, 0, DUE_PI, 1.5, 0.6);
  arco(raggio * 0.24, 0, DUE_PI, 1, 0.45);

  // archi luminosi spessi con alone
  if (effetti) {
    contesto.shadowBlur = 16;
  }
  contesto.lineCap = "round";
  contesto.shadowColor = tinta(lato1, 0.95);
  contesto.strokeStyle = tinta(lato1, 0.95);
  contesto.lineWidth = 4.5;
  contesto.beginPath();
  contesto.arc(centroX, centroY, raggio * 0.86, 2.0 + 0.06 * Math.sin(tempo * 0.5), 4.1 + 0.06 * Math.sin(tempo * 0.5));
  contesto.stroke();
  contesto.shadowColor = tinta(lato2, 0.95);
  contesto.strokeStyle = tinta(lato2, 0.95);
  contesto.lineWidth = 5.5;
  contesto.beginPath();
  contesto.arc(centroX, centroY, raggio * 0.78, -1.05 + 0.05 * Math.sin(tempo * 0.4), 0.7 + 0.05 * Math.sin(tempo * 0.4));
  contesto.stroke();
  contesto.strokeStyle = tinta(mescolareColori(lato1, [255, 255, 255], 0.6), 0.9);
  contesto.lineWidth = 3;
  contesto.beginPath();
  contesto.arc(centroX, centroY, raggio * 0.7, 1.15, 1.75);
  contesto.stroke();
  contesto.shadowBlur = 0;
  contesto.lineCap = "butt";

  // barrette che seguono la voce
  const barre = 120;
  const raggioBarre = raggio * 0.4;
  contesto.lineWidth = 2;
  for (let numero = 0; numero < barre; numero += 1) {
    const angolo = (numero / barre) * DUE_PI - Math.PI / 2;
    const simmetrico = numero < barre / 2 ? numero : barre - numero;
    const rumore = 0.5 + 0.5 * Math.sin(simmetrico * 0.5 + reattore.faseOnde * 1.7) * Math.sin(simmetrico * 0.21 - reattore.faseOnde * 0.9 + 1.3);
    const lunghezza = raggio * (0.012 + 0.1 * reattore.ampiezza * rumore);
    contesto.strokeStyle = tinta(colorePerAngolo(angolo), 0.3 + 0.6 * rumore * Math.min(1, reattore.ampiezza + 0.2));
    contesto.beginPath();
    contesto.moveTo(centroX + Math.cos(angolo) * raggioBarre, centroY + Math.sin(angolo) * raggioBarre);
    contesto.lineTo(centroX + Math.cos(angolo) * (raggioBarre + lunghezza), centroY + Math.sin(angolo) * (raggioBarre + lunghezza));
    contesto.stroke();
  }

  // onde che si allargano quando parla o ascolta
  if (effetti) {
    if ((situazione.stato === "parlo" || situazione.stato === "ascolto") && adesso - reattore.ultimaOnda > 650) {
      reattore.ultimaOnda = adesso;
      reattore.onde.push(adesso);
    }
    reattore.onde = reattore.onde.filter((nascita) => adesso - nascita < 1900);
    for (const nascita of reattore.onde) {
      const eta = (adesso - nascita) / 1900;
      arco(raggio * (0.2 + 0.85 * eta), 0, DUE_PI, 1.5, 0.4 * (1 - eta));
    }
  }

  // nucleo centrale: sfera con riflesso
  const raggioNucleo = raggio * (0.085 + 0.012 * energia + (effetti ? 0.006 * Math.sin(tempo * 2.2) : 0));
  const sfera = contesto.createRadialGradient(centroX - raggioNucleo * 0.3, centroY - raggioNucleo * 0.35, 0, centroX, centroY, raggioNucleo * 2.4);
  sfera.addColorStop(0, "rgba(255,255,255,0.95)");
  sfera.addColorStop(0.2, tinta(mescolareColori(lato1, lato2, 0.3), 0.9));
  sfera.addColorStop(0.5, tinta(lato1, 0.3));
  sfera.addColorStop(1, tinta(lato1, 0));
  contesto.fillStyle = sfera;
  contesto.beginPath();
  contesto.arc(centroX, centroY, raggioNucleo * 2.4, 0, DUE_PI);
  contesto.fill();
  arco(raggioNucleo * 1.5, 0, DUE_PI, 1.5, 0.8);
  arco(raggioNucleo * 2.1, fase * 0.5, fase * 0.5 + 4.2, 1.5, 0.7);

  // lampi di luce che scorrono sugli anelli
  const oscillazione = effetti ? 0.18 * Math.sin(tempo * 0.35) : 0;
  const luceFlare = 0.7 + 0.3 * energia;
  const posizioni = [
    [3.55 + oscillazione, 0.8, lato1], [1.62 - oscillazione, 0.84, lato1], [0.18 + oscillazione * 0.6, 0.86, lato2],
  ];
  for (const [angolo, frazione, coloreLampo] of posizioni) {
    bagliore(centroX + Math.cos(angolo) * raggio * frazione, centroY + Math.sin(angolo) * raggio * frazione, raggio * 0.22, coloreLampo, luceFlare);
  }
  contesto.globalCompositeOperation = "source-over";
}

/* ------------------------------------------------------------------ universo */
/* Stelle che volano verso di noi, con nebulose lente sullo sfondo. Durante l'intro corrono veloci (effetto "salto
   nell'iperspazio") e poi si calmano. Si muovono un po' di più quando Jarvis elabora o parla. */

const universo = {
  tela: null, contesto: null, larghezza: 0, altezza: 0, densita: 1,
  stelle: [], meteore: [], nebulose: null, velocita: 6, istantePrecedente: 0, prossimaMeteora: 0,
};

function preparareUniverso() {
  universo.tela = elemento("universo");
  universo.contesto = universo.tela.getContext("2d");
  let seme = 29;
  const casuale = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  for (let numero = 0; numero < 420; numero += 1) {
    universo.stelle.push({
      x: casuale() * 2 - 1, y: casuale() * 2 - 1, profondita: 0.15 + casuale() * 0.85,
      dimensione: 0.7 + casuale() * 1.8, sfasamento: casuale() * Math.PI * 2, calore: casuale(),
    });
  }
  const adattare = () => {
    universo.densita = Math.min(window.devicePixelRatio || 1, 1.5);
    universo.larghezza = window.innerWidth;
    universo.altezza = window.innerHeight;
    universo.tela.width = Math.round(universo.larghezza * universo.densita);
    universo.tela.height = Math.round(universo.altezza * universo.densita);
    universo.nebulose = null;
  };
  window.addEventListener("resize", adattare);
  adattare();
  requestAnimationFrame(disegnareUniverso);
}

function disegnareNebulose() {
  // nuvole di gas colorate: disegnate una volta sola su una tela più grande dello schermo e fatte scorrere piano
  const tela = document.createElement("canvas");
  tela.width = Math.round(universo.larghezza * 1.3 / 2);
  tela.height = Math.round(universo.altezza * 1.3 / 2);
  const contesto = tela.getContext("2d");
  const [rosso, verde, blu] = reattore.colori.principale;
  const nuvole = [
    [0.22, 0.30, 0.42, [rosso, verde, blu], 0.26], [0.78, 0.22, 0.34, [255, 138, 40], 0.17],
    [0.62, 0.78, 0.46, [Math.round(rosso * 0.6 + 60), Math.round(verde * 0.4 + 30), Math.round(blu * 0.9)], 0.22],
    [0.10, 0.85, 0.30, [255, 138, 40], 0.12], [0.50, 0.50, 0.55, [rosso, verde, blu], 0.08],
  ];
  for (const [posizioneX, posizioneY, raggioRelativo, colore, intensita] of nuvole) {
    const centroX = posizioneX * tela.width;
    const centroY = posizioneY * tela.height;
    const raggio = raggioRelativo * Math.max(tela.width, tela.height);
    const gradiente = contesto.createRadialGradient(centroX, centroY, 0, centroX, centroY, raggio);
    gradiente.addColorStop(0, "rgba(" + colore.join(",") + "," + intensita + ")");
    gradiente.addColorStop(0.5, "rgba(" + colore.join(",") + "," + intensita * 0.35 + ")");
    gradiente.addColorStop(1, "rgba(" + colore.join(",") + ",0)");
    contesto.fillStyle = gradiente;
    contesto.fillRect(0, 0, tela.width, tela.height);
  }
  return tela;
}

function disegnareUniverso(adesso) {
  requestAnimationFrame(disegnareUniverso);
  if (document.hidden || universo.larghezza < 10) {
    universo.istantePrecedente = adesso;
    return;
  }
  const intervallo = Math.min((adesso - universo.istantePrecedente) / 1000 || 0.016, 0.1);
  universo.istantePrecedente = adesso;
  const tempo = adesso / 1000;
  const inIntro = document.body.classList.contains("in-intro");
  const effetti = situazione.effetti;
  let velocitaObiettivo = inIntro ? 7 : (situazione.stato === "elaboro" ? 0.55 : (situazione.stato === "ascolto" ? -0.28 : (situazione.stato === "parlo" ? 0.3 : 0.12)));
  if (!effetti) { velocitaObiettivo = 0; }
  universo.velocita += (velocitaObiettivo - universo.velocita) * Math.min(1, intervallo * (inIntro ? 2 : 1.2));

  const contesto = universo.contesto;
  const larghezza = universo.larghezza;
  const altezza = universo.altezza;
  contesto.setTransform(universo.densita, 0, 0, universo.densita, 0, 0);
  contesto.clearRect(0, 0, larghezza, altezza);
  if (!universo.nebulose) { universo.nebulose = disegnareNebulose(); }
  // nebulose che scorrono lentamente e "respirano"
  const spostamentoX = effetti ? Math.sin(tempo * 0.021) * 0.06 * larghezza : 0;
  const spostamentoY = effetti ? Math.cos(tempo * 0.017) * 0.05 * altezza : 0;
  contesto.globalAlpha = 0.8 + (effetti ? 0.2 * Math.sin(tempo * 0.15) : 0);
  contesto.drawImage(universo.nebulose, -0.15 * larghezza + spostamentoX, -0.15 * altezza + spostamentoY, larghezza * 1.3, altezza * 1.3);
  contesto.globalAlpha = 1;

  const centroX = larghezza / 2;
  const centroY = altezza * 0.42;
  const scala = Math.max(larghezza, altezza) * 0.62;
  const caldo = situazione.tema === "rosso";
  contesto.globalCompositeOperation = "lighter";
  for (const stella of universo.stelle) {
    const avanzamento = intervallo * universo.velocita * stella.profondita;
    const fattore = 1 + avanzamento * 1.4;
    const vecchioX = stella.x;
    const vecchioY = stella.y;
    stella.x *= fattore;
    stella.y *= fattore;
    stella.x += intervallo * 0.004 * stella.profondita * (effetti ? 1 : 0);   // leggera deriva laterale
    if (Math.abs(stella.x) > 1.25 || Math.abs(stella.y) > 1.25 || (Math.abs(stella.x) < 0.0008 && Math.abs(stella.y) < 0.0008)) {
      const angolo = Math.random() * Math.PI * 2;
      const distanza = 0.02 + Math.random() * 0.5;
      stella.x = Math.cos(angolo) * distanza;
      stella.y = Math.sin(angolo) * distanza;
      continue;
    }
    const puntoX = centroX + stella.x * scala;
    const puntoY = centroY + stella.y * scala;
    const crescita = Math.min(1, Math.hypot(stella.x, stella.y) * 3);       // le stelle nascono piccole e scure al centro
    const brillio = effetti ? 0.65 + 0.35 * Math.sin(tempo * (0.8 + stella.profondita * 2) + stella.sfasamento) : 0.8;
    const opacita = Math.min(1, (0.45 + stella.profondita * 0.75) * brillio * (0.55 + crescita * 0.45));
    const tinta = caldo ? [255, 225 - stella.calore * 60, 190 - stella.calore * 80] : [190 + stella.calore * 55, 220 + stella.calore * 25, 255 - stella.calore * 40];
    contesto.strokeStyle = "rgba(" + tinta.map(Math.round).join(",") + "," + opacita + ")";
    contesto.fillStyle = contesto.strokeStyle;
    const raggio = stella.dimensione * (0.55 + stella.profondita * 0.6) * (0.5 + crescita * 0.7);
    const lunghezzaScia = Math.hypot((stella.x - vecchioX) * scala, (stella.y - vecchioY) * scala);
    if (lunghezzaScia > 1.2) {
      contesto.lineWidth = raggio * 1.3;
      contesto.lineCap = "round";
      contesto.beginPath();
      contesto.moveTo(centroX + vecchioX * scala, centroY + vecchioY * scala);
      contesto.lineTo(puntoX, puntoY);
      contesto.stroke();
    } else {
      contesto.beginPath();
      contesto.arc(puntoX, puntoY, raggio, 0, Math.PI * 2);
      contesto.fill();
      if (stella.dimensione > 1.9 && stella.profondita > 0.6) {          // le stelle più grandi hanno un piccolo alone
        contesto.globalAlpha = 0.25;
        contesto.beginPath();
        contesto.arc(puntoX, puntoY, raggio * 3.2, 0, Math.PI * 2);
        contesto.fill();
        contesto.globalAlpha = 1;
      }
    }
  }
  // ogni tanto passa una stella cadente
  if (effetti && !inIntro && adesso > universo.prossimaMeteora) {
    universo.prossimaMeteora = adesso + 5000 + Math.random() * 9000;
    const partenzaX = Math.random() * larghezza * 0.8;
    universo.meteore.push({ x: partenzaX, y: Math.random() * altezza * 0.35, nascita: adesso, velocitaX: 520 + Math.random() * 260, velocitaY: 190 + Math.random() * 120 });
  }
  universo.meteore = universo.meteore.filter((meteora) => adesso - meteora.nascita < 900);
  for (const meteora of universo.meteore) {
    const eta = (adesso - meteora.nascita) / 900;
    const testaX = meteora.x + meteora.velocitaX * eta * 0.9;
    const testaY = meteora.y + meteora.velocitaY * eta * 0.9;
    const gradiente = contesto.createLinearGradient(testaX, testaY, testaX - meteora.velocitaX * 0.12, testaY - meteora.velocitaY * 0.12);
    gradiente.addColorStop(0, "rgba(255,255,255," + (0.9 * (1 - eta)) + ")");
    gradiente.addColorStop(1, "rgba(150,200,255,0)");
    contesto.strokeStyle = gradiente;
    contesto.lineWidth = 1.6;
    contesto.lineCap = "round";
    contesto.beginPath();
    contesto.moveTo(testaX, testaY);
    contesto.lineTo(testaX - meteora.velocitaX * 0.12, testaY - meteora.velocitaY * 0.12);
    contesto.stroke();
  }
  contesto.globalCompositeOperation = "source-over";
}

/* ------------------------------------------------------------------ orologio e comandi */

function aggiornareOrologio() {
  const adesso = new Date();
  const dueCifre = (numero) => String(numero).padStart(2, "0");
  elemento("orologio").textContent = dueCifre(adesso.getHours()) + ":" + dueCifre(adesso.getMinutes()) + ":" + dueCifre(adesso.getSeconds());
  elemento("data").textContent = GIORNI[adesso.getDay()] + " " + adesso.getDate() + " " + MESI[adesso.getMonth()] + " " + adesso.getFullYear();
  if (situazione.scadenzaConferma && Date.now() > situazione.scadenzaConferma) {
    mostrareConferma(null);
  }
}

function collegareComandi() {
  elemento("ingresso").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const campo = elemento("campo");
    if (situazione.allegati.some((allegato) => !allegato.nome)) {
      return; // un file sta ancora caricando
    }
    inviare(campo.value, true);
    campo.value = "";
    campo.focus();
  });
  elemento("pulsante-stop").addEventListener("click", () => inviare("/stop", false));
  elemento("pulsante-zitto").addEventListener("click", () => inviare("/zitto", false));
  elemento("pulsante-microfono").addEventListener("click", () => chiamare("/api/microfono"));
  elemento("pulsante-allega").addEventListener("click", () => elemento("scelta-file").click());
  elemento("scelta-file").addEventListener("change", (evento) => {
    caricareFile(Array.from(evento.target.files || []));
    evento.target.value = "";
  });
  for (const pulsante of document.querySelectorAll("[data-comando]")) {
    pulsante.addEventListener("click", () => {
      elemento("menu-altro").hidden = true;
      inviare(pulsante.dataset.comando, false);
    });
  }
  for (const pulsante of document.querySelectorAll("[data-richiesta]")) {
    pulsante.addEventListener("click", () => {
      if (!situazione.allegati.some((allegato) => !allegato.nome)) {
        inviare(pulsante.dataset.richiesta, true);
      }
    });
  }
  elemento("pulsante-altro").addEventListener("click", (evento) => {
    evento.stopPropagation();
    elemento("menu-altro").hidden = !elemento("menu-altro").hidden;
  });
  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".contenitore-menu")) {
      elemento("menu-altro").hidden = true;
    }
    const collegamento = evento.target.closest("a[data-indirizzo]");
    if (collegamento) {
      evento.preventDefault();
      chiamare("/api/apri", { indirizzo: collegamento.dataset.indirizzo });
    }
  });
  elemento("conferma-si").addEventListener("click", () => { mostrareConferma(null); inviare("sì", false); });
  elemento("conferma-no").addEventListener("click", () => { mostrareConferma(null); inviare("no", false); });
  elemento("interruttore-voce").addEventListener("click", () => inviare(situazione.muto ? "/parla" : "/muto", false));
  elemento("interruttore-conferme").addEventListener("click", () => inviare("/conferme", false));
  elemento("interruttore-ascolto").addEventListener("click", () => inviare("/ascolto", false));
  elemento("interruttore-effetti").addEventListener("click", () => impostareEffetti(!situazione.effetti, true));
  for (const pulsante of document.querySelectorAll(".tema")) {
    pulsante.addEventListener("click", () => impostareTema(pulsante.dataset.tema, true));
  }
  elemento("pulsante-pulisci").addEventListener("click", () => chiamare("/api/pulisci"));
  elemento("qr-chiudi").addEventListener("click", () => { elemento("velo-qr").hidden = true; });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      elemento("menu-altro").hidden = true;
      elemento("velo-qr").hidden = true;
    } else if (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey && document.activeElement !== elemento("campo")) {
      elemento("campo").focus();
    }
  });

  // trascinare i file sulla finestra
  let trascinamenti = 0;
  window.addEventListener("dragenter", (evento) => {
    if (evento.dataTransfer && Array.from(evento.dataTransfer.types).includes("Files")) {
      trascinamenti += 1;
      elemento("trascina").hidden = false;
    }
  });
  window.addEventListener("dragleave", () => {
    trascinamenti = Math.max(0, trascinamenti - 1);
    if (trascinamenti === 0) { elemento("trascina").hidden = true; }
  });
  window.addEventListener("dragover", (evento) => evento.preventDefault());
  window.addEventListener("drop", (evento) => {
    evento.preventDefault();
    trascinamenti = 0;
    elemento("trascina").hidden = true;
    if (evento.dataTransfer && evento.dataTransfer.files.length) {
      caricareFile(Array.from(evento.dataTransfer.files));
    }
  });
  window.addEventListener("contextmenu", (evento) => {
    if (!evento.target.closest("#registro, #campo, #conferma, .scheda-qr")) {
      evento.preventDefault();
    }
  });
}

collegareComandi();
preparareReattore();
preparareUniverso();
aggiornareOrologio();
setInterval(aggiornareOrologio, 1000);
avviare();
elemento("campo").focus();
