export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const q = String(req.query?.q || "").trim();
  if (q.length < 2) {
    return res.status(200).json({ diagnostic: true, query: q, message: "QUERY_TOO_SHORT" });
  }

  const key = process.env.FOOD_API_KEY;
  if (!key) {
    return res.status(200).json({
      diagnostic: true,
      query: q,
      foodApiKeyConfigured: false,
      message: "FOOD_API_KEY_NOT_SET"
    });
  }

  // Never return the API key itself.
  const endpoints = [
    {
      name: "MFDS_FoodNtrCpntDbInfo03_FOOD_NM_KR",
      url: "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03",
      queryParam: "FOOD_NM_KR"
    },
    {
      name: "MFDS_FoodNtrCpntDbInfo03_foodNm",
      url: "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03",
      queryParam: "foodNm"
    }
  ];

  const results = [];

  for (const ep of endpoints) {
    try {
      const u = new URL(ep.url);
      u.searchParams.set("serviceKey", key);
      u.searchParams.set("type", "json");
      u.searchParams.set("pageNo", "1");
      u.searchParams.set("numOfRows", "5");
      u.searchParams.set(ep.queryParam, q);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      let response;
      try {
        response = await fetch(u, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      const rawText = await response.text();

      let data = null;
      let jsonError = null;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        jsonError = e?.message || "JSON_PARSE_FAILED";
      }

      const possibleItems =
        data?.body?.items ??
        data?.response?.body?.items ??
        data?.items ??
        null;

      const itemArray = Array.isArray(possibleItems)
        ? possibleItems
        : Array.isArray(possibleItems?.item)
          ? possibleItems.item
          : possibleItems?.item
            ? [possibleItems.item]
            : [];

      const first = itemArray[0] || null;

      results.push({
        endpoint: ep.name,
        request: {
          queryParam: ep.queryParam,
          query: q
        },
        httpStatus: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type") || "",
        jsonParsed: !!data,
        jsonError,
        topLevelKeys: data && typeof data === "object" ? Object.keys(data) : [],
        responseHeader:
          data?.header ??
          data?.response?.header ??
          null,
        bodyKeys:
          data?.body && typeof data.body === "object"
            ? Object.keys(data.body)
            : data?.response?.body && typeof data.response.body === "object"
              ? Object.keys(data.response.body)
              : [],
        totalCount:
          data?.body?.totalCount ??
          data?.response?.body?.totalCount ??
          data?.totalCount ??
          null,
        itemCount: itemArray.length,
        firstItemKeys: first && typeof first === "object" ? Object.keys(first) : [],
        firstItem: first,
        // Only include a short raw preview when JSON could not be parsed.
        rawPreview: data ? null : rawText.slice(0, 800)
      });
    } catch (e) {
      results.push({
        endpoint: ep.name,
        request: { queryParam: ep.queryParam, query: q },
        error: e?.name === "AbortError" ? "TIMEOUT" : String(e?.message || e)
      });
    }
  }

  return res.status(200).json({
    diagnostic: true,
    query: q,
    foodApiKeyConfigured: true,
    note: "API key value is intentionally never returned.",
    results
  });
}
