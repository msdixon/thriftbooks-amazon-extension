export function bookshopSearchUrl(query) {
  const base = "https://bookshop.org/search";
  const url = new URL(base);
  url.searchParams.set("keywords", query);
  return url.toString();
}
