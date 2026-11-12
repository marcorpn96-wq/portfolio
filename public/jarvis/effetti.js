"use strict";
/* Jarvis — animazioni a tutto schermo: griglia holografica, flusso di dati, cavi di energia, onde d'urto,
   bordi luminosi, radar dei sistemi, allarme, parallasse, glitch. Si spengono con l'interruttore «Effetti». */
(function () {
  const telaSfondo = document.getElementById("sfondo-effetti");
  const telaSopra = document.getElementById("sopra-effetti");
  if (!telaSfondo || !telaSopra) {
    return;
  }
  const contestoSfondo = telaSfondo.getContext("2d");
  const contestoSopra = telaSopra.getContext("2d");
  const corpo = document.body;
  const misure = { larghezza: 0, altezza: 0, densita: 1 };
  const colori = { principale: [0, 212, 255] };
  const puntatore = { x: 0, y: 0, obiettivoX: 0, obiettivoY: 0 };
  const geometria = { nucleo: { x: 0, y: 0 }, pannelli: [], cavi: [], radar: null, ultimoCalcolo: 0 };
  const onde = [];
  const impulsi = [];
  const allarme = { fino: 0, motivo: "", erroriVisti: "" };
  const ultimi = { fotogramma: 0, onda: 0, impulso: 0, colori: 0, glitch: 0 };
  const CARATTERI = "01ABCDEF<>/|+=#%$";
  const colonneDati = [];

  /* ------------------------------------------------------------ misure e geometria */

  function adattare() {
    misure.densita = Math.min(window.devicePixelRatio || 1, 1.5);
    misure.larghezza = window.innerWidth;
    misure.altezza = window.innerHeight;
    for (const tela of [telaSfondo, telaSopra]) {
      tela.width = Math.round(misure.larghezza * misure.densita);
      tela.height = Math.round(misure.altezza * misure.densita);
    }
    preparareColonneDati();
    geometria.ultimoCalcolo = 0;
  }

  function preparareColonneDati() {
    colonneDati.length = 0;
    const perLato = 9;
    for (let lato = 0; lato < 2; lato += 1) {
      for (let numero = 0; numero < perLato; numero += 1) {
        colonneDati.push({
          x: lato === 0 ? 5 + numero * 24 : misure.larghezza - 8 - numero * 24,
          bordo: numero < 2,
          testa: Math.random() * misure.altezza,
          velocita: 40 + Math.random() * 110,
          lunghezza: 9 + Math.floor(Math.random() * 12),
          caratteri: Array.from({ length: 24 }, () => CARATTERI[Math.floor(Math.random() * CARATTERI.length)]),
        });
      }
    }
  }

  function campionareRettangolo(rettangolo, raggio) {
    // punti lungo il contorno di un rettangolo con gli angoli arrotondati, uno ogni ~3 pixel
    const punti = [];
    const passo = 3;
    const { x, y, width: larghezza, height: altezza } = rettangolo;
    const r = Math.max(2, Math.min(raggio, larghezza / 2, altezza / 2));
    const aggiungereLinea = (daX, daY, aX, aY) => {
      const lunghezza = Math.hypot(aX - daX, aY - daY);
      const quanti = Math.max(1, Math.round(lunghezza / passo));
      for (let numero = 0; numero < quanti; numero += 1) {
        punti.push([daX + ((aX - daX) * numero) / quanti, daY + ((aY - daY) * numero) / quanti]);
      }
    };
    const aggiungereArco = (centroX, centroY, daAngolo) => {
      const quanti = Math.max(3, Math.round((Math.PI / 2) * r / passo));
      for (let numero = 0; numero < quanti; numero += 1) {
        const angolo = daAngolo + ((Math.PI / 2) * numero) / quanti;
        punti.push([centroX + Math.cos(angolo) * r, centroY + Math.sin(angolo) * r]);
      }
    };
    aggiungereLinea(x + r, y, x + larghezza - r, y);
    aggiungereArco(x + larghezza - r, y + r, -Math.PI / 2);
    aggiungereLinea(x + larghezza, y + r, x + larghezza, y + altezza - r);
    aggiungereArco(x + larghezza - r, y + altezza - r, 0);
    aggiungereLinea(x + larghezza - r, y + altezza, x + r, y + altezza);
    aggiungereArco(x + r, y + altezza - r, Math.PI / 2);
    aggiungereLinea(x, y + altezza - r, x, y + r);
    aggiungereArco(x + r, y + r, Math.PI);
    return punti;
  }

  function ricalcolareGeometria(adesso) {
    if (adesso - geometria.ultimoCalcolo < 1000) {
      return;
    }
    geometria.ultimoCalcolo = adesso;
    const reattore = document.getElementById("reattore");
    if (reattore) {
      const area = reattore.getBoundingClientRect();
      geometria.nucleo = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
    }
    const elencoPannelli = [];
    for (const selettore of ["#colonna-sinistra > section", "#colonna-destra > section", "#registro-cornice"]) {
      for (const sezione of document.querySelectorAll(selettore)) {
        const area = sezione.getBoundingClientRect();
        if (area.width < 40 || area.height < 40) {
          continue;
        }
        const raggio = parseFloat(getComputedStyle(sezione).borderTopLeftRadius) || 14;
        const esistente = geometria.pannelli.find((voce) => voce.elemento === sezione);
        elencoPannelli.push({
          elemento: sezione, area, contorno: campionareRettangolo(area, raggio),
          fase: esistente ? esistente.fase : Math.random(), velocita: esistente ? esistente.velocita : 0.05 + Math.random() * 0.05,
        });
      }
    }
    geometria.pannelli = elencoPannelli;
    geometria.cavi = elencoPannelli.filter((voce) => voce.elemento.id !== "registro-cornice").map((voce) => {
      const aSinistra = voce.area.left + voce.area.width / 2 < misure.larghezza / 2;
      const partenzaX = aSinistra ? voce.area.right : voce.area.left;
      const partenzaY = voce.area.top + Math.min(voce.area.height / 2, 140);
      return { partenzaX, partenzaY, controlloX: partenzaX + (geometria.nucleo.x - partenzaX) * 0.55, controlloY: partenzaY };
    });
    const scena = document.getElementById("scena");
    if (scena && misure.larghezza >= 1000) {
      const area = scena.getBoundingClientRect();
      geometria.radar = { x: area.right - 66, y: area.top + 150, raggio: 46 };
    } else {
      geometria.radar = null;
    }
  }

  function punto_su_curva(cavo, parametro) {
    const inverso = 1 - parametro;
    return [
      inverso * inverso * cavo.partenzaX + 2 * inverso * parametro * cavo.controlloX + parametro * parametro * geometria.nucleo.x,
      inverso * inverso * cavo.partenzaY + 2 * inverso * parametro * cavo.controlloY + parametro * parametro * geometria.nucleo.y,
    ];
  }

  function leggereColori(adesso) {
    if (adesso - ultimi.colori < 1000) {
      return;
    }
    ultimi.colori = adesso;
    const valore = getComputedStyle(corpo).getPropertyValue("--principale");
    const numeri = valore.split(",").map((pezzo) => parseInt(pezzo, 10));
    if (numeri.length === 3 && numeri.every((numero) => Number.isFinite(numero))) {
      colori.principale = numeri;
    }
  }

  const colore = (opacita) => "rgba(" + colori.principale.join(",") + "," + opacita + ")";

  /* ------------------------------------------------------------ sfondo: griglia, flusso di dati, cavi */

  function disegnareGriglia(contesto, tempo) {
    const orizzonte = misure.altezza * 0.64;
    const centroX = misure.larghezza / 2;
    const profondita = misure.altezza - orizzonte;
    contesto.lineWidth = 1;
    const quanteOrizzontali = 14;
    const scorrimento = (tempo * 0.12) % 1;
    for (let numero = 0; numero < quanteOrizzontali; numero += 1) {
      const z = (numero + scorrimento) / quanteOrizzontali;
      const y = orizzonte + profondita * z * z;
      const onda = 0.5 + 0.5 * Math.sin(z * 9 - tempo * 1.6);
      contesto.strokeStyle = colore(0.04 + z * 0.08 + onda * z * 0.13);
      contesto.beginPath();
      contesto.moveTo(0, y);
      contesto.lineTo(misure.larghezza, y);
      contesto.stroke();
    }
    const passoBase = misure.larghezza * 0.075;
    for (let numero = -16; numero <= 16; numero += 1) {
      contesto.strokeStyle = colore(0.075);
      contesto.beginPath();
      contesto.moveTo(centroX + numero * passoBase * 0.05, orizzonte);
      contesto.lineTo(centroX + numero * passoBase, misure.altezza);
      contesto.stroke();
    }
    const sfumatura = contesto.createLinearGradient(0, orizzonte - 30, 0, orizzonte + 60);
    sfumatura.addColorStop(0, colore(0));
    sfumatura.addColorStop(0.5, colore(0.07));
    sfumatura.addColorStop(1, colore(0));
    contesto.fillStyle = sfumatura;
    contesto.fillRect(0, orizzonte - 30, misure.larghezza, 90);
  }

  function disegnareFlussoDati(contesto, intervallo) {
    const carico = window.jarvisPc && Number.isFinite(window.jarvisPc.cpu) ? window.jarvisPc.cpu : 20;
    const moltiplicatore = 0.5 + (carico / 100) * 2.5 + (corpo.dataset.stato === "elaboro" ? 1.2 : 0);
    contesto.font = "10px Consolas, 'Cascadia Mono', monospace";
    contesto.textBaseline = "top";
    for (const colonna of colonneDati) {
      colonna.testa += colonna.velocita * moltiplicatore * intervallo;
      if (colonna.testa - colonna.lunghezza * 12 > misure.altezza) {
        colonna.testa = -Math.random() * 200;
        colonna.velocita = 40 + Math.random() * 110;
      }
      if (Math.random() < 0.08) {
        colonna.caratteri[Math.floor(Math.random() * colonna.caratteri.length)] = CARATTERI[Math.floor(Math.random() * CARATTERI.length)];
      }
      for (let posizione = 0; posizione < colonna.lunghezza; posizione += 1) {
        const y = colonna.testa - posizione * 12;
        if (y < -12 || y > misure.altezza) {
          continue;
        }
        const dissolvenza = 1 - posizione / colonna.lunghezza;
        const base = colonna.bordo ? 0.38 : 0.1;
        contesto.fillStyle = posizione === 0 ? "rgba(220,250,255," + base * 1.6 + ")" : colore(base * dissolvenza);
        contesto.fillText(colonna.caratteri[posizione % colonna.caratteri.length], colonna.x, y);
      }
    }
  }

  function disegnareCavi(contesto, adesso, intervallo) {
    if (!geometria.cavi.length) {
      return;
    }
    contesto.lineWidth = 1;
    contesto.strokeStyle = colore(0.24);
    for (const cavo of geometria.cavi) {
      contesto.beginPath();
      contesto.moveTo(cavo.partenzaX, cavo.partenzaY);
      contesto.quadraticCurveTo(cavo.controlloX, cavo.controlloY, geometria.nucleo.x, geometria.nucleo.y);
      contesto.stroke();
      contesto.fillStyle = colore(0.5);
      contesto.beginPath();
      contesto.arc(cavo.partenzaX, cavo.partenzaY, 2.2, 0, Math.PI * 2);
      contesto.fill();
    }
    const elaboro = corpo.dataset.stato === "elaboro";
    const attesaImpulso = elaboro ? 130 : 3500;
    if (adesso - ultimi.impulso > attesaImpulso && impulsi.length < 40) {
      ultimi.impulso = adesso;
      impulsi.push({ cavo: Math.floor(Math.random() * geometria.cavi.length), progresso: 0, velocita: (elaboro ? 0.7 : 0.35) + Math.random() * 0.2, inUscita: !elaboro && Math.random() < 0.3 });
    }
    contesto.globalCompositeOperation = "lighter";
    for (let numero = impulsi.length - 1; numero >= 0; numero -= 1) {
      const impulso = impulsi[numero];
      impulso.progresso += impulso.velocita * intervallo;
      const cavo = geometria.cavi[impulso.cavo];
      if (impulso.progresso >= 1 || !cavo) {
        impulsi.splice(numero, 1);
        continue;
      }
      const parametro = impulso.inUscita ? 1 - impulso.progresso : impulso.progresso;
      const [puntoX, puntoY] = punto_su_curva(cavo, parametro);
      const [codaX, codaY] = punto_su_curva(cavo, Math.max(0, Math.min(1, parametro + (impulso.inUscita ? 0.05 : -0.05))));
      contesto.strokeStyle = colore(0.85);
      contesto.lineWidth = 2;
      contesto.beginPath();
      contesto.moveTo(codaX, codaY);
      contesto.lineTo(puntoX, puntoY);
      contesto.stroke();
      const alone = contesto.createRadialGradient(puntoX, puntoY, 0, puntoX, puntoY, 9);
      alone.addColorStop(0, colore(0.7));
      alone.addColorStop(1, colore(0));
      contesto.fillStyle = alone;
      contesto.fillRect(puntoX - 9, puntoY - 9, 18, 18);
    }
    contesto.globalCompositeOperation = "source-over";
  }

  /* ------------------------------------------------------------ sopra: bordi, onde, radar, allarme */

  function disegnareBordiVivi(contesto, tempo) {
    contesto.lineCap = "round";
    contesto.lineWidth = 1.6;
    for (const pannello of geometria.pannelli) {
      const quanti = pannello.contorno.length;
      if (quanti < 20) {
        continue;
      }
      const testa = Math.floor((((tempo * pannello.velocita + pannello.fase) % 1) + 1) % 1 * quanti);
      const coda = 38;
      for (let passo = 0; passo < coda; passo += 1) {
        const da = pannello.contorno[(testa - passo + quanti) % quanti];
        const a = pannello.contorno[(testa - passo - 1 + quanti) % quanti];
        contesto.strokeStyle = colore((1 - passo / coda) * 0.85);
        contesto.beginPath();
        contesto.moveTo(da[0], da[1]);
        contesto.lineTo(a[0], a[1]);
        contesto.stroke();
      }
    }
  }

  function lanciareOnda() {
    const adesso = performance.now();
    if (adesso - ultimi.onda < 1500 || corpo.classList.contains("senza-effetti") || corpo.classList.contains("in-intro")) {
      return;
    }
    ultimi.onda = adesso;
    onde.push({ inizio: adesso });
  }

  function disegnareOnde(contesto, adesso) {
    const diagonale = Math.hypot(misure.larghezza, misure.altezza);
    for (let numero = onde.length - 1; numero >= 0; numero -= 1) {
      const progresso = (adesso - onde[numero].inizio) / 1900;
      if (progresso >= 1) {
        onde.splice(numero, 1);
        continue;
      }
      const raggio = progresso * diagonale * 0.7;
      const intensita = Math.pow(1 - progresso, 2);
      contesto.strokeStyle = colore(0.4 * intensita);
      contesto.lineWidth = 2.2;
      contesto.beginPath();
      contesto.arc(geometria.nucleo.x, geometria.nucleo.y, raggio, 0, Math.PI * 2);
      contesto.stroke();
      contesto.strokeStyle = colore(0.12 * intensita);
      contesto.lineWidth = 14;
      contesto.beginPath();
      contesto.arc(geometria.nucleo.x, geometria.nucleo.y, raggio * 0.97, 0, Math.PI * 2);
      contesto.stroke();
    }
  }

  const COLORI_RADAR = { ok: [59, 214, 113], avviso: [255, 176, 32], errore: [255, 77, 77], spento: [110, 140, 158] };

  function disegnareRadar(contesto, tempo) {
    const radar = geometria.radar;
    if (!radar) {
      return;
    }
    const { x, y, raggio } = radar;
    contesto.fillStyle = "rgba(3,8,14,0.55)";
    contesto.beginPath();
    contesto.arc(x, y, raggio + 3, 0, Math.PI * 2);
    contesto.fill();
    contesto.strokeStyle = colore(0.35);
    contesto.lineWidth = 1;
    for (const frazione of [1, 0.66, 0.33]) {
      contesto.beginPath();
      contesto.arc(x, y, raggio * frazione, 0, Math.PI * 2);
      contesto.stroke();
    }
    contesto.strokeStyle = colore(0.2);
    contesto.beginPath();
    contesto.moveTo(x - raggio, y); contesto.lineTo(x + raggio, y);
    contesto.moveTo(x, y - raggio); contesto.lineTo(x, y + raggio);
    contesto.stroke();
    const angoloLinea = (tempo * 1.1) % (Math.PI * 2);
    for (let strato = 0; strato < 16; strato += 1) {
      contesto.fillStyle = colore(0.22 * (1 - strato / 16));
      contesto.beginPath();
      contesto.moveTo(x, y);
      contesto.arc(x, y, raggio, angoloLinea - (strato + 1) * 0.06, angoloLinea - strato * 0.06);
      contesto.closePath();
      contesto.fill();
    }
    contesto.strokeStyle = colore(0.9);
    contesto.lineWidth = 1.4;
    contesto.beginPath();
    contesto.moveTo(x, y);
    contesto.lineTo(x + Math.cos(angoloLinea) * raggio, y + Math.sin(angoloLinea) * raggio);
    contesto.stroke();
    const sistemi = Array.isArray(window.jarvisSistemi) ? window.jarvisSistemi : [];
    sistemi.forEach((riga, indice) => {
      const angolo = (indice * Math.PI * 2) / Math.max(1, sistemi.length) + 0.35;
      const distanza = raggio * (0.38 + ((indice * 37) % 5) * 0.12);
      const dopoLinea = (((angoloLinea - angolo) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const luce = Math.max(0.25, 1 - dopoLinea / (Math.PI * 1.4));
      const tinta = COLORI_RADAR[riga[1]] || COLORI_RADAR.spento;
      contesto.fillStyle = "rgba(" + tinta.join(",") + "," + luce + ")";
      contesto.beginPath();
      contesto.arc(x + Math.cos(angolo) * distanza, y + Math.sin(angolo) * distanza, 2.6, 0, Math.PI * 2);
      contesto.fill();
    });
    contesto.fillStyle = colore(0.7);
    contesto.font = "8px 'Segoe UI', sans-serif";
    contesto.textAlign = "center";
    contesto.fillText("S I S T E M I", x, y + raggio + 13);
    contesto.textAlign = "left";
  }

  function aggiornareAllarme(adesso) {
    const pc = window.jarvisPc;
    const sistemi = Array.isArray(window.jarvisSistemi) ? window.jarvisSistemi : [];
    const erroriOra = sistemi.filter((riga) => riga[1] === "errore").map((riga) => riga[0]).join(",");
    const nuovi = erroriOra.split(",").filter((nome) => nome && !allarme.erroriVisti.split(",").includes(nome));
    if (nuovi.length) {
      allarme.fino = adesso + 7000;
      allarme.motivo = "SISTEMA IN ERRORE: " + nuovi.join(", ");
    }
    allarme.erroriVisti = erroriOra;
    if (pc && Number.isFinite(pc.batteria) && pc.batteria <= 15 && !pc.in_carica) {
      allarme.fino = adesso + 1500;
      allarme.motivo = "BATTERIA CRITICA " + pc.batteria + "%";
    }
  }

  function disegnareAllarme(contesto, adesso, tempo) {
    if (adesso > allarme.fino) {
      return;
    }
    const intensita = 0.55 + 0.45 * Math.sin(tempo * 4.5);
    const diagonale = Math.hypot(misure.larghezza, misure.altezza);
    const alone = contesto.createRadialGradient(misure.larghezza / 2, misure.altezza / 2, diagonale * 0.3, misure.larghezza / 2, misure.altezza / 2, diagonale * 0.62);
    alone.addColorStop(0, "rgba(255,40,40,0)");
    alone.addColorStop(1, "rgba(255,40,40," + 0.38 * intensita + ")");
    contesto.fillStyle = alone;
    contesto.fillRect(0, 0, misure.larghezza, misure.altezza);
    contesto.strokeStyle = "rgba(255,70,70," + 0.55 * intensita + ")";
    contesto.lineWidth = 3;
    contesto.strokeRect(2, 2, misure.larghezza - 4, misure.altezza - 4);
    contesto.font = "600 13px 'Segoe UI', sans-serif";
    contesto.textAlign = "center";
    contesto.fillStyle = "rgba(255,120,120," + (0.55 + 0.45 * intensita) + ")";
    contesto.fillText("⚠ " + allarme.motivo, misure.larghezza / 2, 22);
    contesto.textAlign = "left";
  }

  /* ------------------------------------------------------------ parallasse e glitch */

  function applicareParallasse() {
    puntatore.x += (puntatore.obiettivoX - puntatore.x) * 0.06;
    puntatore.y += (puntatore.obiettivoY - puntatore.y) * 0.06;
    const universo = document.getElementById("universo");
    const trasformazioneSfondo = "translate3d(" + (puntatore.x * -16).toFixed(2) + "px," + (puntatore.y * -11).toFixed(2) + "px,0) scale(1.05)";
    if (universo) { universo.style.transform = trasformazioneSfondo; }
    telaSfondo.style.transform = "translate3d(" + (puntatore.x * -8).toFixed(2) + "px," + (puntatore.y * -6).toFixed(2) + "px,0) scale(1.03)";
    const scena = document.getElementById("scena");
    if (scena) { scena.style.transform = "translate3d(" + (puntatore.x * 7).toFixed(2) + "px," + (puntatore.y * 5).toFixed(2) + "px,0)"; }
  }

  function provocareGlitch(adesso) {
    if (adesso - ultimi.glitch < 18000 + Math.random() * 22000) {
      return;
    }
    ultimi.glitch = adesso;
    const candidati = [document.getElementById("marchio"), ...document.querySelectorAll(".titolo-pannello span")];
    const scelto = candidati[Math.floor(Math.random() * candidati.length)];
    if (!scelto) {
      return;
    }
    scelto.classList.add("glitch");
    setTimeout(() => scelto.classList.remove("glitch"), 420);
  }

  /* ------------------------------------------------------------ ciclo principale */

  function pulire() {
    contestoSfondo.setTransform(1, 0, 0, 1, 0, 0);
    contestoSfondo.clearRect(0, 0, telaSfondo.width, telaSfondo.height);
    contestoSopra.setTransform(1, 0, 0, 1, 0, 0);
    contestoSopra.clearRect(0, 0, telaSopra.width, telaSopra.height);
  }

  let eraSpento = false;

  function ciclo(adesso) {
    requestAnimationFrame(ciclo);
    if (document.hidden) {
      return;
    }
    const spento = corpo.classList.contains("senza-effetti");
    if (spento) {
      if (!eraSpento) { pulire(); }
      eraSpento = true;
      return;
    }
    eraSpento = false;
    if (adesso - ultimi.fotogramma < 32) {
      return;
    }
    const intervallo = Math.min((adesso - ultimi.fotogramma) / 1000, 0.1);
    ultimi.fotogramma = adesso;
    const tempo = adesso / 1000;
    leggereColori(adesso);
    ricalcolareGeometria(adesso);
    applicareParallasse();
    provocareGlitch(adesso);
    aggiornareAllarme(adesso);
    const inIntro = corpo.classList.contains("in-intro");

    contestoSfondo.setTransform(misure.densita, 0, 0, misure.densita, 0, 0);
    contestoSfondo.clearRect(0, 0, misure.larghezza, misure.altezza);
    contestoSopra.setTransform(misure.densita, 0, 0, misure.densita, 0, 0);
    contestoSopra.clearRect(0, 0, misure.larghezza, misure.altezza);
    if (inIntro) {
      return;
    }
    disegnareGriglia(contestoSfondo, tempo);
    disegnareFlussoDati(contestoSfondo, intervallo);
    disegnareCavi(contestoSfondo, adesso, intervallo);
    disegnareBordiVivi(contestoSopra, tempo);
    disegnareOnde(contestoSopra, adesso);
    disegnareRadar(contestoSopra, tempo);
    disegnareAllarme(contestoSopra, adesso, tempo);
  }

  /* ------------------------------------------------------------ eventi */

  window.addEventListener("resize", adattare);
  window.addEventListener("mousemove", (evento) => {
    puntatore.obiettivoX = (evento.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    puntatore.obiettivoY = (evento.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  });
  new MutationObserver(() => {
    if (corpo.dataset.stato === "parlo") { lanciareOnda(); }
  }).observe(corpo, { attributes: true, attributeFilter: ["data-stato"] });
  const registro = document.getElementById("registro");
  if (registro) {
    new MutationObserver((modifiche) => {
      for (const modifica of modifiche) {
        for (const nodo of modifica.addedNodes) {
          if (nodo.classList && nodo.classList.contains("jarvis")) { lanciareOnda(); }
        }
      }
    }).observe(registro, { childList: true });
  }
  new MutationObserver(() => {
    if (!corpo.classList.contains("in-intro") && !corpo.classList.contains("agganciate")) {
      corpo.classList.add("agganciate");   // attenzione: aggiungere una classe già presente riattiverebbe l'osservatore all'infinito
      geometria.ultimoCalcolo = 0;
    }
  }).observe(corpo, { attributes: true, attributeFilter: ["class"] });
  if (!corpo.classList.contains("in-intro")) {
    corpo.classList.add("agganciate");
  }

  adattare();
  requestAnimationFrame(ciclo);
})();
