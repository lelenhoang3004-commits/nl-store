// Cache template HTML per URL to avoid repeated network and disk reads during SPA route changes.
const templateCache = new Map();

export async function loadTemplate(templateUrl) {
  const url = String(templateUrl);

  if (templateCache.has(url)) {
    return templateCache.get(url);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Cannot load template: ${url}`);
  }

  const html = await response.text();
  templateCache.set(url, html);
  return html;
}

export function clearTemplateCache(templateUrl) {
  if (templateUrl) {
    templateCache.delete(String(templateUrl));
    return;
  }

  templateCache.clear();
}
