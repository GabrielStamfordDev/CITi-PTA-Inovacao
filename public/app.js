let currentUser = null;
let appData = {
  eventos: [],
  links: [],
  artigos: [],
  faqs: [],
};
let navHistory = [];
let currentRegStep = 1;
let isEditingProfile = false;

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

  // A barra inferior com "Voltar" e "Página Inicial" aparece apenas nas telas internas
  const noBottomBarScreens = [
    "screen-welcome",
    "screen-login",
    "screen-register",
    "screen-recover",
    "screen-home",
  ];
  const hideBottom = noBottomBarScreens.includes(screenId);
  document.getElementById("bottom-nav").classList.toggle("hidden", hideBottom);

  lucide.createIcons();
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

function logout() {
  currentUser = null;
  isEditingProfile = false;
  localStorage.removeItem("cuida_user");
  navHistory = [];
  navigate("screen-welcome", false);
}

function updateHomeGreeting(nome) {
  const firstName = String(nome || "cuidador").trim().split(/\s+/)[0];
  document.getElementById("home-greeting").textContent = `Olá, ${firstName}, como posso te ajudar hoje?`;
}

async function loadAppData() {
  try {
    const query = currentUser ? `?userId=${currentUser.id}` : "";
    const res = await fetch(`/api/dados${query}`);
    if (!res.ok) throw new Error("Erro ao carregar dados");
    appData = await res.json();

    renderEventos();
    renderLinks();
    renderArtigos();
    renderFaqs();
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
    container.innerHTML = `<p class="text-center text-xs text-slate-500 py-8">Nenhum evento disponível no momento.</p>`;
    return;
  }

  container.innerHTML = appData.eventos
    .map((ev) => {
      const { modalidade, bannerUrl } = getEventoMetadata(ev);
      return `
      <div onclick="openEvento(${ev.id})" class="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 cursor-pointer hover:border-[#7353ba] transition">
        <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full aspect-[16/9] object-cover bg-slate-900" />
        <div class="px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between gap-2">
          <div>
            <p class="font-medium text-slate-700">${escapeHtml(ev.data)} - ${escapeHtml(ev.horario)}</p>
            <p class="text-slate-500">${escapeHtml(modalidade)}</p>
          </div>
          ${
            ev.inscrito
              ? `<span class="bg-purple-100 text-[#5b21b6] font-bold px-2.5 py-1 rounded-full text-[11px] shrink-0">✓ Inscrito</span>`
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
  const paragraphs = String(ev.descricao || "")
    .split("\n\n")
    .filter(Boolean)
    .map(
      (p) => `<p class="text-xs text-slate-700 leading-relaxed text-justify">${escapeHtml(p)}</p>`
    )
    .join("");

  const container = document.getElementById("evento-detalhe-content");
  container.innerHTML = `
    <div class="text-center mb-4">
      <h2 class="text-xl font-bold text-[#5b21b6] leading-snug">${escapeHtml(ev.titulo)}</h2>
      <div class="w-56 h-px bg-[#7353ba] mx-auto my-3"></div>
      <p class="text-xs text-slate-700">${escapeHtml(ev.data)} - ${escapeHtml(ev.horario)}</p>
      <p class="text-xs text-slate-700">${escapeHtml(modalidade)}</p>
      <p class="text-xs text-slate-700 mt-0.5">Local: <span class="underline">${escapeHtml(ev.local)}</span></p>
    </div>

    <div class="my-4 overflow-hidden rounded-xl shadow border border-slate-200 max-w-md mx-auto">
      <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full aspect-[16/9] object-cover bg-slate-900" />
    </div>

    ${
      ev.precisaInscricao
        ? `<div class="text-center my-5">
            <button type="button" onclick="toggleInscricao(${ev.id})" class="pill-btn-purple px-10 py-2.5 text-xs font-semibold">
              ${ev.inscrito ? "✓ Inscrito (Cancelar)" : "Inscrever-se"}
            </button>
          </div>
          <div class="space-y-3 mt-3">${paragraphs}</div>`
        : `<div class="space-y-3 mt-4">${paragraphs}</div>
          <div class="text-center mt-5">
            <button type="button" onclick="mostrarAvisoSemInscricao()" class="pill-btn-purple px-10 py-2.5 text-xs font-semibold">
              Inscrever-se
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
    const res = await fetch(`/api/eventos/${eventoId}/inscricao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro na inscrição");
      if (res.status === 404 && String(data.message || "").includes("Sessão expirada")) {
        logout();
      }
      return;
    }

    showToast(data.message);
    await loadAppData();
    openEvento(eventoId);
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
    container.innerHTML = `<p class="text-center text-xs text-slate-500 py-4">Nenhum link cadastrado.</p>`;
    return;
  }

  container.innerHTML = appData.links
    .map(
      (link) => `
    <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
       class="flex items-center gap-3 bg-white border border-purple-200 rounded-md px-3 py-2.5 hover:bg-purple-50 transition">
      ${getSocialIconHtml(link.icone)}
      <span class="text-xs font-medium text-[#5b21b6] underline leading-snug">${escapeHtml(link.titulo)}</span>
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
    container.innerHTML = `<p class="text-center text-xs text-slate-500 py-8">Nenhum artigo disponível.</p>`;
    return;
  }

  container.innerHTML = appData.artigos
    .map(
      (art) => `
    <div onclick="openArtigo(${art.id})"
         class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 flex items-center justify-between gap-4 cursor-pointer hover:border-[#7353ba] transition">
      <div class="flex-1 text-center px-2">
        <h3 class="text-sm font-medium text-slate-700 leading-snug">${escapeHtml(art.titulo)}</h3>
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
      .map((item) => `<li class="text-xs text-slate-700 leading-relaxed">${escapeHtml(item)}</li>`)
      .join("");
    return `<ul class="list-disc pl-5 space-y-2 mb-4 text-left">${items}</ul>`;
  }

  const isHeading =
    trimmed.endsWith(":") ||
    trimmed === "Tratamentos" ||
    /^\d+\.\s/.test(trimmed);

  if (isHeading) {
    return `<p class="text-sm font-bold text-[#5b21b6] mt-4 mb-2 ${
      centerHeadings ? "text-center" : "text-left"
    }">${escapeHtml(trimmed)}</p>`;
  }

  return `<p class="text-xs text-slate-700 leading-relaxed mb-3 whitespace-pre-line text-left">${escapeHtml(trimmed)}</p>`;
}

function openArtigo(artigoId) {
  const art = appData.artigos.find((a) => a.id === artigoId);
  if (!art) return;

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
    <h2 class="text-center text-2xl font-bold text-[#5b21b6] mb-4 leading-tight">${escapeHtml(art.resumo || art.titulo)}</h2>
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
    container.innerHTML = `<p class="text-center text-xs text-slate-500 py-8">Nenhuma pergunta cadastrada.</p>`;
    return;
  }

  container.innerHTML = appData.faqs
    .map(
      (f) => `
    <div>
      <button type="button" onclick="toggleFaq(${f.id})"
              class="w-full py-2 text-left flex items-center justify-between gap-3 group">
        <span class="text-xs font-medium text-slate-700 group-hover:text-[#5b21b6] transition">${escapeHtml(f.pergunta)}</span>
        <svg id="faq-tri-${f.id}" viewBox="0 0 18 14" class="w-4 h-3.5 shrink-0 text-[#5b21b6] transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="1.6">
          <polygon points="2,2 16,2 9,12" stroke-linejoin="round" />
        </svg>
      </button>
      <div id="faq-ans-${f.id}" class="hidden mt-1.5 p-3 bg-white/75 border border-[#7353ba] rounded-sm text-xs text-slate-700 leading-relaxed">
        ${escapeHtml(f.resposta)}
      </div>
    </div>
  `
    )
    .join("");
}

function toggleFaq(id) {
  const ans = document.getElementById(`faq-ans-${id}`);
  const tri = document.getElementById(`faq-tri-${id}`);
  if (!ans) return;

  const isHidden = ans.classList.contains("hidden");
  ans.classList.toggle("hidden", !isHidden);
  if (tri) {
    tri.classList.toggle("rotate-180", isHidden);
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
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Idade</label>
          <input type="number" id="prof-idade" min="10" max="120" value="${currentUser.idade ?? ""}" placeholder="Sua idade" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Pessoa próxima com Alzheimer</label>
          <input type="text" id="prof-pessoa" value="${escapeHtml(currentUser.pessoaComAlzheimer || "")}" placeholder="Ex.: Minha mãe" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
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

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Cidade / Estado</label>
          <input type="text" id="prof-cidade" value="${escapeHtml(currentUser.cidade || "")}" placeholder="Ex.: Recife - PE" class="input-lilac w-full px-3.5 py-2.5 text-sm focus:outline-none" />
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
    return;
  }

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
      <div class="grid grid-cols-1 gap-2.5 text-xs">
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-500">Pessoa com Alzheimer</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.pessoaComAlzheimer || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-500">Parentesco / Vínculo</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.parentesco || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
          <span class="text-slate-500">Estágio aproximado</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.estagioDaDoenca || "Não informado")}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Cidade / Região</span>
          <span class="font-semibold text-slate-800 text-right">${escapeHtml(currentUser.cidade || "Não informado")}</span>
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

  const payload = {
    nome: document.getElementById("prof-nome").value.trim(),
    idade: document.getElementById("prof-idade").value,
    pessoaComAlzheimer: document.getElementById("prof-pessoa").value.trim(),
    parentesco: document.getElementById("prof-parentesco").value,
    estagioDaDoenca: document.getElementById("prof-estagio").value,
    cidade: document.getElementById("prof-cidade").value.trim(),
  };

  try {
    const res = await fetch(`/api/auth/user/${currentUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro ao salvar perfil.");
      return;
    }

    currentUser = data;
    localStorage.setItem("cuida_user", JSON.stringify(currentUser));
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

  const step2RequiredIds = ["reg-idade", "reg-pessoa", "reg-parentesco"];
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
  const idade = document.getElementById("reg-idade").value;
  const pessoaComAlzheimer = document.getElementById("reg-pessoa").value.trim();
  const parentesco = document.getElementById("reg-parentesco").value;
  const estagioDaDoenca = document.getElementById("reg-estagio").value;
  const cidade = document.getElementById("reg-cidade").value.trim();

  const btn = document.getElementById("btn-reg-submit");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Criando conta...";

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        email,
        senha,
        idade,
        pessoaComAlzheimer,
        parentesco,
        estagioDaDoenca,
        cidade,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro no cadastro");
      return;
    }

    currentUser = data;
    localStorage.setItem("cuida_user", JSON.stringify(data));
    document.getElementById("form-register").reset();
    setRegisterStep(1);
    updateHomeGreeting(data.nome);
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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Falha no login");
      return;
    }

    currentUser = data;
    localStorage.setItem("cuida_user", JSON.stringify(data));
    updateHomeGreeting(data.nome);
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

window.addEventListener("DOMContentLoaded", async () => {
  initViewMode();
  lucide.createIcons();
  const saved = localStorage.getItem("cuida_user");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const check = await fetch(`/api/auth/user/${parsed.id}`);
      if (!check.ok) {
        localStorage.removeItem("cuida_user");
        return;
      }
      currentUser = await check.json();
      localStorage.setItem("cuida_user", JSON.stringify(currentUser));
      updateHomeGreeting(currentUser.nome);
      await loadAppData();
      goHome();
    } catch {
      localStorage.removeItem("cuida_user");
    }
  }
});
