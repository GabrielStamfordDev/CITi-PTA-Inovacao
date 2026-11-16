let currentUser = null;
let appData = {
  eventos: [],
  links: [],
  artigos: [],
  faqs: [],
};
let navHistory = [];

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

function navigate(screenId, pushHistory = true) {
  fecharAvisoSemInscricao();

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
  localStorage.removeItem("cuida_user");
  navHistory = [];
  navigate("screen-welcome", false);
}

function preencherDemoLogin() {
  document.getElementById("login-email").value = "maria@cuida.com";
  document.getElementById("login-senha").value = "123456";
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
    bannerUrl: ev.imagem || (isOnline ? "/assets/evento-webinario.svg" : "/assets/evento-simposio.svg"),
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
        <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full h-36 object-cover bg-slate-900" />
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

    <div class="my-4 overflow-hidden rounded-xl shadow border border-slate-200">
      <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(ev.titulo)}" class="w-full h-40 object-cover bg-slate-900" />
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
// 2. LINKS DE APOIO (Frame 00:17)
// ==================================================
function getSocialIconHtml(icone) {
  if (icone === "instagram") {
    return `<div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center shrink-0">
      <i data-lucide="instagram" class="w-4 h-4"></i>
    </div>`;
  }
  if (icone === "whatsapp") {
    return `<div class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
      <i data-lucide="message-circle" class="w-4 h-4"></i>
    </div>`;
  }
  return `<div class="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">
    f
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
  lucide.createIcons();
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
    // Frame 00:22-00:23: sem imagem na tela interna, subtítulos centralizados e bullets
    bodyHtml = blocosRaw
      .map((bloco) => formatArtigoBlock(bloco, { centerHeadings: true }))
      .join("");
  } else if (art.slug === "orientacoes-alimentacao" && blocosRaw.length > 0) {
    // Frame 00:28: parágrafo introdutório acima da imagem circular
    const [intro, ...rest] = blocosRaw;
    bodyHtml =
      formatArtigoBlock(intro) +
      imgHtml +
      rest.map((bloco) => formatArtigoBlock(bloco)).join("");
  } else {
    // Frame 00:25 e demais artigos: imagem circular logo abaixo do título
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
      <!-- Clicável tanto na pergunta quanto no triângulo, conforme teste de usabilidade -->
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
// AUTENTICAÇÃO
// ==================================================
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

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("reg-nome").value;
  const email = document.getElementById("reg-email").value;
  const senha = document.getElementById("reg-senha").value;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro no cadastro");
      return;
    }

    currentUser = data;
    localStorage.setItem("cuida_user", JSON.stringify(data));
    updateHomeGreeting(data.nome);
    showToast("Cadastro realizado!");
    await loadAppData();
    goHome();
  } catch (err) {
    showToast("Erro ao criar conta.");
  }
});

document.getElementById("form-recover").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("rec-email").value;
  const novaSenha = document.getElementById("rec-senha").value;

  try {
    const res = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, novaSenha }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || "Erro ao redefinir senha");
      return;
    }

    showToast("Senha atualizada com sucesso!");
    navigate("screen-login", false);
  } catch (err) {
    showToast("Erro ao conectar ao servidor.");
  }
});

window.addEventListener("DOMContentLoaded", async () => {
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
