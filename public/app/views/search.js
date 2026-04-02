import {
  AUDIT_PRESET_OPTIONS,
  renderEmptyState,
  renderObjectCard
} from "../components.js";
import { hashForSearch } from "../router.js";

async function bindStatusForms(container, context) {
  const forms = Array.from(container.querySelectorAll(".js-status-form"));

  for (const form of forms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const objectId = form.dataset.objectId;
      const select = form.querySelector("select");
      const button = form.querySelector("button");

      if (!objectId || !(select instanceof HTMLSelectElement)) {
        return;
      }

      button?.setAttribute("disabled", "disabled");

      try {
        await context.api.changeObjectStatus(objectId, {
          workflowStatus: select.value
        });
        context.setStatus(`Statut mis a jour pour ${objectId}.`, "success");
        await context.refresh();
      } catch (error) {
        context.setStatus(error.message, "error");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  }
}

export async function renderSearch(context, route) {
  const filters = {
    q: route.query.q ?? "",
    noteRapide: route.query.noteRapide ?? "",
    titreInterne: route.query.titreInterne ?? "",
    categorieInterne: route.query.categorieInterne ?? "",
    typeObjet: route.query.typeObjet ?? "",
    channelId: route.query.channelId ?? "",
    channelStatus: route.query.channelStatus ?? "",
    workflowStatus: route.query.workflowStatus ?? "",
    stockStatus: route.query.stockStatus ?? "",
    auditPreset: route.query.auditPreset ?? ""
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const [results, channels, problemObjects, readyUnpublishedObjects, soldUnpaidObjects] =
    await Promise.all([
      hasFilters ? context.api.listObjects(filters) : Promise.resolve([]),
      context.getChannels(),
      context.api.listObjects({ auditPreset: "PROBLEM" }),
      context.api.listObjects({ auditPreset: "READY_UNPUBLISHED" }),
      context.api.listObjects({ auditPreset: "SOLD_UNPAID" })
    ]);

  context.root.innerHTML = `
    <section class="page-head">
      <div>
        <h2>Recherche et filtres</h2>
        <p>Recherche large sur l'objet central, avec vues d'audit et filtres metier.</p>
      </div>
    </section>

    <section class="panel">
      <div class="page-head">
        <div>
          <h3>Files d'audit</h3>
          <p>Acces direct aux objets a traiter en priorite.</p>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <a class="metric" href="${hashForSearch({ auditPreset: "PROBLEM" })}">
          <p class="metric__label">Objets en probleme</p>
          <p class="metric__value">${problemObjects.length}</p>
        </a>
        <a class="metric" href="${hashForSearch({ auditPreset: "READY_UNPUBLISHED" })}">
          <p class="metric__label">Prets non publies</p>
          <p class="metric__value">${readyUnpublishedObjects.length}</p>
        </a>
        <a class="metric" href="${hashForSearch({ auditPreset: "SOLD_UNPAID" })}">
          <p class="metric__label">Vendus non payes</p>
          <p class="metric__value">${soldUnpaidObjects.length}</p>
        </a>
      </div>
    </section>

    <section class="panel">
      <form id="search-form" class="form-grid form-grid--two">
        <div class="field">
          <label for="search-q">Recherche globale</label>
          <input id="search-q" name="q" type="text" value="${filters.q}" placeholder="LGAA-000001, Sony, lot de 3..." />
        </div>

        <div class="field">
          <label for="search-note">Filtre note rapide</label>
          <input id="search-note" name="noteRapide" type="text" value="${filters.noteRapide}" placeholder="sans telecommande" />
        </div>

        <div class="field">
          <label for="search-title">Titre interne</label>
          <input id="search-title" name="titreInterne" type="text" value="${filters.titreInterne}" placeholder="Lecteur cassette Sony" />
        </div>

        <div class="field">
          <label for="search-category">Categorie interne</label>
          <input id="search-category" name="categorieInterne" type="text" value="${filters.categorieInterne}" placeholder="Audio, BD..." />
        </div>

        <div class="field">
          <label for="search-type">Type objet</label>
          <input id="search-type" name="typeObjet" type="text" value="${filters.typeObjet}" placeholder="BD, console, lampe..." />
        </div>

        <div class="field">
          <label for="search-channel">Canal</label>
          <select id="search-channel" name="channelId">
            <option value="">Tous</option>
            ${channels
              .map(
                (channel) => `
                  <option value="${channel.channelId}" ${
                    filters.channelId === channel.channelId ? "selected" : ""
                  }>
                    ${channel.name}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>

        <div class="field">
          <label for="search-channel-status">Statut canal</label>
          <input id="search-channel-status" name="channelStatus" type="text" value="${filters.channelStatus}" placeholder="DRAFT, PUBLISHED..." />
        </div>

        <div class="field">
          <label for="search-workflow">Workflow</label>
          <select id="search-workflow" name="workflowStatus">
            <option value="">Tous</option>
            <option value="BROUILLON" ${filters.workflowStatus === "BROUILLON" ? "selected" : ""}>Nouveaux</option>
            <option value="IA_GENERE" ${filters.workflowStatus === "IA_GENERE" ? "selected" : ""}>IA genere</option>
            <option value="A_VERIFIER" ${filters.workflowStatus === "A_VERIFIER" ? "selected" : ""}>A verifier</option>
            <option value="PRET" ${filters.workflowStatus === "PRET" ? "selected" : ""}>Pret</option>
            <option value="PUBLIE" ${filters.workflowStatus === "PUBLIE" ? "selected" : ""}>Publie</option>
            <option value="VENDU" ${filters.workflowStatus === "VENDU" ? "selected" : ""}>Vendu</option>
            <option value="PAYE" ${filters.workflowStatus === "PAYE" ? "selected" : ""}>Paye</option>
            <option value="PROBLEME" ${filters.workflowStatus === "PROBLEME" ? "selected" : ""}>Probleme</option>
            <option value="ARCHIVE" ${filters.workflowStatus === "ARCHIVE" ? "selected" : ""}>Archive</option>
          </select>
        </div>

        <div class="field">
          <label for="search-stock">Stock</label>
          <input id="search-stock" name="stockStatus" type="text" value="${filters.stockStatus}" placeholder="IN_STOCK" />
        </div>

        <div class="field">
          <label for="search-audit-preset">Vue d'audit</label>
          <select id="search-audit-preset" name="auditPreset">
            <option value="">Aucune</option>
            ${AUDIT_PRESET_OPTIONS.map(
              (option) => `
                <option value="${option.value}" ${
                  filters.auditPreset === option.value ? "selected" : ""
                }>
                  ${option.label}
                </option>
              `
            ).join("")}
          </select>
        </div>

        <div class="inline-actions">
          <button type="submit" class="button button--primary">Rechercher</button>
          <a class="button button--secondary" href="${hashForSearch()}">Effacer</a>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="page-head">
        <div>
          <h3>Resultats</h3>
          <p>${hasFilters ? `${results.length} objet(s) trouves.` : "Aucun filtre applique pour le moment."}</p>
        </div>
      </div>

      <div class="results-list">
        ${
          hasFilters
            ? results.length > 0
              ? results.map((object) => renderObjectCard(object)).join("")
              : renderEmptyState("Aucun resultat", "Aucun objet ne correspond a ces filtres.")
            : renderEmptyState("Lancer une recherche", "Utilise un ou plusieurs filtres pour afficher les objets.")
        }
      </div>
    </section>
  `;

  const form = context.root.querySelector("#search-form");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    context.navigate(
      hashForSearch({
        q: String(formData.get("q") ?? "").trim(),
        noteRapide: String(formData.get("noteRapide") ?? "").trim(),
        titreInterne: String(formData.get("titreInterne") ?? "").trim(),
        categorieInterne: String(formData.get("categorieInterne") ?? "").trim(),
        typeObjet: String(formData.get("typeObjet") ?? "").trim(),
        channelId: String(formData.get("channelId") ?? "").trim(),
        channelStatus: String(formData.get("channelStatus") ?? "").trim(),
        workflowStatus: String(formData.get("workflowStatus") ?? "").trim(),
        stockStatus: String(formData.get("stockStatus") ?? "").trim(),
        auditPreset: String(formData.get("auditPreset") ?? "").trim()
      })
    );
  });

  await bindStatusForms(context.root, context);
}
