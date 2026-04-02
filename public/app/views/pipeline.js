import {
  PIPELINE_COLUMNS,
  renderEmptyState,
  renderObjectCard
} from "../components.js";

async function handleStatusForms(container, context) {
  const forms = Array.from(container.querySelectorAll(".js-status-form"));

  for (const form of forms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const button = form.querySelector("button");
      const select = form.querySelector("select");
      const objectId = form.dataset.objectId;

      if (!objectId || !select || !(select instanceof HTMLSelectElement)) {
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

export async function renderPipeline(context) {
  context.root.innerHTML = `<div class="loading">Chargement du pipeline...</div>`;

  const columns = await Promise.all(
    PIPELINE_COLUMNS.map(async (column) => ({
      ...column,
      objects: await context.api.listObjects({ workflowStatus: column.status })
    }))
  );
  const total = columns.reduce((count, column) => count + column.objects.length, 0);

  context.root.innerHTML = `
    <section class="page-head">
      <div>
        <h2>Pipeline visuel</h2>
        <p>Vue rapide par statut avec changement d'etat en quelques clics.</p>
      </div>
      <div class="key-metrics">
        <article class="metric">
          <p class="metric__label">Objets visibles</p>
          <p class="metric__value">${total}</p>
        </article>
        <article class="metric">
          <p class="metric__label">Colonnes</p>
          <p class="metric__value">${columns.length}</p>
        </article>
      </div>
    </section>

    <section class="pipeline-board">
      ${columns
        .map(
          (column) => `
            <section class="column">
              <div class="column__head">
                <h3>${column.label}</h3>
                <span class="column__count">${column.objects.length}</span>
              </div>
              <div class="stack">
                ${
                  column.objects.length > 0
                    ? column.objects.map((object) => renderObjectCard(object)).join("")
                    : renderEmptyState(
                        "Aucun objet",
                        "Cette colonne est vide pour le moment."
                      )
                }
              </div>
            </section>
          `
        )
        .join("")}
    </section>
  `;

  await handleStatusForms(context.root, context);
}
