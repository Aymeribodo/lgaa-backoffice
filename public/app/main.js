import { api } from "./api.js";
import {
  hashForObject,
  hashForPipeline,
  parseRoute
} from "./router.js";
import { renderObjectDetail } from "./views/object-detail.js";
import { renderPipeline } from "./views/pipeline.js";
import { renderQuickCreate } from "./views/quick-create.js";
import { renderSearch } from "./views/search.js";

const root = document.querySelector("#app");
const statusBar = document.querySelector("#status-bar");
const navigationLinks = Array.from(document.querySelectorAll("[data-nav]"));
const jumpForm = document.querySelector("#jump-form");

const state = {
  channels: null
};

function setStatus(message, tone = "info") {
  if (!statusBar) {
    return;
  }

  if (!message) {
    statusBar.hidden = true;
    statusBar.textContent = "";
    statusBar.className = "status-bar";
    return;
  }

  statusBar.hidden = false;
  statusBar.textContent = message;
  statusBar.className = `status-bar status-bar--${tone}`;
}

async function getChannels(force = false) {
  if (!force && state.channels) {
    return state.channels;
  }

  state.channels = await api.listChannels(false);
  return state.channels;
}

function setActiveNavigation(routeName) {
  for (const link of navigationLinks) {
    link.classList.toggle("is-active", link.dataset.nav === routeName);
  }
}

const context = {
  api,
  root,
  setStatus,
  getChannels,
  navigate(hash) {
    window.location.hash = hash;
  },
  refresh() {
    return renderApp();
  }
};

async function renderApp() {
  const route = parseRoute();
  const activeNav = route.name === "object-detail" ? "" : route.name;

  setActiveNavigation(activeNav);

  try {
    if (route.name === "pipeline") {
      await renderPipeline(context, route);
      return;
    }

    if (route.name === "quick-create") {
      await renderQuickCreate(context, route);
      return;
    }

    if (route.name === "search") {
      await renderSearch(context, route);
      return;
    }

    if (route.name === "object-detail") {
      await renderObjectDetail(context, route);
      return;
    }

    window.location.hash = hashForPipeline();
  } catch (error) {
    setStatus(error.message ?? "Erreur de chargement.", "error");
    root.innerHTML = `
      <div class="empty-state">
        <strong>Impossible d'afficher cette vue</strong>
        <p>${error.message ?? "Erreur inconnue."}</p>
      </div>
    `;
  }
}

jumpForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const input = jumpForm.querySelector("input[name='objectId']");
  const objectId = String(input?.value ?? "").trim();

  if (!objectId) {
    setStatus("Saisis un identifiant objet.", "error");
    return;
  }

  setStatus("");
  window.location.hash = hashForObject(objectId);
});

window.addEventListener("hashchange", () => {
  void renderApp();
});

if (!window.location.hash) {
  window.location.hash = hashForPipeline();
} else {
  void renderApp();
}
