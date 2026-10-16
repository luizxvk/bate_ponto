import "./style.css";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const nativo = Capacitor.isNativePlatform();
const CHAVE = "bate-ponto:v1";
const DIAS_AGENDADOS = 14;
const $ = (s) => document.querySelector(s);

// ---------- datas ----------
const pad = (n) => String(n).padStart(2, "0");
const isoDia = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const deIso = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
const somaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return isoDia(d); };
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDia = (s, opt) => deIso(s).toLocaleDateString("pt-BR", opt);

// ---------- estado ----------
function carregar() {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE));
    if (e && Array.isArray(e.tarefas)) return e;
  } catch {}
  return { tarefas: [], pontos: {}, seq: 1 };
}
let estado = carregar();
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch {}
  reagendar();
}

const repeteTexto = { once: "", daily: "todo dia", weekdays: "seg a sex" };

function venceEm(t, dia) {
  if (t.repete === "once") return t.dia === dia;
  if (dia < t.criada) return false;
  if (t.repete === "weekdays") { const w = deIso(dia).getDay(); return w > 0 && w < 6; }
  return true;
}
const batido = (dia, id) => estado.pontos[dia]?.[id];

function tarefasDeHoje() {
  const hoje = isoDia();
  const lista = [];
  for (const t of estado.tarefas) {
    if (venceEm(t, hoje)) lista.push({ t, dia: hoje });
    else if (t.repete === "once" && t.dia < hoje && (!batidoAlgumDia(t.id) || batido(hoje, t.id))) lista.push({ t, dia: t.dia, atrasada: true });
  }
  return lista;
}
function batidoAlgumDia(id) {
  return Object.values(estado.pontos).some((p) => p[id]);
}

// ---------- bater ponto ----------
function bater(id, diaDaTarefa) {
  const t = estado.tarefas.find((x) => x.id === id);
  if (!t) return;
  // tarefa atrasada conta no dia em que foi feita
  const dia = t.repete === "once" ? isoDia() : diaDaTarefa;
  if (batido(dia, id)) return;
  const agora = new Date();
  (estado.pontos[dia] ??= {})[id] = agora.toISOString();
  salvar();
  render(id);
  avisar(`Ponto batido às ${hhmm(agora)}`, "Desfazer", () => desbater(id, dia));
}
function desbater(id, dia) {
  if (estado.pontos[dia]) delete estado.pontos[dia][id];
  salvar();
  render();
}

// ---------- tela: hoje ----------
function render(recemBatido) {
  renderVisor();
  renderHoje(recemBatido);
  if (!$("#espelho").hidden) renderEspelho();
}

function renderVisor() {
  const lista = tarefasDeHoje();
  const hoje = isoDia();
  const feitas = lista.filter((x) => batido(hoje, x.t.id) || batido(x.dia, x.t.id)).length;
  const total = lista.length;
  $("#data").textContent = maiuscula(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  $("#saldo").textContent =
    total === 0 ? "Nenhuma tarefa pra hoje" :
    feitas === total ? `Tudo batido hoje: ${total} de ${total}` :
    `${feitas} de ${total} ${total === 1 ? "tarefa batida" : "tarefas batidas"} hoje`;
  $("#barra").style.width = total ? `${(feitas / total) * 100}%` : "0";
}

function horaDoPonto(item) {
  const iso = batido(isoDia(), item.t.id) || batido(item.dia, item.t.id);
  return iso ? new Date(iso) : null;
}

function renderHoje(recemBatido) {
  const el = $("#hoje");
  const lista = tarefasDeHoje().map((x) => ({ ...x, ponto: horaDoPonto(x) }));
  lista.sort((a, b) =>
    (!!a.ponto - !!b.ponto) ||
    (a.ponto && b.ponto ? a.ponto - b.ponto : 0) ||
    (a.atrasada === b.atrasada ? 0 : a.atrasada ? -1 : 1) ||
    (a.t.hora || "99").localeCompare(b.t.hora || "99"));

  let html = "";
  if (avisoExato) {
    html += `<div class="cartao-ponto vazio" style="padding:16px;text-align:left;margin-bottom:14px">
      <strong style="font-size:16px">Lembretes podem chegar atrasados</strong>
      O Android está segurando os alarmes exatos deste app.
      <div style="margin-top:10px"><button class="btn" data-acao="exato">Permitir horário exato</button></div></div>`;
  }
  if (!lista.length) {
    html += `<div class="cartao-ponto vazio"><strong>Nada pra bater hoje</strong>Toque em Nova tarefa e marque um horário pra receber o lembrete.</div>`;
    el.innerHTML = html;
    return;
  }
  html += `<div class="cartao-ponto">` + lista.map(linha).join("") + `</div>`;
  el.innerHTML = html;

  if (recemBatido) {
    const linhaEl = el.querySelector(`[data-id="${recemBatido}"]`);
    linhaEl?.classList.add("tremeu");
    linhaEl?.querySelector(".carimbo")?.classList.add("bateu");
  }

  function linha({ t, dia, atrasada, ponto }) {
    const partes = [];
    if (t.hora) partes.push(`às ${t.hora}`);
    if (repeteTexto[t.repete]) partes.push(repeteTexto[t.repete]);
    let meta = partes.join(", ");
    if (atrasada && !ponto) meta = `Ficou de ${fmtDia(dia, { day: "numeric", month: "short" })}` + (t.hora ? ` às ${t.hora}` : "");
    else if (!ponto && t.hora && t.hora < hhmm(new Date())) atrasada = true;
    const slot = ponto
      ? `<div class="slot batido" aria-label="Batido às ${hhmm(ponto)}"><div class="carimbo"><b>${hhmm(ponto)}</b><small>${fmtDia(isoDia(ponto), { day: "2-digit", month: "short" }).replace(".", "")}</small></div></div>`
      : `<button class="slot" data-acao="bater" data-dia="${dia}" aria-label="Bater ponto de ${esc(t.titulo)}">Bater ponto</button>`;
    return `<div class="tarefa${ponto ? " feita" : ""}" data-id="${t.id}">
      <button class="tarefa-info" data-acao="editar">
        <div class="tarefa-titulo">${esc(t.titulo)}</div>
        ${meta ? `<div class="tarefa-meta${atrasada && !ponto ? " atrasada" : ""}">${meta}</div>` : ""}
      </button>
      <div>${slot}${ponto ? `<button class="desfazer" data-acao="desfazer" data-dia="${t.repete === "once" ? isoDia(ponto) : dia}">Desfazer</button>` : ""}</div>
    </div>`;
  }
}

$("#hoje").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-acao]");
  if (!b) return;
  const id = b.closest("[data-id]")?.dataset.id;
  if (b.dataset.acao === "bater") bater(id, b.dataset.dia);
  if (b.dataset.acao === "desfazer") desbater(id, b.dataset.dia);
  if (b.dataset.acao === "editar") abrirForm(estado.tarefas.find((t) => t.id === id));
  if (b.dataset.acao === "exato") { await LocalNotifications.changeExactNotificationSetting(); }
});

// ---------- tela: espelho de ponto ----------
function renderEspelho() {
  const hoje = isoDia();
  const inicio = estado.tarefas.reduce((m, t) => (t.criada < m ? t.criada : m), hoje);
  const dias = [];
  for (let d = hoje, i = 0; d >= inicio && i < 60; d = somaDias(d, -1), i++) {
    const pontos = estado.pontos[d] || {};
    const itens = [];
    for (const [id, iso] of Object.entries(pontos)) {
      const t = estado.tarefas.find((x) => x.id === id);
      itens.push({ titulo: t ? t.titulo : "Tarefa excluída", hora: hhmm(new Date(iso)), ok: true });
    }
    let devidas = 0;
    for (const t of estado.tarefas) {
      if (!venceEm(t, d)) continue;
      devidas++;
      const feita = pontos[t.id] || (t.repete === "once" && batidoAlgumDia(t.id));
      if (!feita && d < hoje) itens.push({ titulo: t.titulo, hora: "falta", ok: false });
    }
    if (!itens.length && !devidas) continue;
    itens.sort((a, b) => a.hora.localeCompare(b.hora));
    const batidas = itens.filter((x) => x.ok).length;
    dias.push(`<div class="espelho-dia">
      <div class="espelho-cabeca"><strong>${d === hoje ? "Hoje" : maiuscula(fmtDia(d, { weekday: "short", day: "numeric", month: "short" }))}</strong>
      <span>${batidas} ${batidas === 1 ? "batida" : "batidas"}</span></div>
      ${itens.map((x) => `<div class="espelho-item${x.ok ? "" : " falta"}"><time>${x.hora}</time><span>${esc(x.titulo)}</span></div>`).join("") || `<div class="espelho-item falta"><span>Nada batido ainda</span></div>`}
    </div>`);
  }
  $("#espelho").innerHTML = dias.length
    ? `<div class="cartao-ponto">${dias.join("")}</div>`
    : `<div class="cartao-ponto vazio"><strong>Espelho vazio</strong>Cada ponto que você bater aparece aqui, dia por dia.</div>`;
}

// ---------- abas ----------
document.querySelectorAll(".aba").forEach((a) =>
  a.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((x) => x.setAttribute("aria-selected", x === a));
    $("#hoje").hidden = a.dataset.aba !== "hoje";
    $("#espelho").hidden = a.dataset.aba !== "espelho";
    if (a.dataset.aba === "espelho") renderEspelho();
  })
);

// ---------- formulario ----------
const folha = $("#folha");
const form = $("#form");
let editando = null;

function abrirForm(t) {
  editando = t || null;
  form.reset();
  $("#form-titulo").textContent = t ? "Editar tarefa" : "Nova tarefa";
  $("#salvar").textContent = t ? "Salvar alterações" : "Salvar tarefa";
  $("#excluir").hidden = !t;
  form.titulo.value = t?.titulo || "";
  form.hora.value = t?.hora || "";
  form.dia.value = t?.dia || isoDia();
  form.repete.value = t?.repete || "once";
  sincronizarDia();
  folha.showModal();
  if (!t) setTimeout(() => form.titulo.focus(), 50);
}
function sincronizarDia() {
  form.dia.closest(".campo").style.display = form.repete.value === "once" ? "" : "none";
}
form.addEventListener("change", (e) => { if (e.target.name === "repete") sincronizarDia(); });
$("#nova").addEventListener("click", () => abrirForm());
$("#cancelar").addEventListener("click", () => folha.close());
folha.addEventListener("click", (e) => { if (e.target === folha) folha.close(); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = form.titulo.value.trim();
  if (!titulo) return form.titulo.focus();
  const dados = {
    titulo,
    hora: form.hora.value || null,
    repete: form.repete.value,
    dia: form.repete.value === "once" ? form.dia.value || isoDia() : null,
  };
  if (editando) Object.assign(editando, dados);
  else estado.tarefas.push({ id: crypto.randomUUID(), n: estado.seq++, criada: isoDia(), ...dados });
  folha.close();
  salvar();
  render();
  if (dados.hora) await pedirPermissao();
  avisar(editando ? "Tarefa salva" : dados.hora ? `Lembrete marcado pras ${dados.hora}` : "Tarefa criada");
});

$("#excluir").addEventListener("click", () => {
  if (!editando) return;
  const t = editando;
  estado.tarefas = estado.tarefas.filter((x) => x !== t);
  folha.close();
  salvar();
  render();
  avisar("Tarefa excluída", "Desfazer", () => { estado.tarefas.push(t); salvar(); render(); });
});

// ---------- aviso ----------
let timerAviso;
function avisar(texto, rotulo, acao) {
  const el = $("#aviso");
  el.innerHTML = "";
  el.append(texto);
  if (rotulo) {
    const b = document.createElement("button");
    b.textContent = rotulo;
    b.onclick = () => { el.classList.remove("on"); acao(); };
    el.append(b);
  }
  el.classList.add("on");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("on"), 4000);
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- lembretes ----------
let avisoExato = false;

async function pedirPermissao() {
  if (!nativo) {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    return;
  }
  const p = await LocalNotifications.checkPermissions();
  if (p.display !== "granted") await LocalNotifications.requestPermissions();
  try {
    const ex = await LocalNotifications.checkExactNotificationSetting();
    avisoExato = ex.exact_alarm !== "granted";
  } catch {}
}

// proximas ocorrencias de cada tarefa ainda nao batida
function ocorrencias() {
  const agora = new Date();
  const hoje = isoDia();
  const out = [];
  for (const t of estado.tarefas) {
    if (!t.hora) continue;
    const [h, m] = t.hora.split(":").map(Number);
    for (let k = 0; k < DIAS_AGENDADOS; k++) {
      const dia = somaDias(hoje, k);
      if (!venceEm(t, dia) || batido(dia, t.id)) continue;
      if (t.repete === "once" && batidoAlgumDia(t.id)) continue;
      const quando = deIso(dia);
      quando.setHours(h, m, 0, 0);
      if (quando <= agora) continue;
      out.push({ t, dia, quando, id: t.n * 100 + k });
    }
  }
  return out;
}

let timersWeb = [];
let agendando = Promise.resolve();
function reagendar() {
  agendando = agendando.then(reagendarAgora).catch((e) => console.warn("lembretes", e));
}
async function reagendarAgora() {
  const lista = ocorrencias();
  if (!nativo) {
    timersWeb.forEach(clearTimeout);
    timersWeb = lista
      .filter((o) => o.quando - Date.now() < 2 ** 31 - 1)
      .map((o) => setTimeout(() => {
        if ("Notification" in window && Notification.permission === "granted") new Notification("Hora de bater o ponto", { body: o.t.titulo });
      }, o.quando - Date.now()));
    return;
  }
  const pend = await LocalNotifications.getPending();
  if (pend.notifications.length) await LocalNotifications.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
  if (!lista.length) return;
  await LocalNotifications.schedule({
    notifications: lista.map((o) => ({
      id: o.id,
      title: o.t.titulo,
      body: "Já terminou? Bata o ponto.",
      schedule: { at: o.quando, allowWhileIdle: true },
      channelId: "lembretes",
      actionTypeId: "TAREFA",
      smallIcon: "ic_stat_ponto",
      iconColor: "#4B32C3",
      extra: { id: o.t.id, dia: o.dia },
    })),
  });
}

async function iniciarNativo() {
  await LocalNotifications.createChannel({
    id: "lembretes",
    name: "Lembretes de tarefa",
    description: "Avisa no horário marcado em cada tarefa",
    importance: 5,
    visibility: 1,
    vibration: true,
  });
  await LocalNotifications.registerActionTypes({
    types: [{ id: "TAREFA", actions: [{ id: "bater", title: "Bater ponto" }, { id: "depois", title: "Lembrar em 15 min" }] }],
  });
  LocalNotifications.addListener("localNotificationActionPerformed", async ({ actionId, notification }) => {
    const { id, dia } = notification.extra || {};
    if (actionId === "bater" && id) bater(id, dia);
    if (actionId === "depois" && id) {
      await LocalNotifications.schedule({
        notifications: [{ ...notification, id: 900000 + Math.floor(Math.random() * 99999), schedule: { at: new Date(Date.now() + 15 * 60000), allowWhileIdle: true } }],
      });
    }
  });
  if (estado.tarefas.some((t) => t.hora)) await pedirPermissao();
}

// ---------- relogio ----------
let diaAtual = isoDia();
function tique() {
  const d = new Date();
  $("#hora").innerHTML = `${hhmm(d)}<span class="seg">${pad(d.getSeconds())}</span>`;
  if (isoDia(d) !== diaAtual) { diaAtual = isoDia(d); reagendar(); render(); }
  else if (d.getSeconds() === 0) renderHoje();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); reagendar(); } });

tique();
setInterval(tique, 1000);
render();
if (nativo) iniciarNativo().then(() => { render(); reagendar(); });
else reagendar();
