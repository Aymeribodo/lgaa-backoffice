import {
  asNullableInteger,
  asNullableText,
  asNullableUrl,
  escapeHtml,
  formatDateTime,
  formatMoneyCents,
  parseCommaList,
  photoAssetUrl,
  renderEmptyState,
  renderWorkflowSelect,
  historySourceBadgeClass,
  workflowBadgeClass,
  workflowLabel
} from "../components.js";
import { hashForObject, hashForPipeline } from "../router.js";

function fieldValue(value) {
  return value ?? "";
}

function getApplicableAiFields(output) {
  if (!output) {
    return [];
  }

  const fields = [];

  if (output.titreSuggere !== null) {
    fields.push("titreInterne");
  }

  if (output.descriptionSuggeree !== null) {
    fields.push("descriptionInterne");
  }

  if (output.categorieSuggeree !== null) {
    fields.push("categorieInterne");
  }

  if (output.etatSuggere !== null) {
    fields.push("etat");
  }

  if (output.prixSuggere !== null) {
    fields.push("prixReference");
  }

  return fields;
}

function getApplicableAiFieldLabels(output) {
  return getApplicableAiFields(output).map((field) => {
    switch (field) {
      case "titreInterne":
        return "titre";
      case "descriptionInterne":
        return "description";
      case "categorieInterne":
        return "categorie";
      case "etat":
        return "etat";
      case "prixReference":
        return "prix reference";
      default:
        return field;
    }
  });
}

function renderAiCard(generation) {
  const output = generation.output;
  const applicableFieldLabels = getApplicableAiFieldLabels(output);
  const canApply =
    generation.generationStatus === "COMPLETED" &&
    output &&
    applicableFieldLabels.length > 0;

  return `
    <article class="ai-card">
      <div class="ai-card__head">
        <div>
          <h4>Tentative ${generation.attemptNumber}</h4>
          <p class="subtle-text">
            ${escapeHtml(generation.triggerType)} - ${escapeHtml(generation.generationStatus)} - ${escapeHtml(formatDateTime(generation.createdAt))}
          </p>
        </div>
        <span class="status-badge status-badge--${generation.generationStatus === "COMPLETED" ? "ready" : generation.generationStatus === "FAILED" ? "review" : "draft"}">
          ${escapeHtml(generation.generationStatus)}
        </span>
      </div>

      ${
        output
          ? `
            <div class="details-grid">
              <div class="detail-box">
                <p class="detail-box__label">Titre suggere</p>
                <p class="detail-box__value">${escapeHtml(output.titreSuggere ?? "Non defini")}</p>
              </div>
              <div class="detail-box">
                <p class="detail-box__label">Categorie suggeree</p>
                <p class="detail-box__value">${escapeHtml(output.categorieSuggeree ?? "Non definie")}</p>
              </div>
              <div class="detail-box">
                <p class="detail-box__label">Etat suggere</p>
                <p class="detail-box__value">${escapeHtml(output.etatSuggere ?? "Non defini")}</p>
              </div>
              <div class="detail-box">
                <p class="detail-box__label">Prix suggere</p>
                <p class="detail-box__value">${escapeHtml(formatMoneyCents(output.prixSuggere))}</p>
              </div>
              <div class="detail-box">
                <p class="detail-box__label">Confiance finale</p>
                <p class="detail-box__value">${escapeHtml(String(output.confiance ?? generation.confidence ?? "-"))}</p>
              </div>
              <div class="detail-box">
                <p class="detail-box__label">Hashtags</p>
                <p class="detail-box__value">${escapeHtml(output.hashtagsSuggeres.join(", ") || "Aucun")}</p>
              </div>
            </div>

            <div class="panel" style="margin-top: 12px; padding: 14px;">
              <h5 style="margin: 0 0 8px;">Description suggeree</h5>
              <p style="margin: 0;">${escapeHtml(output.descriptionSuggeree ?? "Non definie")}</p>
            </div>

            <div class="inline-actions" style="margin-top: 12px;">
              ${
                canApply
                  ? `
                    <button
                      type="button"
                      class="button button--secondary"
                      data-ai-action="apply"
                      data-ai-generation-id="${escapeHtml(generation.generationId)}"
                    >
                      Appliquer a la fiche
                    </button>
                  `
                  : ""
              }
              ${
                applicableFieldLabels.length > 0
                  ? `
                    <span class="subtle-text">
                      Champs applicables : ${escapeHtml(applicableFieldLabels.join(", "))}
                    </span>
                  `
                  : `
                    <span class="subtle-text">
                      Aucun champ directement applicable sur la fiche centrale.
                    </span>
                  `
              }
            </div>

            ${
              output.hashtagsSuggeres.length > 0
                ? `
                  <p class="subtle-text" style="margin: 10px 0 0;">
                    Les hashtags restent dans la proposition IA et ne sont pas appliques a la fiche centrale.
                  </p>
                `
                : ""
            }

            ${
              output.elementsIncertains.length > 0
                ? `
                  <div class="panel" style="margin-top: 12px; padding: 14px;">
                    <h5 style="margin: 0 0 8px;">Elements incertains</h5>
                    <ul class="bullet-list">
                      ${output.elementsIncertains
                        .map(
                          (item) => `
                            <li><strong>${escapeHtml(item.champ)}</strong> : ${escapeHtml(item.raison)}</li>
                          `
                        )
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
          `
          : `
            <p class="subtle-text">
              ${escapeHtml(generation.errorMessage ?? "Aucune sortie exploitable.")}
            </p>
          `
      }
    </article>
  `;
}

function renderHistoryItem(event, canRollback) {
  const payloadText = JSON.stringify(event.payload, null, 2);

  return `
    <article class="history-item">
      <div class="history-item__head">
        <div>
          <h4>${escapeHtml(event.summary ?? event.eventType)}</h4>
          <p class="subtle-text">
            ${escapeHtml(event.createdAt ? formatDateTime(event.createdAt) : "")}
          </p>
        </div>
        <div class="photo-card__meta">
          <span class="status-badge status-badge--${historySourceBadgeClass(event.sourceType)}">
            ${escapeHtml(event.sourceType)}
          </span>
          <span class="chip">${escapeHtml(event.entityType)}</span>
          <span class="chip mono">${escapeHtml(event.eventType)}</span>
        </div>
      </div>

      <details>
        <summary class="subtle-text">Voir le detail</summary>
        <pre class="mono" style="white-space: pre-wrap; margin: 10px 0 0;">${escapeHtml(payloadText)}</pre>
      </details>

      ${
        canRollback
          ? `
            <div class="inline-actions" style="margin-top: 12px;">
              <button
                type="button"
                class="button button--danger button--small"
                data-history-action="rollback"
                data-history-event-id="${escapeHtml(event.id)}"
              >
                Rollback
              </button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderPhotoCard(_objectId, photo, index, photoCount) {
  const imageUrl = photoAssetUrl(photo, "thumbnail");

  return `
    <article class="photo-card">
      <img
        src="${escapeHtml(imageUrl ?? "")}"
        alt="Photo ${escapeHtml(photo.photoId)}"
        loading="lazy"
      />
      <div class="photo-card__body">
        <div class="photo-card__meta">
          <span class="chip mono">${escapeHtml(photo.photoId)}</span>
          <span class="chip">#${photo.position}</span>
          ${photo.isMain ? `<span class="status-badge status-badge--ready">Principale</span>` : ""}
        </div>

        <span class="subtle-text">
          ${escapeHtml(photo.originalFilename ?? photo.storedFilename ?? "Photo")}
        </span>

        <div class="photo-card__actions">
          ${
            photo.isMain
              ? ""
              : `<button class="button button--small" data-photo-action="main" data-photo-id="${escapeHtml(photo.photoId)}">Definir principale</button>`
          }
          <button
            class="button button--secondary button--small"
            data-photo-action="move-left"
            data-photo-index="${index}"
            ${index === 0 ? "disabled" : ""}
          >
            Gauche
          </button>
          <button
            class="button button--secondary button--small"
            data-photo-action="move-right"
            data-photo-index="${index}"
            ${index === photoCount - 1 ? "disabled" : ""}
          >
            Droite
          </button>
          <button class="button button--danger button--small" data-photo-action="delete" data-photo-id="${escapeHtml(photo.photoId)}">
            Supprimer
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderPublicationCard(publication, channels) {
  const channel = channels.find((item) => item.channelId === publication.channelId);

  return `
    <article class="publication-card">
      <div class="publication-card__head">
        <div>
          <h4>${escapeHtml(channel?.name ?? publication.channelId)}</h4>
          <div class="photo-card__meta" style="margin-top: 8px;">
            <span class="chip mono">${escapeHtml(publication.publicationId)}</span>
            <span class="chip">Canal ${escapeHtml(channel?.code ?? "-")}</span>
            ${
              publication.channelListingId
                ? `<span class="chip mono">Externe ${escapeHtml(publication.channelListingId)}</span>`
                : `<span class="chip">ID canal non renseigne</span>`
            }
          </div>
        </div>
        <span class="chip">${escapeHtml(publication.channelStatus)}</span>
      </div>

      <form class="form-grid js-publication-form" data-publication-id="${escapeHtml(publication.publicationId)}">
        <div class="form-grid form-grid--two">
          <div class="field">
            <label>Statut canal</label>
            <input name="channelStatus" type="text" value="${escapeHtml(publication.channelStatus)}" required />
          </div>
          <div class="field">
            <label>Prix publie (centimes)</label>
            <input name="prixPublie" type="number" min="0" step="1" value="${fieldValue(publication.prixPublie)}" />
          </div>
        </div>

        <div class="field">
          <label>ID canal externe</label>
          <input name="channelListingId" type="text" value="${escapeHtml(fieldValue(publication.channelListingId))}" />
        </div>

        <div class="field">
          <label>Titre publie</label>
          <input name="titrePublie" type="text" value="${escapeHtml(fieldValue(publication.titrePublie))}" />
        </div>

        <div class="field">
          <label>Categorie canal</label>
          <input name="categorieCanal" type="text" value="${escapeHtml(fieldValue(publication.categorieCanal))}" />
        </div>

        <div class="field">
          <label>Hashtags</label>
          <input name="hashtagsPublies" type="text" value="${escapeHtml(publication.hashtagsPublies.join(", "))}" />
        </div>

        <div class="field">
          <label>URL externe</label>
          <input name="externalUrl" type="url" value="${escapeHtml(fieldValue(publication.externalUrl))}" />
        </div>

        <div class="field">
          <label>Description publiee</label>
          <textarea name="descriptionPubliee">${escapeHtml(fieldValue(publication.descriptionPubliee))}</textarea>
        </div>

        <div class="publication-card__actions">
          <button type="submit" class="button button--secondary">Enregistrer la publication</button>
          <button
            type="button"
            class="button button--danger"
            data-publication-action="delete"
            data-publication-id="${escapeHtml(publication.publicationId)}"
          >
            Supprimer
          </button>
        </div>
      </form>
    </article>
  `;
}

function buildPhotoReorder(photos, fromIndex, delta) {
  const toIndex = fromIndex + delta;

  if (toIndex < 0 || toIndex >= photos.length) {
    return photos.map((photo) => photo.photoId);
  }

  const photoIds = photos.map((photo) => photo.photoId);
  const [moved] = photoIds.splice(fromIndex, 1);
  photoIds.splice(toIndex, 0, moved);

  return photoIds;
}

export async function renderObjectDetail(context, route) {
  const objectId = route.objectId;
  const publicationFilters = {
    channelId: route.query.channelId ?? "",
    channelStatus: route.query.channelStatus ?? ""
  };
  context.root.innerHTML = `<div class="loading">Chargement de la fiche ${escapeHtml(objectId)}...</div>`;

  const [object, publications, aiGenerations, historyEvents, channels] = await Promise.all([
    context.api.getObject(objectId),
    context.api.listPublications(objectId, publicationFilters),
    context.api.listAiGenerations(objectId),
    context.api.getObjectHistory(objectId, { scope: "FULL", limit: 100 }),
    context.getChannels()
  ]);
  const photos = Array.isArray(object.photos) ? object.photos : await context.api.listPhotos(objectId);
  const activeChannels = channels.filter((channel) => channel.isActive);
  const rollbackCandidate = historyEvents.find(
    (event) =>
      event.entityType === "OBJECT" &&
      (event.sourceType === "MANUAL" || event.sourceType === "AI") &&
      event.rollbackData
  );

  context.root.innerHTML = `
    <div id="object-detail-view">
    <section class="page-head">
      <div>
        <h2>Fiche objet</h2>
        <p>
          <span class="mono">${escapeHtml(object.objectId)}</span>
          - statut
          <span class="status-badge status-badge--${workflowBadgeClass(object.workflowStatus)}">
            ${escapeHtml(workflowLabel(object.workflowStatus))}
          </span>
        </p>
      </div>
      <div class="page-head__actions">
        <a class="button button--secondary" href="${hashForPipeline()}">Retour pipeline</a>
      </div>
    </section>

    <section class="grid grid--two">
      <div class="stack">
        <article class="panel">
          <h3>Objet central</h3>
          <form id="object-form" class="form-grid">
            <div class="field">
              <label for="object-note-rapide">Note rapide</label>
              <textarea id="object-note-rapide" name="noteRapide">${escapeHtml(fieldValue(object.noteRapide))}</textarea>
            </div>

            <div class="form-grid form-grid--two">
              <div class="field">
                <label for="object-type">Type objet</label>
                <input id="object-type" name="typeObjet" type="text" value="${escapeHtml(fieldValue(object.typeObjet))}" />
              </div>
              <div class="field">
                <label for="object-etat">Etat</label>
                <input id="object-etat" name="etat" type="text" value="${escapeHtml(fieldValue(object.etat))}" />
              </div>
              <div class="field">
                <label for="object-source">Source</label>
                <input id="object-source" name="source" type="text" value="${escapeHtml(fieldValue(object.source))}" />
              </div>
              <div class="field">
                <label for="object-location">Emplacement</label>
                <input id="object-location" name="locationCode" type="text" value="${escapeHtml(fieldValue(object.locationCode))}" />
              </div>
              <div class="field">
                <label for="object-stock">Stock</label>
                <input id="object-stock" name="stockStatus" type="text" value="${escapeHtml(fieldValue(object.stockStatus))}" />
              </div>
              <div class="field">
                <label for="object-category">Categorie interne</label>
                <input id="object-category" name="categorieInterne" type="text" value="${escapeHtml(fieldValue(object.categorieInterne))}" />
              </div>
              <div class="field">
                <label for="object-prix-reference">Prix reference (centimes)</label>
                <input id="object-prix-reference" name="prixReference" type="number" min="0" step="1" value="${fieldValue(object.prixReference)}" />
              </div>
              <div class="field">
                <label for="object-prix-final">Prix final (centimes)</label>
                <input id="object-prix-final" name="prixFinal" type="number" min="0" step="1" value="${fieldValue(object.prixFinal)}" />
              </div>
            </div>

            <div class="field">
              <label for="object-title">Titre interne</label>
              <input id="object-title" name="titreInterne" type="text" value="${escapeHtml(fieldValue(object.titreInterne))}" />
            </div>

            <div class="field">
              <label for="object-description">Description interne</label>
              <textarea id="object-description" name="descriptionInterne">${escapeHtml(fieldValue(object.descriptionInterne))}</textarea>
            </div>

            <div class="inline-actions">
              <button type="submit" class="button button--primary">Enregistrer l'objet</button>
            </div>
          </form>
        </article>

        <article class="panel">
          <h3>Photos</h3>
          <form id="photo-upload-form" class="form-grid">
            <div class="field">
              <label for="photo-files">Ajouter des photos</label>
              <input id="photo-files" name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple />
            </div>
            <div class="inline-actions">
              <button type="submit" class="button button--secondary">Uploader</button>
            </div>
          </form>

          <div class="photo-grid" style="margin-top: 16px;">
            ${
              photos.length > 0
                ? photos
                    .map((photo, index) =>
                      renderPhotoCard(object.objectId, photo, index, photos.length)
                    )
                    .join("")
                : renderEmptyState("Pas de photo", "Ajoute une ou plusieurs images pour cet objet.")
            }
          </div>
        </article>

        <article class="panel">
          <div class="page-head">
            <div>
              <h3>Publications canal</h3>
              <p>Chaque publication garde son propre statut, son propre ID interne et son ID canal externe.</p>
            </div>
          </div>

          <form id="publication-filter-form" class="form-grid">
            <div class="form-grid form-grid--two">
              <div class="field">
                <label for="publication-filter-channel">Filtre canal</label>
                <select id="publication-filter-channel" name="channelId">
                  <option value="">Tous les canaux</option>
                  ${channels
                    .map(
                      (channel) => `
                        <option
                          value="${escapeHtml(channel.channelId)}"
                          ${publicationFilters.channelId === channel.channelId ? "selected" : ""}
                        >
                          ${escapeHtml(channel.name)}
                        </option>
                      `
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="publication-filter-status">Filtre statut canal</label>
                <input
                  id="publication-filter-status"
                  name="channelStatus"
                  type="text"
                  value="${escapeHtml(publicationFilters.channelStatus)}"
                  placeholder="DRAFT, PUBLISHED, SOLD..."
                />
              </div>
            </div>

            <div class="inline-actions">
              <button type="submit" class="button button--secondary">Filtrer</button>
              <a class="button" href="${hashForObject(objectId)}">Reinitialiser</a>
            </div>
          </form>

          <form id="publication-create-form" class="form-grid">
            <div class="form-grid form-grid--two">
              <div class="field">
                <label for="publication-channel">Canal</label>
                <select id="publication-channel" name="channelId" required>
                  <option value="">Choisir</option>
                  ${activeChannels
                    .map(
                      (channel) => `
                        <option value="${escapeHtml(channel.channelId)}">
                          ${escapeHtml(channel.name)}
                        </option>
                      `
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="publication-status">Statut canal</label>
                <input id="publication-status" name="channelStatus" type="text" value="DRAFT" required />
              </div>
            </div>

            <div class="field">
              <label for="publication-channel-listing-id">ID canal externe</label>
              <input id="publication-channel-listing-id" name="channelListingId" type="text" placeholder="ID renvoye par Vinted / Site / eBay" />
            </div>

            <div class="field">
              <label for="publication-title">Titre publie</label>
              <input id="publication-title" name="titrePublie" type="text" />
            </div>

            <div class="form-grid form-grid--two">
              <div class="field">
                <label for="publication-category">Categorie canal</label>
                <input id="publication-category" name="categorieCanal" type="text" />
              </div>
              <div class="field">
                <label for="publication-price">Prix publie (centimes)</label>
                <input id="publication-price" name="prixPublie" type="number" min="0" step="1" />
              </div>
            </div>

            <div class="field">
              <label for="publication-tags">Hashtags</label>
              <input id="publication-tags" name="hashtagsPublies" type="text" placeholder="sony, vintage, audio" />
            </div>

            <div class="field">
              <label for="publication-url">URL externe</label>
              <input id="publication-url" name="externalUrl" type="url" />
            </div>

            <div class="field">
              <label for="publication-description">Description publiee</label>
              <textarea id="publication-description" name="descriptionPubliee"></textarea>
            </div>

            <div class="inline-actions">
              <button type="submit" class="button button--secondary">Creer la publication</button>
            </div>
          </form>

          <div class="stack" style="margin-top: 18px;">
            ${
              publications.length > 0
                ? publications.map((publication) => renderPublicationCard(publication, channels)).join("")
                : renderEmptyState(
                    "Aucune publication",
                    publicationFilters.channelId || publicationFilters.channelStatus
                      ? "Aucune publication ne correspond a ces filtres."
                      : "Cet objet n'est encore diffuse sur aucun canal."
                  )
            }
          </div>
        </article>
      </div>

      <aside class="stack">
        <article class="panel">
          <h3>Workflow</h3>
          <form id="status-form" class="form-grid">
            <div class="field">
              <label for="workflow-status">Statut objet</label>
              ${renderWorkflowSelect(object.workflowStatus, "workflowStatus")}
            </div>

            <div class="field">
              <label for="workflow-note">Note historique</label>
              <input id="workflow-note" name="note" type="text" placeholder="Verification terminee, pret a publier" />
            </div>

            <div class="inline-actions">
              <button type="submit" class="button button--primary">Changer le statut</button>
            </div>
          </form>
        </article>

        <article class="panel">
          <h3>Repere rapide</h3>
          <div class="details-grid">
            <div class="detail-box">
              <p class="detail-box__label">Objet</p>
              <p class="detail-box__value mono">${escapeHtml(object.objectId)}</p>
            </div>
            <div class="detail-box">
              <p class="detail-box__label">Mis a jour</p>
              <p class="detail-box__value">${escapeHtml(formatDateTime(object.updatedAt))}</p>
            </div>
            <div class="detail-box">
              <p class="detail-box__label">Prix IA</p>
              <p class="detail-box__value">${escapeHtml(formatMoneyCents(object.prixIA))}</p>
            </div>
            <div class="detail-box">
              <p class="detail-box__label">Confiance</p>
              <p class="detail-box__value">${escapeHtml(object.confiance === null ? "Non definie" : String(object.confiance))}</p>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="page-head">
            <div>
              <h3>Generation IA</h3>
              <p>Suggestion structuree, distincte de la validation finale.</p>
            </div>
            <div class="page-head__actions">
              <button id="generate-ai-button" class="button button--primary" type="button">Generer</button>
              <button id="retry-ai-button" class="button button--secondary" type="button">Relancer</button>
            </div>
          </div>

          <div class="stack">
            ${
              aiGenerations.length > 0
                ? aiGenerations.map((generation) => renderAiCard(generation)).join("")
                : renderEmptyState("Pas de generation", "Lance une premiere suggestion IA pour cet objet.")
            }
          </div>
        </article>

        <article class="panel">
          <div class="page-head">
            <div>
              <h3>Historique complet</h3>
              <p>Journal unifie de l'objet central et de ses publications, lisible et auditable.</p>
            </div>
          </div>

          <div class="history-list">
            ${
              historyEvents.length > 0
                ? historyEvents
                    .map((event) =>
                      renderHistoryItem(event, rollbackCandidate?.id === event.id)
                    )
                    .join("")
                : renderEmptyState("Aucun evenement", "Aucun historique n'a encore ete enregistre.")
            }
          </div>
        </article>
      </aside>
    </section>
    </div>
  `;

  const detailView = context.root.querySelector("#object-detail-view");
  const objectForm = context.root.querySelector("#object-form");
  const statusForm = context.root.querySelector("#status-form");
  const photoUploadForm = context.root.querySelector("#photo-upload-form");
  const generateAiButton = context.root.querySelector("#generate-ai-button");
  const retryAiButton = context.root.querySelector("#retry-ai-button");
  const publicationFilterForm = context.root.querySelector("#publication-filter-form");
  const publicationCreateForm = context.root.querySelector("#publication-create-form");
  const publicationForms = Array.from(context.root.querySelectorAll(".js-publication-form"));

  objectForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = objectForm.querySelector("button[type='submit']");
    const formData = new FormData(objectForm);
    button?.setAttribute("disabled", "disabled");

    try {
      await context.api.updateObject(objectId, {
        noteRapide: asNullableText(formData.get("noteRapide")),
        typeObjet: asNullableText(formData.get("typeObjet")),
        etat: asNullableText(formData.get("etat")),
        source: asNullableText(formData.get("source")),
        locationCode: asNullableText(formData.get("locationCode")),
        stockStatus: asNullableText(formData.get("stockStatus")),
        categorieInterne: asNullableText(formData.get("categorieInterne")),
        prixReference: asNullableInteger(formData.get("prixReference")),
        prixFinal: asNullableInteger(formData.get("prixFinal")),
        titreInterne: asNullableText(formData.get("titreInterne")),
        descriptionInterne: asNullableText(formData.get("descriptionInterne"))
      });
      context.setStatus(`Objet ${objectId} mis a jour.`, "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  statusForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = statusForm.querySelector("button[type='submit']");
    const formData = new FormData(statusForm);
    button?.setAttribute("disabled", "disabled");

    try {
      await context.api.changeObjectStatus(objectId, {
        workflowStatus: String(formData.get("workflowStatus") ?? ""),
        note: asNullableText(formData.get("note"))
      });
      context.setStatus(`Statut de ${objectId} mis a jour.`, "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  photoUploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = photoUploadForm.querySelector("button[type='submit']");
    const fileInput = photoUploadForm.querySelector("input[type='file']");
    const files = Array.from(fileInput?.files ?? []);

    if (files.length === 0) {
      context.setStatus("Choisis au moins une image a uploader.", "error");
      return;
    }

    button?.setAttribute("disabled", "disabled");

    try {
      await context.api.uploadPhotos(objectId, files);
      context.setStatus(`${files.length} photo(s) ajoutee(s).`, "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  detailView?.addEventListener("click", async (event) => {
    const aiActionTarget = event.target.closest("[data-ai-action]");

    if (aiActionTarget) {
      const aiAction = aiActionTarget.dataset.aiAction;
      const generationId = aiActionTarget.dataset.aiGenerationId;

      aiActionTarget.setAttribute("disabled", "disabled");

      try {
        if (aiAction === "apply" && generationId) {
          const result = await context.api.applyAiGeneration(objectId, generationId);
          context.setStatus(
            `Suggestion IA appliquee (${result.appliedFields.join(", ")}).`,
            "success"
          );
          await context.refresh();
        }
      } catch (error) {
        context.setStatus(error.message, "error");
      } finally {
        aiActionTarget.removeAttribute("disabled");
      }

      return;
    }

    const publicationActionTarget = event.target.closest("[data-publication-action]");

    if (publicationActionTarget) {
      const publicationAction = publicationActionTarget.dataset.publicationAction;
      const publicationId = publicationActionTarget.dataset.publicationId;

      publicationActionTarget.setAttribute("disabled", "disabled");

      try {
        if (publicationAction === "delete" && publicationId) {
          await context.api.deletePublication(publicationId);
          context.setStatus(`Publication ${publicationId} supprimee.`, "success");
          await context.refresh();
        }
      } catch (error) {
        context.setStatus(error.message, "error");
      } finally {
        publicationActionTarget.removeAttribute("disabled");
      }

      return;
    }

    const historyActionTarget = event.target.closest("[data-history-action]");

    if (historyActionTarget) {
      const historyAction = historyActionTarget.dataset.historyAction;
      const historyEventId = historyActionTarget.dataset.historyEventId;

      historyActionTarget.setAttribute("disabled", "disabled");

      try {
        if (historyAction === "rollback" && historyEventId) {
          await context.api.rollbackObjectHistoryEvent(objectId, historyEventId);
          context.setStatus("Rollback applique sur l'objet central.", "success");
          await context.refresh();
        }
      } catch (error) {
        context.setStatus(error.message, "error");
      } finally {
        historyActionTarget.removeAttribute("disabled");
      }

      return;
    }

    const target = event.target.closest("[data-photo-action]");

    if (!target) {
      return;
    }

    const action = target.dataset.photoAction;
    const photoId = target.dataset.photoId;
    const photoIndex = Number.parseInt(target.dataset.photoIndex ?? "-1", 10);
    target.setAttribute("disabled", "disabled");

    try {
      if (action === "main" && photoId) {
        await context.api.setMainPhoto(objectId, photoId);
        context.setStatus("Photo principale mise a jour.", "success");
      }

      if (action === "delete" && photoId) {
        await context.api.deletePhoto(objectId, photoId);
        context.setStatus("Photo supprimee.", "success");
      }

      if (action === "move-left" && photoIndex >= 0) {
        await context.api.reorderPhotos(objectId, buildPhotoReorder(photos, photoIndex, -1));
        context.setStatus("Ordre des photos mis a jour.", "success");
      }

      if (action === "move-right" && photoIndex >= 0) {
        await context.api.reorderPhotos(objectId, buildPhotoReorder(photos, photoIndex, 1));
        context.setStatus("Ordre des photos mis a jour.", "success");
      }

      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      target.removeAttribute("disabled");
    }
  });

  generateAiButton?.addEventListener("click", async () => {
    generateAiButton.setAttribute("disabled", "disabled");

    try {
      await context.api.generateAi(objectId);
      context.setStatus("Generation IA lancee.", "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      generateAiButton.removeAttribute("disabled");
    }
  });

  retryAiButton?.addEventListener("click", async () => {
    retryAiButton.setAttribute("disabled", "disabled");

    try {
      await context.api.retryAi(objectId);
      context.setStatus("Nouvelle generation IA lancee.", "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      retryAiButton.removeAttribute("disabled");
    }
  });

  publicationFilterForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(publicationFilterForm);
    context.navigate(
      hashForObject(objectId, {
        channelId: String(formData.get("channelId") ?? "").trim(),
        channelStatus: String(formData.get("channelStatus") ?? "").trim()
      })
    );
  });

  publicationCreateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = publicationCreateForm.querySelector("button[type='submit']");
    const formData = new FormData(publicationCreateForm);
    button?.setAttribute("disabled", "disabled");

    try {
      await context.api.createPublication(objectId, {
        channelId: String(formData.get("channelId") ?? ""),
        channelStatus: String(formData.get("channelStatus") ?? "").trim(),
        channelListingId: asNullableText(formData.get("channelListingId")),
        titrePublie: asNullableText(formData.get("titrePublie")),
        categorieCanal: asNullableText(formData.get("categorieCanal")),
        prixPublie: asNullableInteger(formData.get("prixPublie")),
        hashtagsPublies: parseCommaList(formData.get("hashtagsPublies")),
        externalUrl: asNullableUrl(formData.get("externalUrl")),
        descriptionPubliee: asNullableText(formData.get("descriptionPubliee"))
      });
      context.setStatus("Publication creee.", "success");
      await context.refresh();
    } catch (error) {
      context.setStatus(error.message, "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  });

  for (const form of publicationForms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const button = form.querySelector("button[type='submit']");
      const publicationId = form.dataset.publicationId;

      if (!publicationId) {
        return;
      }

      const formData = new FormData(form);
      button?.setAttribute("disabled", "disabled");

      try {
        await context.api.updatePublication(publicationId, {
          channelStatus: String(formData.get("channelStatus") ?? "").trim(),
          channelListingId: asNullableText(formData.get("channelListingId")),
          titrePublie: asNullableText(formData.get("titrePublie")),
          categorieCanal: asNullableText(formData.get("categorieCanal")),
          prixPublie: asNullableInteger(formData.get("prixPublie")),
          hashtagsPublies: parseCommaList(formData.get("hashtagsPublies")),
          externalUrl: asNullableUrl(formData.get("externalUrl")),
          descriptionPubliee: asNullableText(formData.get("descriptionPubliee"))
        });
        context.setStatus(`Publication ${publicationId} mise a jour.`, "success");
        await context.refresh();
      } catch (error) {
        context.setStatus(error.message, "error");
      } finally {
        button?.removeAttribute("disabled");
      }
    });
  }
}
