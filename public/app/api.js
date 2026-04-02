function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const isFormData = options.body instanceof FormData;
  let body = options.body;

  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (body !== undefined && !isFormData && typeof body !== "string") {
    body = JSON.stringify(body);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : { message: await response.text() };

  if (!response.ok) {
    throw new Error(payload.message ?? `Erreur HTTP ${response.status}`);
  }

  return payload.data;
}

export const api = {
  listObjects(filters = {}) {
    return requestJson(`/objects${buildQuery(filters)}`);
  },
  quickCreateObject(payload) {
    return requestJson("/objects/quick", {
      method: "POST",
      body: payload
    });
  },
  getObject(objectId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}`);
  },
  getObjectHistory(objectId, options = {}) {
    return requestJson(
      `/objects/${encodeURIComponent(objectId)}/history${buildQuery(options)}`
    );
  },
  rollbackObjectHistoryEvent(objectId, historyEventId) {
    return requestJson(
      `/objects/${encodeURIComponent(objectId)}/history/${encodeURIComponent(historyEventId)}/rollback`,
      {
        method: "POST"
      }
    );
  },
  updateObject(objectId, payload) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}`, {
      method: "PATCH",
      body: payload
    });
  },
  changeObjectStatus(objectId, payload) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/status`, {
      method: "PATCH",
      body: payload
    });
  },
  listPhotos(objectId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/photos`);
  },
  uploadPhotos(objectId, files) {
    const formData = new FormData();

    for (const file of files) {
      formData.append("files", file);
    }

    return requestJson(`/objects/${encodeURIComponent(objectId)}/photos`, {
      method: "POST",
      body: formData
    });
  },
  setMainPhoto(objectId, photoId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/photos/main`, {
      method: "PATCH",
      body: { photoId }
    });
  },
  reorderPhotos(objectId, photoIds) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/photos/reorder`, {
      method: "PATCH",
      body: { photoIds }
    });
  },
  deletePhoto(objectId, photoId) {
    return requestJson(
      `/objects/${encodeURIComponent(objectId)}/photos/${encodeURIComponent(photoId)}`,
      {
        method: "DELETE"
      }
    );
  },
  listAiGenerations(objectId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/ai-generations`);
  },
  generateAi(objectId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/ai-generations`, {
      method: "POST"
    });
  },
  retryAi(objectId) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/ai-generations/retry`, {
      method: "POST"
    });
  },
  applyAiGeneration(objectId, generationId) {
    return requestJson(
      `/objects/${encodeURIComponent(objectId)}/ai-generations/${encodeURIComponent(generationId)}/apply`,
      {
        method: "POST"
      }
    );
  },
  listPublications(objectId, filters = {}) {
    const query = buildQuery(filters);

    return requestJson(`/objects/${encodeURIComponent(objectId)}/publications${query}`);
  },
  createPublication(objectId, payload) {
    return requestJson(`/objects/${encodeURIComponent(objectId)}/publications`, {
      method: "POST",
      body: payload
    });
  },
  getPublication(publicationId) {
    return requestJson(`/publications/${encodeURIComponent(publicationId)}`);
  },
  getPublicationHistory(publicationId, options = {}) {
    return requestJson(
      `/publications/${encodeURIComponent(publicationId)}/history${buildQuery(options)}`
    );
  },
  listAllPublications(filters = {}) {
    return requestJson(`/publications${buildQuery(filters)}`);
  },
  updatePublication(publicationId, payload) {
    return requestJson(`/publications/${encodeURIComponent(publicationId)}`, {
      method: "PATCH",
      body: payload
    });
  },
  deletePublication(publicationId) {
    return requestJson(`/publications/${encodeURIComponent(publicationId)}`, {
      method: "DELETE"
    });
  },
  listChannels(activeOnly = false) {
    return requestJson(`/channels${buildQuery({ activeOnly })}`);
  }
};
