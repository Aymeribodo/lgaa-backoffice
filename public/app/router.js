export function parseRoute() {
  const rawHash = window.location.hash.replace(/^#/, "");
  const normalized = rawHash.startsWith("/") ? rawHash : `/${rawHash}`;
  const [pathPart, searchPart = ""] = normalized.split("?");
  const segments = pathPart
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const query = Object.fromEntries(new URLSearchParams(searchPart).entries());

  if (segments[0] === "quick-create") {
    return {
      name: "quick-create",
      query
    };
  }

  if (segments[0] === "search") {
    return {
      name: "search",
      query
    };
  }

  if (segments[0] === "objects" && segments[1]) {
    return {
      name: "object-detail",
      objectId: segments[1],
      query
    };
  }

  return {
    name: "pipeline",
    query
  };
}

function buildHashPath(path, query = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();

  return `#${path}${queryString ? `?${queryString}` : ""}`;
}

export function hashForPipeline() {
  return buildHashPath("/pipeline");
}

export function hashForQuickCreate() {
  return buildHashPath("/quick-create");
}

export function hashForSearch(query = {}) {
  return buildHashPath("/search", query);
}

export function hashForObject(objectId, query = {}) {
  return buildHashPath(`/objects/${encodeURIComponent(objectId)}`, query);
}
