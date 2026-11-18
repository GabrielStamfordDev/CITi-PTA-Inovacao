let currentUser = null;
let appData = {
  eventos: [],
  links: [],
  artigos: [],
  faqs: [],
  forumMessages: [],
};
let navHistory = [];
let currentRegStep = 1;
let isEditingProfile = false;

const ESTADOS_BRASIL = [
  "AC - Acre",
  "AL - Alagoas",
  "AP - Amapá",
  "AM - Amazonas",
  "BA - Bahia",
  "CE - Ceará",
  "DF - Distrito Federal",
  "ES - Espírito Santo",
  "GO - Goiás",
  "MA - Maranhão",
  "MT - Mato Grosso",
  "MS - Mato Grosso do Sul",
  "MG - Minas Gerais",
  "PA - Pará",
  "PB - Paraíba",
  "PR - Paraná",
  "PE - Pernambuco",
  "PI - Piauí",
  "RJ - Rio de Janeiro",
  "RN - Rio Grande do Norte",
  "RS - Rio Grande do Sul",
  "RO - Rondônia",
  "RR - Roraima",
  "SC - Santa Catarina",
  "SP - São Paulo",
  "SE - Sergipe",
  "TO - Tocantins",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateDigitsToBr(rawDigits) {
  const digits = String(rawDigits || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

function brDateToIso(brDate) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(brDate || "").trim());
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return "";
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isoDateToBr(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function initDatePickerPair(textId, pickerId) {
  const textEl = document.getElementById(textId);
  const pickerEl = document.getElementById(pickerId);
  if (!textEl || !pickerEl) return;

  pickerEl.max = new Date().toISOString().split("T")[0];

  const initialIso = brDateToIso(textEl.value);
  if (initialIso) pickerEl.value = initialIso;

  textEl.addEventListener("input", () => {
    textEl.value = formatDateDigitsToBr(textEl.value);
    const iso = brDateToIso(textEl.value);
    if (iso) pickerEl.value = iso;
  });

  pickerEl.addEventListener("change", () => {
    const br = isoDateToBr(pickerEl.value);
    if (br) textEl.value = br;
  });
}

function initEstadoCombobox(inputId, listId, btnId) {
  const inputEl = document.getElementById(inputId);
  const listEl = document.getElementById(listId);
  const btnEl = document.getElementById(btnId);
  if (!inputEl || !listEl || !btnEl) return;

  function renderOptions(filterQuery = "") {
    const q = normalizeText(filterQuery.trim());
    const matches = q
      ? ESTADOS_BRASIL.filter((uf) => normalizeText(uf).includes(q))
      : ESTADOS_BRASIL;

    if (!matches.length) {
      listEl.innerHTML = `<p class="px-3 py-2 text-[11px] text-slate-400">Nenhuma opção encontrada. Você pode digitar livremente.</p>`;
      return;
    }

    listEl.innerHTML = matches
      .map(
        (uf) =>
          `<button type="button" data-estado-option="${escapeHtml(uf)}" class="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-[#5b21b6] transition">${escapeHtml(uf)}</button>`
      )
      .join("");

    listEl.querySelectorAll("[data-estado-option]").forEach((optBtn) => {
      optBtn.addEventListener("click", () => {
        inputEl.value = optBtn.getAttribute("data-estado-option") || "";
        listEl.classList.add("hidden");
      });
    });
  }

  btnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = listEl.classList.contains("hidden");
    document.querySelectorAll("[id$='-estado-list']").forEach((el) => el.classList.add("hidden"));
    if (isHidden) {
      renderOptions("");
      listEl.classList.remove("hidden");
    }
  });

  inputEl.addEventListener("input", () => {
    renderOptions(inputEl.value);
    listEl.classList.remove("hidden");
  });

  inputEl.addEventListener("focus", () => {
    renderOptions(inputEl.value);
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-estado-wrapper]")) {
    document.querySelectorAll("[id$='-estado-list']").forEach((el) => el.classList.add("hidden"));
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}

function setCurrentUser(rawUser) {
  if (!rawUser) {
    currentUser = null;
    localStorage.removeItem("cuida_user");
    return;
  }
  // Nunca persiste token no localStorage; a sessão trafega em cookie HttpOnly
  const { token: _ignoredToken, ...safeProfile } = rawUser;
  currentUser = safeProfile;
  localStorage.setItem("cuida_user", JSON.stringify(safeProfile));
}

function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: "same-origin",
  });
}

// ==================================================
// ACESSIBILIDADE SÊNIOR (Tamanho do texto + Leitura em voz alta)
// ==================================================
const TEXT_SCALES = [1, 1.15, 1.3];
let currentScaleIndex = 0;
const speechTexts = {};
let activeSpeechBtnId = null;

function applyTextScale(index) {
  currentScaleIndex = Math.max(0, Math.min(TEXT_SCALES.length - 1, index));
  const scale = TEXT_SCALES[currentScaleIndex];
  const shell = document.querySelector(".app-shell");
  if (shell) shell.style.setProperty("--text-scale", String(scale));
  localStorage.setItem("cuida_text_scale_idx", String(currentScaleIndex));

  const labelEl = document.getElementById("font-scale-label");
  if (labelEl) labelEl.textContent = `${Math.round(scale * 100)}%`;

  const decBtn = document.getElementById("btn-font-dec");
  const incBtn = document.getElementById("btn-font-inc");
  if (decBtn) decBtn.disabled = currentScaleIndex === 0;
  if (incBtn) incBtn.disabled = currentScaleIndex === TEXT_SCALES.length - 1;
}

function changeTextScale(delta) {
  applyTextScale(currentScaleIndex + delta);
}

function initTextScale() {
  const savedIdx = Number(localStorage.getItem("cuida_text_scale_idx") || "0");
  applyTextScale(Number.isInteger(savedIdx) ? savedIdx : 0);
}

function setSpeechBtnState(btnId, speaking) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const idleLabel = btn.getAttribute("data-idle-label") || "Ouvir texto";
  btn.innerHTML = speaking
    ? `<svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg><span>Parar áudio</span>`
    : `<svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg><span>${escapeHtml(idleLabel)}</span>`;
  btn.setAttribute("aria-pressed", speaking ? "true" : "false");
}

const MESES_PT = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

let cachedVoices = [];
let speechCancelled = false;

function refreshAvailableVoices() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshAvailableVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshAvailableVoices);
}

function pickBestPortugueseVoice() {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices() || [];
  const ptVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
  if (!ptVoices.length) return null;

  const scoreVoice = (v) => {
    const lang = (v.lang || "").toLowerCase();
    const name = (v.name || "").toLowerCase();
    let score = 0;

    if (lang === "pt-br") score += 50;
    else if (lang.startsWith("pt-br")) score += 45;
    else score += 10;

    if (name.includes("natural") || name.includes("neural")) score += 100;
    if (name.includes("francisca") || name.includes("thalita") || name.includes("antonio")) score += 30;
    if (name.includes("online")) score += 40;
    if (name.includes("google")) score += 35;
    if (v.localService === false) score += 20;
    if (name.includes("maria") || name.includes("daniel") || name.includes("espeak")) score -= 20;

    return score;
  };

  return [...ptVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

function formatTextForSpeech(rawText) {
  let text = String(rawText || "");

  // Quebras de bloco e marcadores viram pausas naturais
  text = text.replace(/\n{2,}/g, ". ");
  text = text.replace(/[•▪◦]/g, ", ");
  text = text.replace(/\n/g, ", ");

  // Datas completas dd/mm/aaaa -> "15 de maio de 1972"
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m, y) => {
    const day = Number(d);
    const month = Number(m);
    const monthName = MESES_PT[month];
    if (!monthName || day < 1 || day > 31) return `${d} do ${m} de ${y}`;
    const dayStr = day === 1 ? "primeiro" : String(day);
    return `${dayStr} de ${monthName} de ${y}`;
  });

  // Datas curtas dd/mm -> "primeiro de abril", "5 de novembro"
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (_, d, m) => {
    const day = Number(d);
    const month = Number(m);
    const monthName = MESES_PT[month];
    if (!monthName || day < 1 || day > 31) return `${d} do ${m}`;
    const dayStr = day === 1 ? "primeiro" : String(day);
    return `${dayStr} de ${monthName}`;
  });

  // Horários tipo "18:00h" ou "08:30h" ou "18:00"
  text = text.replace(/\b(\d{1,2}):(\d{2})\s*h?\b/gi, (_, h, min) => {
    const hour = Number(h);
    const minute = Number(min);
    const hourWord = hour === 1 ? "1 hora" : `${hour} horas`;
    return minute === 0 ? hourWord : `${hourWord} e ${minute} minutos`;
  });

  // Ordinais e símbolos comuns
  text = text.replace(/\b10[°º]/g, "décimo");
  text = text.replace(/(\d+)[°º]/g, "$1º");
  text = text.replace(/@([a-zA-Z0-9_.]+)/g, "arroba $1");
  text = text.replace(/\bDA\b/g, "Doença de Alzheimer");
  text = text.replace(/\s+-\s+/g, ", ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function splitSpeechChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];
  let current = "";

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + " " + trimmed).length > 180 && current) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function stopSpeech() {
  speechCancelled = true;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (activeSpeechBtnId) {
    setSpeechBtnState(activeSpeechBtnId, false);
    activeSpeechBtnId = null;
  }
}

function toggleSpeech(btnId, textKey) {
  if (!("speechSynthesis" in window)) {
    showToast("Seu navegador não suporta leitura em voz alta.");
    return;
  }

  const wasSameButton = activeSpeechBtnId === btnId;
  stopSpeech();
  if (wasSameButton) return;

  const rawText = speechTexts[textKey];
  if (!rawText) return;

  const naturalText = formatTextForSpeech(rawText);
  const chunks = splitSpeechChunks(naturalText);
  if (!chunks.length) return;

  const voice = pickBestPortugueseVoice();
  speechCancelled = false;
  activeSpeechBtnId = btnId;
  setSpeechBtnState(btnId, true);

  let idx = 0;
  function speakNextChunk() {
    if (speechCancelled || idx >= chunks.length) {
      if (activeSpeechBtnId === btnId) {
        setSpeechBtnState(btnId, false);
        activeSpeechBtnId = null;
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[idx]);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      idx++;
      speakNextChunk();
    };
    utterance.onerror = () => {
      if (activeSpeechBtnId === btnId) {
        setSpeechBtnState(btnId, false);
        activeSpeechBtnId = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNextChunk();
}

function buildSpeechButtonHtml(btnId, textKey, idleLabel = "Ouvir texto", compact = false) {
  const padding = compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-xs min-h-[38px]";
  return `
    <button type="button" id="${btnId}" data-idle-label="${escapeHtml(idleLabel)}" aria-pressed="false"
            onclick="toggleSpeech('${btnId}', '${textKey}')"
            class="inline-flex items-center gap-1.5 rounded-full bg-purple-100/90 hover:bg-purple-200/80 text-[#5b21b6] font-semibold ${padding} transition">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
      <span>${escapeHtml(idleLabel)}</span>
    </button>
  `;
}

// ==================================================
// MODO DE VISUALIZAÇÃO (Mobile vs Site PC Responsivo)
// ==================================================
function setViewMode(mode) {
  const isDesktop = mode === "desktop";
  document.body.classList.toggle("desktop-mode", isDesktop);
  localStorage.setItem("cuida_view_mode", isDesktop ? "desktop" : "mobile");

  const btnMobile = document.getElementById("btn-mode-mobile");
  const btnDesktop = document.getElementById("btn-mode-desktop");
  if (btnMobile && btnDesktop) {
    btnMobile.classList.toggle("bg-[#7353ba]", !isDesktop);
    btnMobile.classList.toggle("text-white", !isDesktop);
    btnMobile.classList.toggle("text-slate-600", isDesktop);

    btnDesktop.classList.toggle("bg-[#7353ba]", isDesktop);
    btnDesktop.classList.toggle("text-white", isDesktop);
    btnDesktop.classList.toggle("text-slate-600", !isDesktop);
  }
}

function initViewMode() {
  const savedMode = localStorage.getItem("cuida_view_mode") || "mobile";
  setViewMode(savedMode);
}

// ==================================================
// NAVEGAÇÃO E SENHAS
// ==================================================
function navigate(screenId, pushHistory = true) {
  stopSpeech();
  fecharAvisoSemInscricao();
  resetPasswordVisibility();

  if (screenId === "screen-recover") {
    setRecoverStep(1);
    document.getElementById("rec-codigo").value = "";
    document.getElementById("rec-senha").value = "";
  }

  if (screenId === "screen-register" && pushHistory) {
    setRegisterStep(1);
  }

  const currentActive = document.querySelector(".screen.active");
  if (currentActive && pushHistory && currentActive.id !== screenId) {
    navHistory.push(currentActive.id);
  }

  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    target.scrollTop = 0;
  }

  // Barra inferior aparece em todas as telas autenticadas (incluindo Home, Fórum e Perfil)
  const authScreensWithoutBottomNav = [
    "screen-welcome",
    "screen-login",
    "screen-register",
    "screen-recover",
  ];
  const hideBottomNav = authScreensWithoutBottomNav.includes(screenId);
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) bottomNav.classList.toggle("hidden", hideBottomNav);

  // Barra de acessibilidade (tamanho da fonte) fica visível nas telas de leitura interna
  const hideA11yBar = hideBottomNav || screenId === "screen-home";
  const a11yBar = document.getElementById("a11y-bar");
  if (a11yBar) a11yBar.classList.toggle("hidden", hideA11yBar);

  updateBottomNavState(screenId);

  lucide.createIcons();
}

function updateBottomNavState(screenId) {
  const backBtn = document.getElementById("nav-btn-back");
  const homeBtn = document.getElementById("nav-btn-home");
  const forumBtn = document.getElementById("nav-btn-forum");
  const profileBtn = document.getElementById("nav-btn-profile");

  // Botão Voltar aparece nas telas internas e fica oculto na Página Inicial
  if (backBtn) {
    backBtn.classList.toggle("hidden", screenId === "screen-home");
  }

  const applyNavTabStyle = (btn, isActive) => {
    if (!btn) return;
    if (isActive) {
      btn.className =
        "flex-1 max-w-[140px] py-2 px-3 rounded-2xl text-xs font-extrabold bg-[#ede9fe] text-[#5b21b6] border-2 border-[#7353ba] shadow-sm flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition";
      btn.setAttribute("aria-current", "page");
    } else {
      btn.className =
        "flex-1 max-w-[130px] py-2 px-3 rounded-2xl text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-[#5b21b6] border border-transparent flex flex-col items-center justify-center gap-0.5 min-h-[48px] transition";
      btn.removeAttribute("aria-current");
    }
  };

  applyNavTabStyle(homeBtn, screenId === "screen-home");
  applyNavTabStyle(forumBtn, screenId === "screen-forum");
  applyNavTabStyle(profileBtn, screenId === "screen-profile");
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input || !btn) return;

  const showPassword = input.type === "password";
  input.type = showPassword ? "text" : "password";

  const eyeIcon = btn.querySelector(".icon-eye");
  const eyeOffIcon = btn.querySelector(".icon-eye-off");
  if (eyeIcon) eyeIcon.classList.toggle("hidden", showPassword);
  if (eyeOffIcon) eyeOffIcon.classList.toggle("hidden", !showPassword);

  const label = showPassword ? "Ocultar senha" : "Mostrar senha";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
}

function resetPasswordVisibility() {
  document.querySelectorAll("button[onclick^='togglePasswordVisibility']").forEach((btn) => {
    const eyeIcon = btn.querySelector(".icon-eye");
    const eyeOffIcon = btn.querySelector(".icon-eye-off");
    if (eyeIcon) eyeIcon.classList.remove("hidden");
    if (eyeOffIcon) eyeOffIcon.classList.add("hidden");
    btn.setAttribute("aria-label", "Mostrar senha");
    btn.setAttribute("title", "Mostrar senha");
  });

  ["reg-senha", "reg-confirmar-senha", "login-senha", "rec-senha"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.type = "password";
  });
}

function goBack() {
  if (navHistory.length > 0) {
    const prevScreen = navHistory.pop();
    navigate(prevScreen, false);
  } else {
    goHome();
  }
}

function goHome() {
  navHistory = [];
  navigate("screen-home", false);
}

async function logout() {
  try {
    await authFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Limpa estado local mesmo em falha transitória de rede
  }
  setCurrentUser(null);
  isEditingProfile = false;
  if (typeof resetAssistantState === "function") resetAssistantState();
  navHistory = [];
  navigate("screen-welcome", false);
}

function updateHomeGreeting(nome) {
  const firstName = String(nome || "Cuidador(a)").trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia," : hour < 18 ? "Boa tarde," : "Boa noite,";

  const periodEl = document.getElementById("home-period-greeting");
  if (periodEl) periodEl.textContent = period;

  const greetingEl = document.getElementById("home-greeting");
  if (greetingEl) greetingEl.textContent = `${firstName} 👋`;

  const subtitleEl = document.getElementById("home-subtitle-care");
  if (subtitleEl) {
    const lovedOne = currentUser?.pessoaComAlzheimer?.trim();
    subtitleEl.textContent = lovedOne
      ? `Como está sendo o cuidado com ${lovedOne} hoje?`
      : "Como está sendo o cuidado hoje?";
  }
}

async function loadAppData() {
  try {
    const res = await authFetch("/api/dados");
    if (!res.ok) throw new Error("Erro ao carregar dados");
    appData = await res.json();
    if (!Array.isArray(appData.forumMessages)) {
      appData.forumMessages = [];
    }

    renderEventos();
    renderLinks();
    renderArtigos();
    renderFaqs();
    renderForumMessages();
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar dados do servidor.");
  }
}

// ==================================================
// 1. EVENTOS E ENCONTROS (Frames 00:05 a 00:14)
// ==================================================
function getEventoMetadata(ev) {
  const isOnline = !ev.precisaInscricao;
  return {
    modalidade: isOnline ? "Evento online" : "Evento Presencial",
    bannerUrl: ev.imagem || (isOnline ? "/assets/evento-webinario.png" : "/assets/evento-simposio.png"),
  };
}

function renderEventos() {
  const container = document.getElementById("eventos-list");
  if (!appData.eventos.length) {
    container.innerHTML = `<p class="text-center reader-sm text-slate-600 py-8">Nenhum evento disponível no momento.</p>`;
    return;
  }

  container.innerHTML = appData.eventos
    .map((ev) => {
      const { modalidade, bannerUrl } = getEventoMetadata(ev);
      return `
      <div onclick="openEvento(${ev.id})" class="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 cursor-pointer hover:border-[#7353ba] transition">
        <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full aspect-[16/9] object-cover bg-slate-900" />
        <div class="px-4 py-3 reader-sm text-slate-600 flex items-center justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-800">${escapeHtml(ev.data)} - ${escapeHtml(ev.horario)}</p>
            <p class="text-slate-600">${escapeHtml(modalidade)}</p>
          </div>
          ${
            ev.inscrito
              ? `<span class="bg-purple-100 text-[#5b21b6] font-bold px-2.5 py-1 rounded-full text-xs shrink-0">✓ Inscrito</span>`
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

function openEvento(eventoId) {
  const ev = appData.eventos.find((e) => e.id === eventoId);
  if (!ev) return;

  const { modalidade, bannerUrl } = getEventoMetadata(ev);
  const speechKey = `evento-${ev.id}`;
  speechTexts[speechKey] = `${ev.titulo}. ${ev.data}, ${ev.horario}. ${modalidade}. Local: ${ev.local}. ${ev.descricao || ""}`;

  const paragraphs = String(ev.descricao || "")
    .split("\n\n")
    .filter(Boolean)
    .map(
      (p) => `<p class="reader-body text-slate-700 text-justify">${escapeHtml(p)}</p>`
    )
    .join("");

  const container = document.getElementById("evento-detalhe-content");
  container.innerHTML = `
    <div class="text-center mb-4">
      <h2 class="text-xl font-bold text-[#5b21b6] leading-snug">${escapeHtml(ev.titulo)}</h2>
      <div class="w-56 h-px bg-[#7353ba] mx-auto my-3"></div>
      <p class="reader-sm text-slate-700 font-medium">${escapeHtml(ev.data)} - ${escapeHtml(ev.horario)}</p>
      <p class="reader-sm text-slate-700">${escapeHtml(modalidade)}</p>
      <p class="reader-sm text-slate-700 mt-0.5">Local: <span class="underline">${escapeHtml(ev.local)}</span></p>
      <div class="mt-3 flex justify-center">
        ${buildSpeechButtonHtml(`speech-btn-evento-${ev.id}`, speechKey, "Ouvir detalhes")}
      </div>
    </div>

    <div class="my-4 overflow-hidden rounded-xl shadow border border-slate-200 max-w-md mx-auto">
      <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full aspect-[16/9] object-cover bg-slate-900" />
    </div>

    ${
      ev.precisaInscricao
        ? `<div class="text-center my-5">
            <button type="button" onclick="toggleInscricao(${ev.id})" class="pill-btn-purple px-10 py-3 text-sm font-semibold min-h-[44px]">
              ${ev.inscrito ? "✓ Inscrito (Cancelar)" : "Inscrever-se"}
            </button>
          </div>
          <div class="space-y-3 mt-3">${paragraphs}</div>`
        : `<div class="space-y-3 mt-4">${paragraphs}</div>
          <div class="text-center mt-5">
            <button type="button" onclick="toggleInscricao(${ev.id})" class="pill-btn-purple px-10 py-3 text-sm font-semibold min-h-[44px]">
              ${ev.inscrito ? "✓ Inscrito (Cancelar)" : "Inscrever-se"}
            </button>
          </div>`
    }
  `;

  navigate("screen-evento-detalhe");
}

function mostrarAvisoSemInscricao() {
  const modal = document.getElementById("webinario-modal");
  if (modal) modal.classList.remove("hidden");
}

function fecharAvisoSemInscricao() {
  const modal = document.getElementById("webinario-modal");
  if (modal) modal.classList.add("hidden");
}

async function toggleInscricao(eventoId) {
  if (!currentUser) {
    showToast("Faça login para se inscrever.");
    return;
  }

  try {
    const res = await authFetch(`/api/eventos/${eventoId}/inscricao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro na inscrição");
      if (res.status === 401 || (res.status === 404 && String(data.message || "").includes("Sessão expirada"))) {
        await logout();
      }
      return;
    }

    await loadAppData();
    openEvento(eventoId);

    if (data.inscrito && data.precisaInscricao === false) {
      mostrarAvisoSemInscricao();
    } else {
      showToast(data.message);
    }
  } catch (err) {
    showToast("Erro ao comunicar com o servidor.");
  }
}

// ==================================================
// 2. LINKS DE APOIO (Frame 00:17 - SVGs inline nítidos)
// ==================================================
function getSocialIconHtml(icone) {
  if (icone === "instagram") {
    return `
      <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5"></rect>
          <circle cx="12" cy="12" r="4"></circle>
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle>
        </svg>
      </div>`;
  }
  if (icone === "whatsapp") {
    return `
      <div class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      </div>`;
  }
  return `
    <div class="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
        <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"></path>
      </svg>
    </div>`;
}

function renderLinks() {
  const container = document.getElementById("links-list");
  if (!appData.links.length) {
    container.innerHTML = `<p class="text-center reader-sm text-slate-600 py-4">Nenhum link cadastrado.</p>`;
    return;
  }

  container.innerHTML = appData.links
    .map(
      (link) => `
    <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
       class="flex items-center gap-3 bg-white border border-purple-200 rounded-lg px-3.5 py-3 min-h-[48px] hover:bg-purple-50 transition">
      ${getSocialIconHtml(link.icone)}
      <span class="reader-sm font-medium text-[#5b21b6] underline">${escapeHtml(link.titulo)}</span>
    </a>
  `
    )
    .join("");
}

// ==================================================
// 3. SOBRE ALZHEIMER (Frames 00:20 a 00:29)
// ==================================================
function renderArtigos() {
  const container = document.getElementById("artigos-list");
  if (!appData.artigos.length) {
    container.innerHTML = `<p class="text-center reader-sm text-slate-600 py-8">Nenhum artigo disponível.</p>`;
    return;
  }

  container.innerHTML = appData.artigos
    .map(
      (art) => `
    <div onclick="openArtigo(${art.id})"
         class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 flex items-center justify-between gap-4 cursor-pointer hover:border-[#7353ba] transition min-h-[84px]">
      <div class="flex-1 text-center px-2">
        <h3 class="reader-body font-semibold text-slate-700">${escapeHtml(art.titulo)}</h3>
      </div>
      <img src="${escapeHtml(art.icone)}" alt="${escapeHtml(art.titulo)}" class="w-24 h-16 object-cover rounded-xl shrink-0 border border-slate-100 bg-slate-100" />
    </div>
  `
    )
    .join("");
}

function formatArtigoBlock(bloco, { centerHeadings = false } = {}) {
  const trimmed = bloco.trim();
  const isBulletList = trimmed.split("\n").every((line) => line.trim().startsWith("•"));

  if (isBulletList) {
    const items = trimmed
      .split("\n")
      .map((line) => line.replace(/^•\s*/, "").trim())
      .map((item) => `<li class="reader-body text-slate-700">${escapeHtml(item)}</li>`)
      .join("");
    return `<ul class="list-disc pl-5 space-y-2 mb-4 text-left">${items}</ul>`;
  }

  const isHeading =
    trimmed.endsWith(":") ||
    trimmed === "Tratamentos" ||
    /^\d+\.\s/.test(trimmed);

  if (isHeading) {
    return `<p class="reader-heading font-bold text-[#5b21b6] mt-4 mb-2 ${
      centerHeadings ? "text-center" : "text-left"
    }">${escapeHtml(trimmed)}</p>`;
  }

  return `<p class="reader-body text-slate-700 mb-3 whitespace-pre-line text-left">${escapeHtml(trimmed)}</p>`;
}

function openArtigo(artigoId) {
  const art = appData.artigos.find((a) => a.id === artigoId);
  if (!art) return;

  const speechKey = `artigo-${art.id}`;
  speechTexts[speechKey] = `${art.resumo || art.titulo}. ${String(art.conteudo || "").replace(/•/g, "")}`;

  const blocosRaw = String(art.conteudo || "")
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);

  const imgHtml = `
    <div class="my-4 flex justify-center">
      <img src="${escapeHtml(art.icone)}" alt="${escapeHtml(art.titulo)}" class="w-36 h-36 object-cover rounded-full shadow border-2 border-white bg-white" />
    </div>
  `;

  let bodyHtml = "";

  if (art.slug === "o-que-e") {
    bodyHtml = blocosRaw
      .map((bloco) => formatArtigoBlock(bloco, { centerHeadings: true }))
      .join("");
  } else if (art.slug === "orientacoes-alimentacao" && blocosRaw.length > 0) {
    const [intro, ...rest] = blocosRaw;
    bodyHtml =
      formatArtigoBlock(intro) +
      imgHtml +
      rest.map((bloco) => formatArtigoBlock(bloco)).join("");
  } else {
    bodyHtml =
      imgHtml +
      blocosRaw.map((bloco) => formatArtigoBlock(bloco)).join("");
  }

  const container = document.getElementById("artigo-detalhe-content");
  container.innerHTML = `
    <h2 class="text-center text-2xl font-bold text-[#5b21b6] mb-3 leading-tight">${escapeHtml(art.resumo || art.titulo)}</h2>
    <div class="flex justify-center mb-4">
      ${buildSpeechButtonHtml(`speech-btn-artigo-${art.id}`, speechKey, "Ouvir orientação")}
    </div>
    <div>${bodyHtml}</div>
  `;

  navigate("screen-artigo-detalhe");
}

// ==================================================
// 4. PERGUNTAS FREQUENTES (Frames 00:34 a 00:38)
// ==================================================
function renderFaqs() {
  const container = document.getElementById("faq-list");
  if (!appData.faqs.length) {
    container.innerHTML = `<p class="text-center reader-sm text-slate-600 py-8">Nenhuma pergunta cadastrada.</p>`;
    return;
  }

  container.innerHTML = appData.faqs
    .map((f) => {
      const speechKey = `faq-${f.id}`;
      speechTexts[speechKey] = `${f.pergunta} ${f.resposta}`;
      return `
    <div>
      <button type="button" id="faq-btn-${f.id}" aria-expanded="false" onclick="toggleFaq(${f.id})"
              class="w-full py-2.5 min-h-[44px] text-left flex items-center justify-between gap-3 group">
        <span class="reader-sm font-semibold text-slate-700 group-hover:text-[#5b21b6] transition">${escapeHtml(f.pergunta)}</span>
        <svg id="faq-tri-${f.id}" viewBox="0 0 18 14" class="w-4 h-3.5 shrink-0 text-[#5b21b6] transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="1.6">
          <polygon points="2,2 16,2 9,12" stroke-linejoin="round" />
        </svg>
      </button>
      <div id="faq-ans-${f.id}" class="hidden mt-1.5 p-3.5 bg-white/85 border border-[#7353ba] rounded-md reader-body text-slate-700 space-y-2.5">
        <p>${escapeHtml(f.resposta)}</p>
        <div>
          ${buildSpeechButtonHtml(`speech-btn-faq-${f.id}`, speechKey, "Ouvir resposta", true)}
        </div>
      </div>
    </div>
  `;
    })
    .join("");
}

function toggleFaq(id) {
  const ans = document.getElementById(`faq-ans-${id}`);
  const tri = document.getElementById(`faq-tri-${id}`);
  const btn = document.getElementById(`faq-btn-${id}`);
  if (!ans) return;

  const isHidden = ans.classList.contains("hidden");
  ans.classList.toggle("hidden", !isHidden);
  if (tri) tri.classList.toggle("rotate-180", isHidden);
  if (btn) btn.setAttribute("aria-expanded", isHidden ? "true" : "false");

  if (!isHidden && activeSpeechBtnId === `speech-btn-faq-${id}`) {
    stopSpeech();
  }
}

// ==================================================
// 5. PERFIL DO USUÁRIO (Visualizar, Editar, Eventos Inscritos e Sair)
// ==================================================
function getInitials(nome) {
  const parts = String(nome || "U").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function openProfile() {
  isEditingProfile = false;
  renderProfile();
  navigate("screen-profile");
}

function toggleEditProfile(editing) {
  isEditingProfile = editing;
  renderProfile();
  lucide.createIcons();
}

function renderProfile() {
  const container = document.getElementById("profile-content");
  if (!currentUser) {
    container.innerHTML = `<p class="text-center text-xs text-slate-500">Faça login para visualizar seu perfil.</p>`;
    return;
  }

  const subscribedEvents = appData.eventos.filter((ev) => ev.inscrito);
  const eventsHtml = subscribedEvents.length
    ? subscribedEvents
        .map(
          (ev) => `
          <button type="button" onclick="openEvento(${ev.id})" class="w-full text-left flex items-center justify-between gap-3 p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 hover:border-[#7353ba] transition">
            <div>
              <p class="text-xs font-semibold text-[#5b21b6]">${escapeHtml(ev.titulo)}</p>
              <p class="text-[11px] text-slate-500">${escapeHtml(ev.data)} • ${escapeHtml(ev.horario)}</p>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-[#7353ba] shrink-0"></i>
          </button>`
        )
        .join("")
    : `<p class="text-xs text-slate-400 text-center py-2">Você ainda não se inscreveu em nenhum evento.</p>`;

  if (isEditingProfile) {
    container.innerHTML = `
      <form onsubmit="saveProfile(event)" class="bg-white rounded-2xl p-5 shadow-sm border border-purple-200 space-y-3.5">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-bold text-[#5b21b6]">Editar Informações</h3>
          <button type="button" onclick="toggleEditProfile(false)" class="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Nome</label>
          <input type="text" id="prof-nome" required value="${escapeHtml(currentUser.nome)}" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Data de nascimento</label>
          <div class="input-lilac flex items-center px-3.5 py-2.5 gap-2.5">
            <div class="relative w-4 h-4 shrink-0 flex items-center justify-center text-[#5b21b6] hover:text-[#4c1d95]" title="Abrir calendário">
              <i data-lucide="calendar" class="w-4 h-4 pointer-events-none"></i>
              <input type="date" id="prof-nasc-picker" min="1905-01-01" aria-label="Abrir calendário para data de nascimento"
                     onclick="try { this.showPicker && this.showPicker(); } catch {}"
                     class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
            <input type="text" id="prof-nasc" inputmode="numeric" maxlength="10" value="${escapeHtml(currentUser.dataNascimento || "")}" placeholder="dd/mm/aaaa" class="bg-transparent w-full text-sm focus:outline-none" />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Nome da pessoa próxima com Alzheimer</label>
          <input type="text" id="prof-pessoa" value="${escapeHtml(currentUser.pessoaComAlzheimer || "")}" placeholder="Nome da pessoa próxima com Alzheimer" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Vínculo / Parentesco</label>
          <select id="prof-parentesco" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none">
            <option value="">Não informado</option>
            ${["Filho(a)", "Cônjuge", "Neto(a)", "Outro familiar", "Cuidador(a) profissional", "Amigo(a) / Outro"]
              .map(
                (opt) =>
                  `<option value="${opt}" ${currentUser.parentesco === opt ? "selected" : ""}>${opt}</option>`
              )
              .join("")}
          </select>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Estágio aproximado do Alzheimer</label>
          <select id="prof-estagio" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none">
            <option value="">Não informado</option>
            ${["Em investigação", "Inicial (leve)", "Moderado", "Avançado", "Prefiro não informar"]
              .map(
                (opt) =>
                  `<option value="${opt}" ${currentUser.estagioDaDoenca === opt ? "selected" : ""}>${opt}</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-semibold text-slate-500 block mb-1">Cidade</label>
            <input type="text" id="prof-cidade" value="${escapeHtml(currentUser.cidade || "")}" placeholder="Ex.: Recife" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
          </div>

          <div class="relative" data-estado-wrapper>
            <label class="text-[11px] font-semibold text-slate-500 block mb-1">Estado</label>
            <div class="input-lilac flex items-center px-3 py-2.5 gap-1.5">
              <input type="text" id="prof-estado" autocomplete="off" value="${escapeHtml(currentUser.estado || "")}" placeholder="Digite ou escolha" class="bg-transparent w-full text-sm focus:outline-none min-w-0" />
              <button type="button" id="prof-estado-btn" aria-label="Abrir lista de estados" title="Escolher estado" class="text-[#5b21b6]/80 hover:text-[#4c1d95] shrink-0 focus:outline-none">
                <i data-lucide="chevron-down" class="w-4 h-4"></i>
              </button>
            </div>
            <div id="prof-estado-list" class="hidden absolute left-0 right-0 bottom-full mb-1 z-30 max-h-44 overflow-y-auto bg-white border border-purple-200 rounded-xl shadow-lg py-1"></div>
          </div>
        </div>

        <div class="pt-2 flex gap-3">
          <button type="button" onclick="toggleEditProfile(false)" class="pill-btn-white flex-1 py-2.5 text-xs font-semibold text-slate-700">
            Cancelar
          </button>
          <button type="submit" class="pill-btn-purple flex-1 py-2.5 text-xs font-semibold">
            Salvar Alterações
          </button>
        </div>
      </form>
    `;
    initDatePickerPair("prof-nasc", "prof-nasc-picker");
    initEstadoCombobox("prof-estado", "prof-estado-list", "prof-estado-btn");
    return;
  }

  const birthLabel = currentUser.dataNascimento
    ? `${escapeHtml(currentUser.dataNascimento)}${currentUser.idade ? ` (${escapeHtml(currentUser.idade)} anos)` : ""}`
    : currentUser.idade
      ? `${escapeHtml(currentUser.idade)} anos`
      : "Não informado";

  container.innerHTML = `
    <!-- Cartão principal do usuário -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-purple-200/80">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-[#6f2dbd] text-white font-brand font-extrabold text-xl flex items-center justify-center shrink-0 shadow">
          ${escapeHtml(getInitials(currentUser.nome))}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-bold text-slate-800 truncate">${escapeHtml(currentUser.nome)}</h3>
          <p class="text-xs text-slate-500 truncate">${escapeHtml(currentUser.email)}</p>
          ${
            currentUser.idade
              ? `<span class="inline-block mt-1 bg-purple-100 text-[#5b21b6] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">${escapeHtml(currentUser.idade)} anos</span>`
              : ""
          }
        </div>
        <button type="button" onclick="toggleEditProfile(true)" class="text-xs font-semibold text-[#7353ba] hover:underline shrink-0">
          Editar
        </button>
      </div>
    </div>

    <!-- Detalhes sobre o cuidado -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-[#5b21b6]">Sobre o Cuidado</h4>
      <div class="grid grid-cols-1 gap-2.5 reader-sm">
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-600">Data de nascimento</span>
          <span class="font-semibold text-slate-800 text-right">${birthLabel}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-600">Nome da pessoa próxima com Alzheimer</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.pessoaComAlzheimer || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-600">Parentesco / Vínculo</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.parentesco || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-600">Estágio aproximado</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.estagioDaDoenca || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-600">Cidade</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.cidade || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-slate-600">Estado</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.estado || "Não informado")}</span>
        </div>
      </div>
    </div>

    <!-- Eventos inscritos -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-[#5b21b6]">Meus Eventos Inscritos</h4>
      <div class="space-y-2">${eventsHtml}</div>
    </div>

    <!-- Botão de sair da conta -->
    <div class="pt-1 flex justify-center">
      <button type="button" onclick="logout()" class="pill-btn-white px-8 py-2.5 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 flex items-center gap-2">
        <i data-lucide="log-out" class="w-4 h-4"></i>
        Sair da conta
      </button>
    </div>
  `;
}

async function saveProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  const dataNascimento = document.getElementById("prof-nasc").value.trim();
  if (dataNascimento && !brDateToIso(dataNascimento)) {
    showToast("Informe uma data de nascimento válida (dd/mm/aaaa).");
    return;
  }

  const payload = {
    nome: document.getElementById("prof-nome").value.trim(),
    dataNascimento,
    pessoaComAlzheimer: document.getElementById("prof-pessoa").value.trim(),
    parentesco: document.getElementById("prof-parentesco").value,
    estagioDaDoenca: document.getElementById("prof-estagio").value,
    cidade: document.getElementById("prof-cidade").value.trim(),
    estado: document.getElementById("prof-estado").value.trim(),
  };

  try {
    const res = await authFetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro ao salvar perfil.");
      if (res.status === 401) await logout();
      return;
    }

    setCurrentUser(data);
    updateHomeGreeting(currentUser.nome);
    isEditingProfile = false;
    renderProfile();
    lucide.createIcons();
    showToast("Perfil atualizado com sucesso!");
  } catch (err) {
    showToast("Erro ao conectar ao servidor.");
  }
}

// ==================================================
// 6. REGISTRO EM 2 ETAPAS, LOGIN E RECUPERAÇÃO
// ==================================================
function setRegisterStep(step) {
  currentRegStep = step;
  const step1 = document.getElementById("reg-step-1");
  const step2 = document.getElementById("reg-step-2");
  const badge = document.getElementById("reg-step-badge");
  if (!step1 || !step2 || !badge) return;

  const step2RequiredIds = ["reg-nasc", "reg-pessoa", "reg-parentesco"];
  step2RequiredIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = step === 2;
  });

  if (step === 2) {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    badge.textContent = "Passo 2 de 2 • Sobre o Cuidado";
  } else {
    step2.classList.add("hidden");
    step1.classList.remove("hidden");
    badge.textContent = "Passo 1 de 2 • Acesso";
  }
  resetPasswordVisibility();
}

function avancarEtapaRegistro() {
  const nome = document.getElementById("reg-nome").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const senha = document.getElementById("reg-senha").value;
  const confirmar = document.getElementById("reg-confirmar-senha").value;

  if (!nome || !email || !senha || !confirmar) {
    showToast("Preencha todos os campos de acesso.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Informe um email válido.");
    return;
  }
  if (senha.length < 6) {
    showToast("A senha deve ter pelo menos 6 caracteres.");
    return;
  }
  if (senha !== confirmar) {
    showToast("As senhas não coincidem.");
    return;
  }

  setRegisterStep(2);
}

function voltarRegistro() {
  if (currentRegStep === 2) {
    setRegisterStep(1);
  } else {
    navigate("screen-welcome", false);
  }
}

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentRegStep !== 2) {
    avancarEtapaRegistro();
    return;
  }

  const nome = document.getElementById("reg-nome").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const senha = document.getElementById("reg-senha").value;
  const dataNascimento = document.getElementById("reg-nasc").value.trim();
  const pessoaComAlzheimer = document.getElementById("reg-pessoa").value.trim();
  const parentesco = document.getElementById("reg-parentesco").value;
  const estagioDaDoenca = document.getElementById("reg-estagio").value;
  const cidade = document.getElementById("reg-cidade").value.trim();
  const estado = document.getElementById("reg-estado").value.trim();

  if (!brDateToIso(dataNascimento)) {
    showToast("Informe uma data de nascimento válida (dd/mm/aaaa).");
    return;
  }

  const btn = document.getElementById("btn-reg-submit");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Criando conta...";

  try {
    const res = await authFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        email,
        senha,
        dataNascimento,
        pessoaComAlzheimer,
        parentesco,
        estagioDaDoenca,
        cidade,
        estado,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro no cadastro");
      return;
    }

    setCurrentUser(data);
    document.getElementById("form-register").reset();
    setRegisterStep(1);
    updateHomeGreeting(currentUser.nome);
    showToast("Cadastro realizado!");
    await loadAppData();
    goHome();
  } catch (err) {
    showToast("Erro ao criar conta.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;

  try {
    const res = await authFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Falha no login");
      return;
    }

    setCurrentUser(data);
    updateHomeGreeting(currentUser.nome);
    await loadAppData();
    goHome();
  } catch (err) {
    showToast("Erro ao conectar ao servidor.");
  }
});

function setRecoverStep(step, customMessage) {
  const step1 = document.getElementById("form-recover-request");
  const step2 = document.getElementById("form-recover-confirm");
  if (!step1 || !step2) return;

  if (step === 2) {
    const email = document.getElementById("rec-email").value.trim();
    if (!email) {
      showToast("Informe seu email primeiro.");
      step1.classList.remove("hidden");
      step2.classList.add("hidden");
      return;
    }
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    document.getElementById("rec-status-msg").textContent =
      customMessage ||
      `Digite o código de 6 dígitos enviado para ${email} e escolha sua nova senha.`;
  } else {
    step2.classList.add("hidden");
    step1.classList.remove("hidden");
  }
}

async function solicitarCodigoRecuperacao() {
  const email = document.getElementById("rec-email").value.trim();
  const btn = document.getElementById("btn-rec-request");
  if (!email) {
    showToast("Informe o email cadastrado.");
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Enviando...";

  try {
    const res = await fetch("/api/auth/recover/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro ao enviar código.");
      return;
    }

    showToast(data.message);
    const stepMsg =
      data.deliveryMode === "console"
        ? `Modo demo: confira o código de 6 dígitos no terminal do servidor para ${email}.`
        : `Enviamos um código de 6 dígitos para ${email}. Ele expira em 15 minutos.`;
    setRecoverStep(2, stepMsg);
  } catch (err) {
    showToast("Erro ao conectar ao servidor.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function reenviarCodigoRecuperacao() {
  await solicitarCodigoRecuperacao();
}

document.getElementById("form-recover-request").addEventListener("submit", async (e) => {
  e.preventDefault();
  await solicitarCodigoRecuperacao();
});

document.getElementById("form-recover-confirm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("rec-email").value.trim();
  const codigo = document.getElementById("rec-codigo").value.trim();
  const novaSenha = document.getElementById("rec-senha").value;
  const btn = document.getElementById("btn-rec-confirm");

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Validando...";

  try {
    const res = await fetch("/api/auth/recover/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo, novaSenha }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro ao redefinir senha");
      return;
    }

    showToast("Senha atualizada com sucesso!");
    document.getElementById("rec-codigo").value = "";
    document.getElementById("rec-senha").value = "";
    navigate("screen-login", false);
  } catch (err) {
    showToast("Erro ao conectar ao servidor.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ==================================================
// 7. ASSISTENTE CUIDA (IA CONTEXTUALIZADA E ACERVO CIENTÍFICO)
// ==================================================
const assistantState = {
  messages: [],
  loading: false,
  sources: [],
  sourcesLoaded: false,
  geminiEnabled: false,
  sourcesPanelOpen: false,
};

function resetAssistantState() {
  assistantState.messages = [];
  assistantState.loading = false;
  assistantState.sourcesPanelOpen = false;
  const panel = document.getElementById("assistant-sources-panel");
  if (panel) panel.classList.add("hidden");
  const toggleBtn = document.getElementById("assistant-sources-toggle");
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
}

function formatAssistantInlineMarkdown(rawLine) {
  let safe = escapeHtml(rawLine);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[#4c1d95]">$1</strong>');
  return safe;
}

function formatAssistantAnswerHtml(rawText) {
  const lines = String(rawText || "").split("\n");
  const htmlParts = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    htmlParts.push(`<ul class="list-disc pl-5 space-y-1.5 my-2">${listItems.join("")}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s+/, "");
      listItems.push(
        `<li class="reader-body text-slate-700">${formatAssistantInlineMarkdown(content)}</li>`
      );
      continue;
    }

    flushList();
    htmlParts.push(
      `<p class="reader-body text-slate-700">${formatAssistantInlineMarkdown(trimmed)}</p>`
    );
  }

  flushList();
  return htmlParts.join("");
}

function stripMarkdownForSpeech(rawText) {
  return String(rawText || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-•*]\s+/gm, "")
    .trim();
}

function buildWelcomeAssistantMessage() {
  const firstName = currentUser?.nome?.trim().split(/\s+/)[0];
  const lovedOne = currentUser?.pessoaComAlzheimer?.trim();
  const stage = currentUser?.estagioDaDoenca?.trim();

  let greeting = firstName ? `Olá, ${firstName}! ` : "Olá! ";
  greeting += "Sou o **Assistente CuiDA**. ";
  if (lovedOne) {
    greeting += `Estou aqui para ajudar você nos cuidados com **${lovedOne}**`;
    if (stage && stage !== "Prefiro não informar") {
      greeting += ` (${stage})`;
    }
    greeting += ". ";
  }
  greeting +=
    "Minhas orientações são baseadas nos protocolos do **Ministério da Saúde**, **OMS (iSupport)**, **ABRAz**, **NICE** e médicos geriatras do acervo.";

  return {
    id: "welcome",
    role: "assistant",
    content: greeting,
    sources: [],
    suggestions: [
      "Meu familiar quer sair de casa para ir embora. Como agir?",
      "Como facilitar o banho sem gerar conflito?",
      "Quais medicamentos são gratuitos no SUS?",
    ],
    isWelcome: true,
  };
}

function renderAssistantSourcesPanel() {
  const badgeEl = document.getElementById("assistant-sources-badge");
  const panel = document.getElementById("assistant-sources-panel");
  if (!panel) return;

  const count = assistantState.sources.length;
  if (badgeEl) {
    badgeEl.textContent = count ? `Acervo (${count} PDFs)` : "Acervo científico";
  }

  if (!count) {
    panel.innerHTML = `<p class="text-xs text-slate-500">Carregando documentos científicos do acervo...</p>`;
    return;
  }

  const modeHint = assistantState.geminiEnabled
    ? "Motor ativo: Gemini API + Acervo Curado"
    : "Motor ativo: RAG Científico Local (acervo-pdf)";

  const itemsHtml = assistantState.sources
    .map(
      (src) => `
      <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer"
         class="flex items-start justify-between gap-2 p-2 rounded-lg bg-purple-50/70 hover:bg-purple-100/70 border border-purple-100 transition">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[#5b21b6] leading-snug">${escapeHtml(src.title)}</p>
          <p class="text-[11px] text-slate-600">${escapeHtml(src.institution)} • ${escapeHtml(src.year)}</p>
        </div>
        <span class="text-[11px] font-semibold text-[#7353ba] shrink-0 underline">Abrir PDF</span>
      </a>`
    )
    .join("");

  panel.innerHTML = `
    <div class="flex items-center justify-between gap-2 pb-1 border-b border-purple-100">
      <span class="text-[11px] font-bold uppercase tracking-wide text-[#5b21b6]">Fontes Oficiais Indexadas</span>
      <span class="text-[10px] font-medium text-slate-500">${escapeHtml(modeHint)}</span>
    </div>
    <div class="space-y-1.5 pt-1">${itemsHtml}</div>
  `;
}

function toggleAssistantSourcesPanel() {
  assistantState.sourcesPanelOpen = !assistantState.sourcesPanelOpen;
  const panel = document.getElementById("assistant-sources-panel");
  const btn = document.getElementById("assistant-sources-toggle");
  if (panel) panel.classList.toggle("hidden", !assistantState.sourcesPanelOpen);
  if (btn) btn.setAttribute("aria-expanded", assistantState.sourcesPanelOpen ? "true" : "false");
}

async function loadAssistantSources() {
  if (assistantState.sourcesLoaded) {
    renderAssistantSourcesPanel();
    return;
  }
  try {
    const res = await fetch("/api/assistente/fontes");
    if (!res.ok) return;
    const data = await res.json();
    assistantState.sources = Array.isArray(data.sources) ? data.sources : [];
    assistantState.geminiEnabled = Boolean(data.geminiEnabled);
    assistantState.sourcesLoaded = true;
    renderAssistantSourcesPanel();
  } catch (err) {
    console.error("Erro ao buscar fontes do assistente:", err);
  }
}

function scrollAssistantToTop() {
  const container = document.getElementById("assistant-messages");
  if (container) container.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollAssistantToBottom() {
  const container = document.getElementById("assistant-messages");
  if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}

function renderAssistantMessages(scrollBehavior = "preserve") {
  const container = document.getElementById("assistant-messages");
  if (!container) return;

  const prevScrollTop = container.scrollTop;

  const list = assistantState.messages.length
    ? assistantState.messages
    : [buildWelcomeAssistantMessage()];

  const bubblesHtml = list
    .map((msg, msgIdx) => {
      if (msg.role === "user") {
        return `
          <div id="assistant-msg-wrap-${msgIdx}" class="flex justify-end">
            <div class="max-w-[85%] bg-[#7353ba] text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
              <p class="reader-body text-white">${escapeHtml(msg.content)}</p>
            </div>
          </div>`;
      }

      const speechKey = `assistant-msg-${msgIdx}`;
      speechTexts[speechKey] = stripMarkdownForSpeech(msg.content);

      const sourcesHtml =
        Array.isArray(msg.sources) && msg.sources.length
          ? `<div class="pt-2.5 mt-2.5 border-t border-purple-100 space-y-1.5">
               <p class="text-[11px] font-bold uppercase tracking-wide text-[#5b21b6]">Fontes científicas consultadas</p>
               <div class="flex flex-wrap gap-1.5">
                 ${msg.sources
                   .map((src) => {
                     const targetUrl = src.pageUrl || src.url;
                     const pageTag = src.startPage
                       ? src.endPage && src.endPage !== src.startPage
                         ? ` • págs. ${src.startPage}–${src.endPage}`
                         : ` • pág. ${src.startPage}`
                       : "";
                     const tooltip = [
                       src.institution,
                       src.year ? `(${src.year})` : "",
                       src.sectionTitle ? `Seção: ${src.sectionTitle}` : "",
                     ]
                       .filter(Boolean)
                       .join(" | ");
                     const shortTitle =
                       src.title.length > 36 ? src.title.slice(0, 36) + "..." : src.title;
                     return `
                     <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer"
                        title="${escapeHtml(tooltip)}"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[11px] font-medium text-[#5b21b6] transition">
                       <span>📄 ${escapeHtml(shortTitle + pageTag)}</span>
                     </a>`;
                   })
                   .join("")}
               </div>
             </div>`
          : "";

      const suggestionsHtml =
        Array.isArray(msg.suggestions) && msg.suggestions.length && msgIdx === list.length - 1 && !assistantState.loading
          ? `<div class="pt-2.5 mt-2 border-t border-slate-100 space-y-1.5">
               <p class="text-[11px] font-semibold text-slate-500">Perguntas relacionadas:</p>
               <div class="flex flex-wrap gap-1.5">
                 ${msg.suggestions
                   .map(
                     (sug, sIdx) => `
                     <button type="button" data-assistant-sug="${msgIdx}:${sIdx}"
                             class="text-left px-3 py-1.5 rounded-xl bg-[#f7f4ef] hover:bg-purple-50 border border-purple-200/80 text-xs font-medium text-[#4c1d95] transition">
                       ${escapeHtml(sug)}
                     </button>`
                   )
                   .join("")}
               </div>
             </div>`
          : "";

      return `
        <div id="assistant-msg-wrap-${msgIdx}" class="flex justify-start">
          <div class="w-full max-w-[96%] bg-white rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm border border-purple-200/80 space-y-2">
            ${formatAssistantAnswerHtml(msg.content)}
            <div class="pt-1 flex flex-wrap items-center justify-between gap-2">
              ${buildSpeechButtonHtml(`speech-btn-ast-${msgIdx}`, speechKey, "Ouvir orientação", true)}
              ${
                msg.isWelcome
                  ? ""
                  : `<span class="text-[10px] text-slate-400">Base educativa • Não substitui consulta médica</span>`
              }
            </div>
            ${sourcesHtml}
            ${suggestionsHtml}
          </div>
        </div>`;
    })
    .join("");

  const loadingHtml = assistantState.loading
    ? `<div id="assistant-loading-indicator" class="flex justify-start">
         <div class="bg-white rounded-2xl px-4 py-3 border border-purple-200 shadow-sm text-xs text-[#5b21b6] font-medium flex items-center gap-2">
           <span class="inline-block w-2 h-2 rounded-full bg-[#7353ba] animate-pulse"></span>
           <span>Consultando o acervo científico do CuiDA...</span>
         </div>
       </div>`
    : "";

  container.innerHTML = `<div class="desktop-readable space-y-3.5">${bubblesHtml}${loadingHtml}</div>`;

  container.querySelectorAll("[data-assistant-sug]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [mIdxStr, sIdxStr] = (btn.getAttribute("data-assistant-sug") || "").split(":");
      const targetMsg = list[Number(mIdxStr)];
      const q = targetMsg?.suggestions?.[Number(sIdxStr)];
      if (q) sendAssistantQuestion(q);
    });
  });

  // Controle de rolagem pensado para leitura confortável do início da resposta
  if (scrollBehavior === "to-question") {
    const userEl = document.getElementById(`assistant-msg-wrap-${list.length - 1}`);
    if (userEl) {
      container.scrollTop = Math.max(0, userEl.offsetTop - 12);
    }
  } else if (scrollBehavior === "anchor-reply-start") {
    const replyEl = document.getElementById(`assistant-msg-wrap-${list.length - 1}`);
    const userBeforeEl = document.getElementById(`assistant-msg-wrap-${list.length - 2}`);
    if (replyEl) {
      const replyTopVisible =
        replyEl.offsetTop >= prevScrollTop &&
        replyEl.offsetTop <= prevScrollTop + Math.max(120, container.clientHeight - 140);
      if (replyTopVisible) {
        container.scrollTop = prevScrollTop;
      } else {
        const anchorEl = userBeforeEl || replyEl;
        container.scrollTop = Math.max(0, anchorEl.offsetTop - 12);
      }
    } else {
      container.scrollTop = prevScrollTop;
    }
  } else if (scrollBehavior === "to-top") {
    container.scrollTop = 0;
  } else {
    container.scrollTop = prevScrollTop;
  }
}

function openAssistant() {
  if (!assistantState.messages.length) {
    assistantState.messages = [buildWelcomeAssistantMessage()];
    renderAssistantMessages("to-top");
  } else {
    renderAssistantMessages("preserve");
  }
  loadAssistantSources();
  navigate("screen-assistente");
}

function askAssistantQuick(questionText) {
  sendAssistantQuestion(questionText);
}

async function sendAssistantQuestion(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  if (!question || assistantState.loading) return;

  stopSpeech();

  if (!assistantState.messages.length) {
    assistantState.messages = [buildWelcomeAssistantMessage()];
  }

  const history = assistantState.messages
    .filter((m) => !m.isWelcome)
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));

  assistantState.messages.push({
    id: `u-${Date.now()}`,
    role: "user",
    content: question,
  });
  assistantState.loading = true;

  const inputEl = document.getElementById("assistant-input");
  const submitBtn = document.getElementById("assistant-submit-btn");
  if (inputEl) inputEl.value = "";
  if (submitBtn) submitBtn.disabled = true;

  renderAssistantMessages("to-question");

  try {
    const res = await authFetch("/api/assistente/perguntar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        history,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const apiErr = new Error(data?.message || "Erro ao consultar assistente.");
      apiErr.isApiMessage = Boolean(data?.message);
      throw apiErr;
    }

    assistantState.messages.push({
      id: `a-${Date.now()}`,
      role: "assistant",
      content: data.answer,
      sources: Array.isArray(data.sources) ? data.sources : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    });
  } catch (err) {
    assistantState.messages.push({
      id: `err-${Date.now()}`,
      role: "assistant",
      content: err?.isApiMessage
        ? err.message
        : "Não consegui concluir sua consulta agora. Verifique se o servidor está ativo e tente novamente em instantes.",
      sources: [],
      suggestions: [],
    });
    showToast(err?.message || "Erro ao consultar o assistente.");
  } finally {
    assistantState.loading = false;
    if (submitBtn) submitBtn.disabled = false;
    renderAssistantMessages("anchor-reply-start");
    lucide.createIcons();
  }
}

document.getElementById("form-assistant")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const inputEl = document.getElementById("assistant-input");
  await sendAssistantQuestion(inputEl?.value || "");
});

// ==================================================
// 8. FÓRUM DE CUIDADORES (COMUNIDADE MVP)
// ==================================================
let forumSending = false;

function formatForumTimestamp(isoDate) {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes} às ${hora}:${min}`;
  } catch {
    return "";
  }
}

function formatForumMessageWithLinks(rawText) {
  const safeText = escapeHtml(rawText);
  return safeText.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const isYoutube = /youtube\.com|youtu\.be/i.test(url);
    const label = isYoutube ? "Assistir vídeo recomendado no YouTube" : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#5b21b6] font-bold text-xs underline break-all transition"><span>▶ ${label}</span></a>`;
  });
}

function renderForumMessages(scrollToEnd = false) {
  const container = document.getElementById("forum-messages-list");
  if (!container) return;

  const messages = Array.isArray(appData.forumMessages) ? appData.forumMessages : [];
  if (!messages.length) {
    container.innerHTML = `
      <div class="desktop-readable bg-white/90 border border-purple-200 rounded-2xl p-5 text-center">
        <p class="reader-body font-semibold text-slate-700">Ainda não há mensagens no fórum.</p>
        <p class="text-xs text-slate-500 mt-1">Seja o primeiro a compartilhar uma experiência ou dica!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages
    .map((msg) => {
      const isMine = currentUser && Number(msg.userId) === Number(currentUser.id);
      const autorNome = msg.autor?.nome || "Cuidador(a)";
      const initial = String(autorNome).trim().charAt(0).toUpperCase() || "C";
      const details = [];
      if (msg.autor?.pessoaComAlzheimer) {
        details.push(`Cuida de ${msg.autor.pessoaComAlzheimer}`);
      }
      if (msg.autor?.estagioDaDoenca && msg.autor.estagioDaDoenca !== "Prefiro não informar") {
        details.push(`Fase: ${msg.autor.estagioDaDoenca}`);
      }
      if (msg.autor?.cidade) {
        details.push(msg.autor.cidade);
      }
      const subtitle = details.join(" • ");
      const timeStr = formatForumTimestamp(msg.createdAt);

      const speechKey = `forum-msg-${msg.id}`;
      const speechBtnId = `btn-tts-forum-${msg.id}`;
      speechTexts[speechKey] = `${autorNome} escreveu no fórum: ${msg.conteudo}`;

      const cardAlignClass = isMine
        ? "bg-[#ede9fe] border-[#7353ba]/40 ml-4"
        : "bg-white border-purple-200/80 mr-4";

      return `
        <article class="desktop-readable rounded-2xl border ${cardAlignClass} p-4 shadow-sm space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-full ${isMine ? "bg-[#5b21b6] text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"} font-brand font-extrabold text-sm flex items-center justify-center shrink-0">
                ${escapeHtml(initial)}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-brand text-sm font-extrabold text-slate-900">${escapeHtml(autorNome)}</span>
                  ${
                    isMine
                      ? `<span class="px-2 py-0.5 rounded-full bg-[#5b21b6] text-white text-[10px] font-bold">Você</span>`
                      : `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Membro da Comunidade</span>`
                  }
                </div>
                ${subtitle ? `<p class="text-[11px] text-slate-500 truncate">${escapeHtml(subtitle)}</p>` : ""}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${timeStr ? `<span class="text-[10px] text-slate-400 font-medium">${escapeHtml(timeStr)}</span>` : ""}
              ${buildSpeechButtonHtml(speechBtnId, speechKey, "Ouvir", true)}
            </div>
          </div>

          <div class="reader-body text-slate-800 leading-relaxed whitespace-pre-line break-words pt-1">
            ${formatForumMessageWithLinks(msg.conteudo)}
          </div>
        </article>
      `;
    })
    .join("");

  if (scrollToEnd) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

async function loadForumMessages(showFeedback = false) {
  try {
    const res = await authFetch("/api/forum/mensagens");
    if (!res.ok) throw new Error("Erro ao carregar mensagens do fórum");
    const data = await res.json();
    appData.forumMessages = Array.isArray(data.messages) ? data.messages : [];
    renderForumMessages(false);
    lucide.createIcons();
    if (showFeedback) showToast("Fórum atualizado!");
  } catch (err) {
    console.error(err);
    if (showFeedback) showToast("Não foi possível atualizar o fórum agora.");
  }
}

async function openForum() {
  navigate("screen-forum");
  renderForumMessages(false);
  await loadForumMessages(false);
}

document.getElementById("form-forum")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (forumSending) return;

  const inputEl = document.getElementById("forum-input");
  const submitBtn = document.getElementById("forum-submit-btn");
  const conteudo = String(inputEl?.value || "").trim();
  if (!conteudo) return;

  forumSending = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await authFetch("/api/forum/mensagens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data?.message || "Erro ao publicar mensagem no fórum.");
      return;
    }

    if (inputEl) inputEl.value = "";
    if (data?.message) {
      appData.forumMessages.push(data.message);
      renderForumMessages(true);
      lucide.createIcons();
    } else {
      await loadForumMessages(false);
    }
    showToast("Mensagem publicada no fórum!");
  } catch (err) {
    console.error(err);
    showToast("Erro de conexão ao enviar mensagem.");
  } finally {
    forumSending = false;
    if (submitBtn) submitBtn.disabled = false;
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  initViewMode();
  initTextScale();
  initDatePickerPair("reg-nasc", "reg-nasc-picker");
  initEstadoCombobox("reg-estado", "reg-estado-list", "reg-estado-btn");
  lucide.createIcons();
  const saved = localStorage.getItem("cuida_user");
  if (saved) {
    try {
      const check = await authFetch("/api/auth/me");
      if (!check.ok) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser(await check.json());
      updateHomeGreeting(currentUser.nome);
      await loadAppData();
      goHome();
    } catch {
      setCurrentUser(null);
    }
  }
});
