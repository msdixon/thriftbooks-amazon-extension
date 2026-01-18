export function thriftbooksSearchUrl(query) {
  // ThriftBooks browse/search supports b.search as a query parameter.
  const base = "https://www.thriftbooks.com/browse/";
  const url = new URL(base);
  url.searchParams.set("b.search", query);
  return url.toString();
}
