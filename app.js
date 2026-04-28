// ══════════════════════════════════════════════════════
//  app.js  —  Lógica principal de COLLAB (v2 corregido)
//  Vanilla JS + Firebase Auth + Firestore
// ══════════════════════════════════════════════════════

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, addDoc, getDoc,
  setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ══════════════════════════════ ESTADO GLOBAL
let currentUser      = null;
let currentIdeaId    = null;
let currentProjectId = null;
let pendingItemCol   = null;

// Listeners activos (para cancelarlos y evitar duplicados)
let unsubIdeas    = null;
let unsubProjects = null;
let unsubBoard    = {};

// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function showToast(msg, duration = 2500) {
  const toast = $("toast");
  $("toast-msg").textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add("hidden"), duration);
}

function showModal(id)  { $(id).classList.remove("hidden"); }
function hideModal(id)  { $(id).classList.add("hidden"); }

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"2-digit" })
       + " " + d.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function safeStr(v) {
  if (typeof v === "object") {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
}

// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    tab.classList.add("active");
    $(`auth-form-${tab.dataset.tab}`).classList.add("active");
    $("auth-error").classList.add("hidden");
  });
});

function showAuthError(msg) {
  const el = $("auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

$("btn-login").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  const pass  = $("login-password").value;
  if (!email || !pass) return showAuthError("Completa todos los campos.");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showAuthError(translateAuthError(e.code));
  }
});

$("login-password").addEventListener("keydown", e => {
  if (e.key === "Enter") $("btn-login").click();
});

$("btn-register").addEventListener("click", async () => {
  const name  = $("reg-name").value.trim();
  const email = $("reg-email").value.trim();
  const pass  = $("reg-password").value;
  if (!name || !email || !pass) return showAuthError("Completa todos los campos.");
  if (pass.length < 6) return showAuthError("La contraseña debe tener al menos 6 caracteres.");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, createdAt: serverTimestamp()
    });
  } catch (e) {
    showAuthError(translateAuthError(e.code));
  }
});

$("btn-logout").addEventListener("click", async () => {
  await signOut(auth);
});

function translateAuthError(code) {
  const map = {
    "auth/user-not-found":       "Usuario no encontrado.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/email-already-in-use": "Este email ya está registrado.",
    "auth/invalid-email":        "Email inválido.",
    "auth/weak-password":        "La contraseña es demasiado débil.",
    "auth/invalid-credential":   "Credenciales incorrectas.",
  };
  return map[code] || "Error: " + code;
}

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    $("auth-screen").classList.add("hidden");
    $("app").classList.remove("hidden");
    const name = user.displayName || user.email;
    $("user-name").textContent   = name;
    $("user-avatar").textContent = name.charAt(0).toUpperCase();
    showSection("ideas");
  } else {
    currentUser = null;
    $("auth-screen").classList.remove("hidden");
    $("app").classList.add("hidden");
  }
});

// ══════════════════════════════════════════════════
//  NAVEGACIÓN
// ══════════════════════════════════════════════════

function showSection(name) {
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.section === name);
  });
  document.querySelectorAll(".section").forEach(s => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });
  const target = $(`section-${name}`);
  target.classList.remove("hidden");
  target.classList.add("active");

  if (name === "ideas")    initIdeasSection();
  if (name === "projects") initProjectsSection();
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => showSection(btn.dataset.section));
});

// ══════════════════════════════════════════════════
//  SECCIÓN: IDEAS
// ══════════════════════════════════════════════════

function initIdeasSection() {
  showIdeasList();
  loadIdeas();
}

function showIdeasList() {
  $("ideas-list").classList.remove("hidden");
  $("btn-new-idea").classList.remove("hidden");
  $("idea-detail").classList.add("hidden");
  currentIdeaId = null;
  // Cancelar listeners del tablero
  Object.values(unsubBoard).forEach(fn => fn && fn());
  unsubBoard = {};
}

function loadIdeas() {
  if (unsubIdeas) { unsubIdeas(); unsubIdeas = null; }

  const q = query(collection(db, "ideas"), orderBy("createdAt", "desc"));
  unsubIdeas = onSnapshot(q, snapshot => {
    const container = $("ideas-list");
    container.innerHTML = "";
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <p>Sin ideas aún. ¡Crea la primera!</p>
        </div>`;
      return;
    }
    snapshot.forEach(docSnap => {
      container.appendChild(buildIdeaCard({ id: docSnap.id, ...docSnap.data() }));
    });
  }, err => {
    console.error("Error ideas:", err);
    showToast("Error al cargar ideas: " + err.message);
  });
}

function buildIdeaCard(idea) {
  const card = document.createElement("div");
  card.className = "idea-card";
  card.innerHTML = `
    <div class="idea-card-title">${escHtml(idea.title)}</div>
    <div class="idea-card-desc">${escHtml(idea.description || "Sin descripción")}</div>
    <div class="idea-card-meta">
      <span>${formatDate(idea.createdAt)}</span>
      <button class="idea-card-delete" title="Eliminar">×</button>
    </div>`;
  card.querySelector(".idea-card-delete").addEventListener("click", e => {
    e.stopPropagation();
    if (confirm("¿Eliminar esta idea?")) deleteIdea(idea.id);
  });
  card.addEventListener("click", () => openIdea(idea.id));
  return card;
}

async function deleteIdea(id) {
  await deleteDoc(doc(db, "ideas", id));
  showToast("Idea eliminada");
}

$("btn-new-idea").addEventListener("click", () => {
  $("new-idea-title").value = "";
  $("new-idea-desc").value  = "";
  showModal("modal-new-idea");
  setTimeout(() => $("new-idea-title").focus(), 100);
});

$("cancel-new-idea").addEventListener("click", () => hideModal("modal-new-idea"));

$("confirm-new-idea").addEventListener("click", async () => {
  const title = $("new-idea-title").value.trim();
  const desc  = $("new-idea-desc").value.trim();
  if (!title) { $("new-idea-title").focus(); return; }
  try {
    await addDoc(collection(db, "ideas"), {
      title, description: desc,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
    hideModal("modal-new-idea");
    showToast("💡 Idea creada");
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
});

$("new-idea-title").addEventListener("keydown", e => {
  if (e.key === "Enter") $("confirm-new-idea").click();
});

async function openIdea(ideaId) {
  try {
    const snap = await getDoc(doc(db, "ideas", ideaId));
    if (!snap.exists()) return;
    const idea = snap.data();
    currentIdeaId = ideaId;

    $("ideas-list").classList.add("hidden");
    $("btn-new-idea").classList.add("hidden");
    $("idea-detail").classList.remove("hidden");
    $("idea-detail-title").textContent = idea.title || "";
    $("idea-detail-desc").textContent  = idea.description || "";

    loadBoardItems(ideaId);
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
}

$("btn-back-ideas").addEventListener("click", () => showIdeasList());

$("btn-save-idea-meta").addEventListener("click", async () => {
  if (!currentIdeaId) return;
  try {
    await updateDoc(doc(db, "ideas", currentIdeaId), {
      title:       $("idea-detail-title").textContent.trim(),
      description: $("idea-detail-desc").textContent.trim()
    });
    showToast("✓ Guardado");
  } catch(e) {
    showToast("Error: " + e.message);
  }
});

// ── Tablero

function loadBoardItems(ideaId) {
  Object.values(unsubBoard).forEach(fn => fn && fn());
  unsubBoard = {};

  ["ventajas","desventajas","problemas"].forEach(col => {
    const container = $(`col-${col}`);
    container.innerHTML = "";
    const q = query(collection(db, "ideas", ideaId, col), orderBy("createdAt", "asc"));
    unsubBoard[col] = onSnapshot(q, snap => {
      container.innerHTML = "";
      snap.forEach(d => container.appendChild(buildBoardItem(col, { id: d.id, ...d.data() })));
    }, err => console.error(`Error col ${col}:`, err));
  });
}

function buildBoardItem(col, item) {
  const div = document.createElement("div");
  div.className = "board-item";
  div.innerHTML = `
    <div class="board-item-text" contenteditable="true">${escHtml(item.text)}</div>
    <div class="board-item-actions">
      <button class="item-btn save-item" title="Guardar">✓</button>
      <button class="item-btn del" title="Eliminar">✕</button>
    </div>`;
  div.querySelector(".save-item").addEventListener("click", async () => {
    const text = div.querySelector(".board-item-text").textContent.trim();
    if (!text || !currentIdeaId) return;
    try {
      await updateDoc(doc(db, "ideas", currentIdeaId, col, item.id), { text });
      showToast("✓ Guardado");
    } catch(e) { showToast("Error: " + e.message); }
  });
  div.querySelector(".del").addEventListener("click", async () => {
    if (!currentIdeaId) return;
    await deleteDoc(doc(db, "ideas", currentIdeaId, col, item.id));
  });
  return div;
}

document.querySelectorAll(".btn-add-item").forEach(btn => {
  btn.addEventListener("click", () => {
    pendingItemCol = btn.dataset.col;
    $("modal-item-title").textContent = "Agregar a " + pendingItemCol;
    $("new-item-text").value = "";
    showModal("modal-new-item");
    setTimeout(() => $("new-item-text").focus(), 100);
  });
});

$("cancel-new-item").addEventListener("click", () => {
  hideModal("modal-new-item");
  pendingItemCol = null;
});

$("confirm-new-item").addEventListener("click", async () => {
  const text = $("new-item-text").value.trim();
  if (!text || !pendingItemCol || !currentIdeaId) return;
  try {
    await addDoc(collection(db, "ideas", currentIdeaId, pendingItemCol), {
      text, createdBy: currentUser.uid, createdAt: serverTimestamp()
    });
    hideModal("modal-new-item");
    pendingItemCol = null;
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
});

$("new-item-text").addEventListener("keydown", e => {
  if (e.key === "Enter") $("confirm-new-item").click();
});

// ══════════════════════════════════════════════════
//  SECCIÓN: PROYECTOS
// ══════════════════════════════════════════════════

function initProjectsSection() {
  showProjectsList();
  loadProjects();
}

function showProjectsList() {
  $("projects-list").classList.remove("hidden");
  $("btn-new-project").classList.remove("hidden");
  $("project-detail").classList.add("hidden");
  currentProjectId = null;
}

function loadProjects() {
  if (unsubProjects) { unsubProjects(); unsubProjects = null; }

  const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
  unsubProjects = onSnapshot(q, snap => {
    const container = $("projects-list");
    container.innerHTML = "";
    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚡</div>
          <p>Sin proyectos. ¡Crea el primero!</p>
        </div>`;
      return;
    }
    snap.forEach(d => container.appendChild(buildProjectCard({ id: d.id, ...d.data() })));
  }, err => {
    console.error("Error proyectos:", err);
    showToast("Error al cargar proyectos: " + err.message);
  });
}

function buildProjectCard(project) {
  const card = document.createElement("div");
  card.className = "project-card";
  card.innerHTML = `
    <div class="project-card-title">${escHtml(project.name)}</div>
    <div class="project-card-desc">${escHtml(project.description || "Sin descripción")}</div>
    <div class="project-card-meta">
      <span>${formatDate(project.updatedAt || project.createdAt)}</span>
      <button class="project-card-delete" title="Eliminar">×</button>
    </div>`;
  card.querySelector(".project-card-delete").addEventListener("click", e => {
    e.stopPropagation();
    if (confirm("¿Eliminar este proyecto?")) deleteProject(project.id);
  });
  card.addEventListener("click", () => openProject(project.id));
  return card;
}

async function deleteProject(id) {
  await deleteDoc(doc(db, "projects", id));
  showToast("Proyecto eliminado");
}

$("btn-new-project").addEventListener("click", () => {
  $("new-project-name").value = "";
  $("new-project-desc").value = "";
  showModal("modal-new-project");
  setTimeout(() => $("new-project-name").focus(), 100);
});

$("cancel-new-project").addEventListener("click", () => hideModal("modal-new-project"));

$("confirm-new-project").addEventListener("click", async () => {
  const name = $("new-project-name").value.trim();
  const desc = $("new-project-desc").value.trim();
  if (!name) { $("new-project-name").focus(); return; }
  try {
    const ref = await addDoc(collection(db, "projects"), {
      name, description: desc,
      code: "// Escribe tu código aquí\nconsole.log('Hola, mundo!');",
      history: [],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    hideModal("modal-new-project");
    showToast("⚡ Proyecto creado");
    openProject(ref.id);
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
});

$("new-project-name").addEventListener("keydown", e => {
  if (e.key === "Enter") $("confirm-new-project").click();
});

async function openProject(projectId) {
  try {
    const snap = await getDoc(doc(db, "projects", projectId));
    if (!snap.exists()) return;
    const proj = snap.data();
    currentProjectId = projectId;

    $("projects-list").classList.add("hidden");
    $("btn-new-project").classList.add("hidden");
    $("project-detail").classList.remove("hidden");
    $("project-detail-title").textContent = proj.name || "";
    $("project-detail-desc").textContent  = proj.description || "";
    $("code-editor").value = proj.code || "";
    $("code-output").innerHTML = "";
    renderHistory(proj.history || []);
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
}

$("btn-back-projects").addEventListener("click", () => showProjectsList());

$("btn-save-project").addEventListener("click", async () => {
  if (!currentProjectId) return;
  const code  = $("code-editor").value;
  const title = $("project-detail-title").textContent.trim();
  const desc  = $("project-detail-desc").textContent.trim();
  try {
    const snap = await getDoc(doc(db, "projects", currentProjectId));
    const proj = snap.data();
    const history = proj.history || [];
    history.unshift({
      code: proj.code || "",
      savedAt: new Date().toISOString(),
      savedBy: currentUser.displayName || currentUser.email
    });
    if (history.length > 10) history.splice(10);
    await updateDoc(doc(db, "projects", currentProjectId), {
      name: title, description: desc, code, history,
      updatedAt: serverTimestamp()
    });
    renderHistory(history);
    showToast("✓ Proyecto guardado");
  } catch(e) {
    showToast("Error: " + e.message);
    console.error(e);
  }
});

function renderHistory(history) {
  const container = $("save-history");
  container.innerHTML = "";
  if (!history.length) {
    container.innerHTML = `<span style="color:var(--text3);font-size:12px;">Sin guardados aún</span>`;
    return;
  }
  history.slice(0, 5).forEach((entry, i) => {
    const div = document.createElement("div");
    div.className = "history-entry";
    const d = new Date(entry.savedAt);
    const label = d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit" })
                + " " + d.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
    div.innerHTML = `
      <span>#${i+1} — ${label} por ${escHtml(entry.savedBy || "anon")}</span>
      <button class="history-restore">Restaurar</button>`;
    div.querySelector(".history-restore").addEventListener("click", () => {
      $("code-editor").value = entry.code;
      showToast("Versión restaurada (guarda para confirmar)");
    });
    container.appendChild(div);
  });
}

// ── Ejecutar código

$("btn-run-code").addEventListener("click", () => {
  const code   = $("code-editor").value;
  const output = $("code-output");
  output.innerHTML = "";
  const logs = [];
  const proxy = {
    log:   (...args) => logs.push({ type:"log",   msg: args.map(safeStr).join(" ") }),
    error: (...args) => logs.push({ type:"error", msg: args.map(safeStr).join(" ") }),
    warn:  (...args) => logs.push({ type:"warn",  msg: args.map(safeStr).join(" ") }),
    info:  (...args) => logs.push({ type:"info",  msg: args.map(safeStr).join(" ") }),
  };
  try {
    new Function("console", code)(proxy);
  } catch (e) {
    logs.push({ type:"error", msg: e.toString() });
  }
  if (!logs.length) {
    output.innerHTML = `<div class="output-line" style="color:var(--text3)">// Sin salida</div>`;
  } else {
    logs.forEach(l => {
      const line = document.createElement("div");
      line.className = `output-line ${l.type}`;
      line.textContent = l.msg;
      output.appendChild(line);
    });
  }
});

$("btn-clear-output").addEventListener("click", () => { $("code-output").innerHTML = ""; });

$("code-editor").addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("btn-run-code").click();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const el = e.target;
    const s  = el.selectionStart;
    el.value = el.value.substring(0, s) + "  " + el.value.substring(el.selectionEnd);
    el.selectionStart = el.selectionEnd = s + 2;
  }
});

// Cerrar modales clickeando fuera
["modal-new-idea","modal-new-project","modal-new-item"].forEach(id => {
  $(id).addEventListener("click", e => { if (e.target === $(id)) hideModal(id); });
});