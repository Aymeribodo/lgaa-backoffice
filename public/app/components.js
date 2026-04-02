export const WORKFLOW_OPTIONS = [
  { value: "BROUILLON", label: "Nouveaux" },
  { value: "IA_GENERE", label: "IA genere" },
  { value: "A_VERIFIER", label: "A verifier" },
  { value: "PRET", label: "Pret" },
  { value: "PUBLIE", label: "Publie" },
  { value: "VENDU", label: "Vendu" },
  { value: "PAYE", label: "Paye" },
  { value: "PROBLEME", label: "Probleme" },
  { value: "ARCHIVE", label: "Archive" }
];

export const PIPELINE_COLUMNS = [
  { status: "BROUILLON", label: "Nouveaux" },
  { status: "IA_GENERE", label: "IA genere" },
  { status: "A_VERIFIER", label: "A verifier" },
  { status: "PRET", label: "Pret" },
  { status: "PUBLIE", label: "Publie" },
  { status: "VENDU", label: "Vendu" }
];

export const AUDIT_PRESET_OPTIONS = [
  { value: "PROBLEM", label: "Objets en probleme" },
  { value: "READY_UNPUBLISHED", label: "Prets non publies" },
  { value: "SOLD_UNPAID", label: "Vendus non payes" }
];

const WORKFLOW_LABELS = Object.fromEntries(
  WORKFLOW_OPTIONS.map((item) => [item.value, item.label])
);

const WORKFLOW_BADGE_CLASSES = {
  BROUILLON: "draft",
  IA_GENERE: "ai",
  A_VERIFIER: "review",
  PRET: "ready",
  PUBLIE: "published",
  VENDU: "sold"
};

const HISTORY_SOURCE_BADGE_CLASSES = {
  MANUAL: "ready",
  AI: "ai",
  SYSTEM: "default"
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function workflowLabel(status) {
  return WORKFLOW_LABELS[status] ?? status;
}

export function workflowBadgeClass(status) {
  return WORKFLOW_BADGE_CLASSES[status] ?? "default";
}

export function historySourceBadgeClass(sourceType) {
  return HISTORY_SOURCE_BADGE_CLASSES[sourceType] ?? "default";
}

export function formatMoneyCents(value) {
  if (value === null || value === undefined) {
    return "Non defini";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(value / 100);
}

export function formatDateTime(value) {
  if (!value) {
    return "Non defini";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function photoUrl(objectId, photoId, variant = "thumbnail") {
  return `/objects/${encodeURIComponent(objectId)}/photos/${encodeURIComponent(photoId)}/file?variant=${variant}`;
}

export function storageUrl(relativePath) {
  if (!relativePath) {
    return null;
  }

  const normalized = String(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `/storage/${normalized}`;
}

export function photoAssetUrl(photo, variant = "thumbnail") {
  if (!photo) {
    return null;
  }

  if (variant === "thumbnail" && photo.thumbnailUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.originalUrl) {
    return photo.originalUrl;
  }

  if (variant === "thumbnail" && photo?.metadata?.thumbnailRelativePath) {
    return storageUrl(photo.metadata.thumbnailRelativePath);
  }

  return storageUrl(photo.relativePath);
}

export function renderWorkflowSelect(currentValue, selectName = "workflowStatus") {
  return `
    <select name="${escapeHtml(selectName)}">
      ${WORKFLOW_OPTIONS.map(
        (option) => `
          <option value="${escapeHtml(option.value)}" ${
            currentValue === option.value ? "selected" : ""
          }>
            ${escapeHtml(option.label)}
          </option>
        `
      ).join("")}
    </select>
  `;
}

export function renderEmptyState(title, text) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function renderObjectImage(object) {
  if (!object.mainPhotoId) {
    return `<div class="photo-placeholder">Sans photo</div>`;
  }

  const imageUrl = object.mainPhotoUrl ?? photoUrl(object.objectId, object.mainPhotoId, "thumbnail");

  return `
    <img
      src="${escapeHtml(imageUrl)}"
      alt="Photo principale ${escapeHtml(object.objectId)}"
      loading="lazy"
    />
  `;
}

export function renderObjectCard(object) {
  const note = object.noteRapide?.trim() || "Aucune note rapide";

  return `
    <article class="object-card">
      <div class="object-card__media">
        ${renderObjectImage(object)}
      </div>
      <div class="object-card__body">
        <div class="object-card__top">
          <a href="#/objects/${encodeURIComponent(object.objectId)}" class="mono">
            ${escapeHtml(object.objectId)}
          </a>
          <span class="status-badge status-badge--${workflowBadgeClass(object.workflowStatus)}">
            ${escapeHtml(workflowLabel(object.workflowStatus))}
          </span>
        </div>

        <p class="object-card__note">${escapeHtml(note)}</p>

        <div class="object-card__meta">
          ${
            object.typeObjet
              ? `<span class="chip">${escapeHtml(object.typeObjet)}</span>`
              : ""
          }
          ${
            object.etat ? `<span class="chip">${escapeHtml(object.etat)}</span>` : ""
          }
          ${
            object.prixIA !== null && object.prixIA !== undefined
              ? `<span class="chip">${escapeHtml(formatMoneyCents(object.prixIA))}</span>`
              : ""
          }
        </div>

        <div class="inline-form">
          <form class="inline-form js-status-form" data-object-id="${escapeHtml(object.objectId)}">
            ${renderWorkflowSelect(object.workflowStatus)}
            <button type="submit" class="button button--small">Statut</button>
          </form>
          <a class="button button--secondary button--small" href="#/objects/${encodeURIComponent(
            object.objectId
          )}">
            Ouvrir
          </a>
        </div>

        <span class="subtle-text">Mis a jour ${escapeHtml(formatDateTime(object.updatedAt))}</span>
      </div>
    </article>
  `;
}

export function parseCommaList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function asNullableText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asNullableInteger(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function asNullableUrl(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
