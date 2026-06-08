export function worldofbooksSearchUrl(query) {
  const base = "https://www.worldofbooks.com/en-gb/search";
  const url = new URL(base);
  url.searchParams.set("q", query);
  return url.toString();
}
