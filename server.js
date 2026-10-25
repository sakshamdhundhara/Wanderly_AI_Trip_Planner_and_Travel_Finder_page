const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname);
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) return;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  });
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

const apiRequestWindows = new Map();
const apiWindowMs = 60_000;
const apiWindowLimit = 120;
const apiCleanup = setInterval(() => {
  const expiredBefore = Date.now() - apiWindowMs;
  for (const [address, window] of apiRequestWindows) {
    if (window.startedAt < expiredBefore) apiRequestWindows.delete(address);
  }
}, apiWindowMs);
apiCleanup.unref();

function allowApiRequest(request, response) {
  const now = Date.now();
  const address = request.socket.remoteAddress || "unknown";
  let window = apiRequestWindows.get(address);
  if (!window || now - window.startedAt >= apiWindowMs) {
    window = { startedAt: now, count: 0 };
    apiRequestWindows.set(address, window);
  }
  if (window.count >= apiWindowLimit) {
    sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
    return false;
  }
  window.count += 1;
  return true;
}

async function readJson(request, response) {
  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
    if (rawBody.length > 4096) {
      sendJson(response, 413, { error: "Search request is too large" });
      return null;
    }
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON" });
    return null;
  }
}

async function tavilySearch(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Search is not configured. Set TAVILY_API_KEY in .env."), { status: 503 });

  const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: options.includeAnswer || false,
        include_images: options.includeImages || false,
        include_image_descriptions: options.includeImages || false,
        max_results: options.maxResults || 6
      })
    });

  if (!tavilyResponse.ok) {
    const error = new Error("Travel search is temporarily unavailable. Please try again.");
    error.status = 502;
    console.error(`Tavily search returned HTTP ${tavilyResponse.status}`);
    throw error;
  }

  return tavilyResponse.json();
}

function formatTavilyResults(data) {
  const results = Array.isArray(data.results) ? data.results.slice(0, 8).map((result) => ({
    title: typeof result.title === "string" ? result.title : "",
    url: typeof result.url === "string" ? result.url : "",
    content: typeof result.content === "string" ? result.content : "",
    images: Array.isArray(result.images) ? result.images.map((image) => ({
      url: typeof image === "string" ? image : image?.url,
      description: typeof image?.description === "string" ? image.description : ""
    })).filter((image) => typeof image.url === "string").slice(0, 2) : []
  })) : [];
  const images = Array.isArray(data.images) ? data.images.map((image) => ({
    url: typeof image === "string" ? image : image?.url,
    description: typeof image?.description === "string" ? image.description : ""
  })).filter((image) => typeof image.url === "string").slice(0, 8) : [];
  return {
    answer: typeof data.answer === "string" ? data.answer : "",
    results,
    images
  };
}

async function findLicensedImages(query) {
  try {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "10");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata");
    url.searchParams.set("iiurlwidth", "480");
    url.searchParams.set("format", "json");
    const response = await fetch(url, {
      headers: { "User-Agent": "Wanderly Travel Planner/1.0" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Wikimedia Commons returned HTTP ${response.status}`);
    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});
    const images = pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata || {};
      const license = typeof metadata.LicenseShortName?.value === "string"
        ? metadata.LicenseShortName.value.replace(/<[^>]*>/g, "").trim()
        : "";
      if (!info?.thumburl || !info?.descriptionurl || !/^CC0$|^CC BY(?:-SA)? \d(?:\.\d)?$/i.test(license)) return [];
      const creator = typeof metadata.Artist?.value === "string"
        ? metadata.Artist.value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim()
        : "";
      return [{
        url: info.thumburl,
        source: info.descriptionurl,
        title: (page.title || "Destination photo").replace(/^File:/i, ""),
        description: (page.title || "Destination photo").replace(/^File:/i, ""),
        license,
        creator
      }];
    });
    return { images: images.slice(0, 6), imageError: "" };
  } catch (error) {
    console.error("Licensed destination image search failed:", error);
    return { images: [], imageError: "Openly licensed destination images are unavailable right now." };
  }
}

async function searchDestinations(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readJson(request, response);
  if (!body) return;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 120) {
    sendJson(response, 400, { error: "Destination must be between 2 and 120 characters" });
    return;
  }

  try {
    const [data, imageLookup] = await Promise.all([
      tavilySearch(`${query} travel destination attractions things to do`, {
      includeAnswer: true,
      maxResults: 8
      }),
      findLicensedImages(query)
    ]);
    sendJson(response, 200, { ...formatTavilyResults(data), ...imageLookup });
  } catch (error) {
    console.error("Destination search failed:", error);
    sendJson(response, error.status || 502, {
      error: error.status === 503 ? error.message : "Destination search is temporarily unavailable. Please try again."
    });
  }
}

const travelStyles = new Set(["culture", "food", "nature", "adventure", "relaxation", "family", "budget", "luxury"]);

async function planTrip(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readJson(request, response);
  if (!body) return;
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const origin = typeof body.origin === "string" ? body.origin.trim().slice(0, 80) : "";
  const days = Number(body.days);
  const travellers = Number(body.travellers);
  const budget = Number(body.budget);
  const estimatedBudget = body.estimatedBudget === undefined ? budget : Number(body.estimatedBudget);
  const departureDate = typeof body.departureDate === "string" ? body.departureDate.trim() : "";
  const returnDate = typeof body.returnDate === "string" ? body.returnDate.trim() : "";
  const style = body.style === undefined ? "culture" : body.style;
  const parsedDepartureDate = new Date(`${departureDate}T00:00:00Z`);
  const parsedReturnDate = new Date(`${returnDate}T00:00:00Z`);
  if (departureDate && (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) ||
    !Number.isFinite(parsedDepartureDate.valueOf()) || parsedDepartureDate.toISOString().slice(0, 10) !== departureDate)) {
    sendJson(response, 400, { error: "Departure date must use YYYY-MM-DD format." });
    return;
  }
  if (returnDate && (!departureDate || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate) ||
    !Number.isFinite(parsedReturnDate.valueOf()) || parsedReturnDate.toISOString().slice(0, 10) !== returnDate ||
    parsedReturnDate <= parsedDepartureDate || (parsedReturnDate - parsedDepartureDate) / 86400000 + 1 !== Number(body.days))) {
    sendJson(response, 400, { error: "Return date must follow the departure date and match the selected trip length." });
    return;
  }
  if (typeof style !== "string" || !travelStyles.has(style)) {
    sendJson(response, 400, { error: "Choose a supported trip style." });
    return;
  }
  if (destination.length < 2 || destination.length > 120 || !Number.isInteger(days) || days < 3 || days > 18 ||
    !Number.isInteger(travellers) || travellers < 1 || travellers > 8 || !Number.isFinite(budget) || budget < 0 || budget > 100000000 ||
    !Number.isFinite(estimatedBudget) || estimatedBudget < 0 || estimatedBudget > 100000000) {
    sendJson(response, 400, { error: "Add a destination and valid trip length, traveller count, and budget." });
    return;
  }

  const personalization = [
    `${days}-day itinerary`,
    `${travellers} traveller${travellers === 1 ? "" : "s"}`,
    `${style} travel`,
    `total trip budget ₹${Math.round(budget)}`,
    `live cost estimate ₹${Math.round(estimatedBudget)}`,
    origin ? `travelling from ${origin}` : "",
    departureDate ? `starting ${departureDate}` : "",
    returnDate ? `returning ${returnDate}` : ""
  ].filter(Boolean).join(", ");
  const query = `Create a sourced, easy-to-scan ${personalization} for ${destination}. Use the stated start and return dates to plan seasonally appropriate activities and mention the date range. Find relevant ${destination} travel guides, ${days}-day itineraries, attractions, local food and transport. Return Markdown with a Trip overview; one separate "Day 1" through "Day ${days}" section, each with Morning, Afternoon, Evening and Getting around bullets; then Where to stay, Food to try, Budget notes and Practical tips. Keep activities geographically sensible and adapt them to ${style} travel. Treat ₹${Math.round(budget)} as the traveller's total budget, compare it with the live estimate of ₹${Math.round(estimatedBudget)}, and flag if it seems unrealistic. Use only source-supported attractions and prices; do not invent opening hours, fares or hotel availability.`;

  try {
    const [data, imageLookup] = await Promise.all([
      tavilySearch(query, { includeAnswer: "advanced", maxResults: 8 }),
      findLicensedImages(destination)
    ]);
    sendJson(response, 200, {
      ...formatTavilyResults(data),
      ...imageLookup,
      destination,
      days,
      travellers,
      style,
      departureDate,
      returnDate,
      origin,
      budget,
      estimatedBudget
    });
  } catch (error) {
    console.error("AI trip planning failed:", error);
    sendJson(response, error.status || 502, {
      error: error.status === 503 ? error.message : "Itinerary planning is temporarily unavailable. Please try again."
    });
  }
}

async function exploreDestination(request, response, url) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const query = (url.searchParams.get("destination") || "").trim();
  if (query.length < 2 || query.length > 120) {
    sendJson(response, 400, { error: "Destination must be between 2 and 120 characters" });
    return;
  }

  try {
    const geocodeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!geocodeResponse.ok) throw new Error(`Geocoding returned HTTP ${geocodeResponse.status}`);
    const geocode = await geocodeResponse.json();
    const place = geocode.results?.[0];
    if (!place) {
      sendJson(response, 404, { error: `No location found for ${query}. Try a city or region name.` });
      return;
    }

    const forecastResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!forecastResponse.ok) throw new Error(`Weather forecast returned HTTP ${forecastResponse.status}`);
    const forecast = await forecastResponse.json();
    const pad = 0.025;
    const bbox = [
      place.longitude - pad,
      place.latitude - pad,
      place.longitude + pad,
      place.latitude + pad
    ].map((coordinate) => coordinate.toFixed(5)).join("%2C");
    const marker = `${encodeURIComponent(place.latitude)},${encodeURIComponent(place.longitude)}`;
    sendJson(response, 200, {
      place: {
        name: place.name,
        region: place.admin1 || "",
        country: place.country || "",
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone || ""
      },
      weather: {
        current: forecast.current || null,
        daily: forecast.daily || null,
        units: { current: forecast.current_units || {}, daily: forecast.daily_units || {} }
      },
      mapEmbed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`,
      mapLink: `https://www.openstreetmap.org/?mlat=${marker.split("%2C")[0]}&mlon=${marker.split("%2C")[1]}#map=12/${marker.replace("%2C", "/")}`
    });
  } catch (error) {
    console.error("Destination exploration failed:", error);
    sendJson(response, 502, { error: "Live weather and map details are unavailable right now. Please try again." });
  }
}

const worldBankCache = new Map();
const worldBankCacheTtl = 24 * 60 * 60 * 1000;

async function getWorldBankSeries(countryCode, indicator) {
  const cacheKey = `${countryCode}:${indicator}`;
  const cached = worldBankCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.values;

  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=30`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`World Bank returned HTTP ${response.status}`);
  const data = await response.json();
  const values = Array.isArray(data?.[1])
    ? data[1].filter((row) => Number.isFinite(row.value) && row.value > 0).map((row) => [String(row.date), row.value])
    : [];
  if (!values.length) throw new Error(`No World Bank observations for ${countryCode} ${indicator}`);
  worldBankCache.set(cacheKey, { values, expiresAt: Date.now() + worldBankCacheTtl });
  return values;
}

async function costProfile(request, response, url) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const query = (url.searchParams.get("destination") || "").trim();
  if (query.length < 2 || query.length > 120) {
    sendJson(response, 400, { error: "Destination must be between 2 and 120 characters" });
    return;
  }

  try {
    const geocodeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!geocodeResponse.ok) throw new Error(`Geocoding returned HTTP ${geocodeResponse.status}`);
    const geocode = await geocodeResponse.json();
    const place = geocode.results?.[0];
    if (!place) {
      sendJson(response, 404, { error: `No location found for ${query}. Try a city or country name.` });
      return;
    }

    const countryCode = typeof place.country_code === "string" ? place.country_code.toUpperCase() : "";
    if (!/^[A-Z]{2,3}$/.test(countryCode)) throw new Error("The location service did not return a country code");
    const pppIndicator = "PA.NUS.PRVT.PP";
    const exchangeRateIndicator = "PA.NUS.FCRF";
    const [destinationPpp, destinationRate, indiaPpp, indiaRate] = await Promise.all([
      getWorldBankSeries(countryCode, pppIndicator),
      getWorldBankSeries(countryCode, exchangeRateIndicator),
      getWorldBankSeries("IN", pppIndicator),
      getWorldBankSeries("IN", exchangeRateIndicator)
    ]);
    const destinationValues = {
      ppp: new Map(destinationPpp),
      rate: new Map(destinationRate)
    };
    const indiaValues = {
      ppp: new Map(indiaPpp),
      rate: new Map(indiaRate)
    };
    const commonYears = [...destinationValues.ppp.keys()]
      .filter((year) => destinationValues.rate.has(year) && indiaValues.ppp.has(year) && indiaValues.rate.has(year))
      .sort((a, b) => Number(b) - Number(a));
    const year = commonYears[0];
    if (!year) throw new Error("No common-year PPP and exchange-rate data is available");

    const destinationCostLevel = destinationValues.ppp.get(year) / destinationValues.rate.get(year);
    const indiaCostLevel = indiaValues.ppp.get(year) / indiaValues.rate.get(year);
    const index = countryCode === "IN" ? 1 : destinationCostLevel / indiaCostLevel;
    if (!Number.isFinite(index) || index <= 0) throw new Error("The World Bank cost index could not be calculated");

    sendJson(response, 200, {
      destination: place.name,
      country: place.country || "",
      countryCode,
      costIndex: Number(Math.min(5, Math.max(0.4, index)).toFixed(2)),
      year,
      source: "World Bank private-consumption PPP and official exchange-rate indicators",
      baseCountry: "India"
    });
  } catch (error) {
    console.error("Destination cost lookup failed:", error);
    sendJson(response, 502, { error: "Destination cost data is unavailable right now. The planner can use its India baseline instead." });
  }
}

async function searchTravel(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readJson(request, response);
  if (!body) return;
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const origin = typeof body.origin === "string" ? body.origin.trim().slice(0, 80) : "";
  const type = body.type === "flights" || body.type === "hotels" ? body.type : "";
  const dates = typeof body.dates === "string" ? body.dates.trim().slice(0, 80) : "";
  if (destination.length < 2 || destination.length > 120 || !type || (type === "flights" && !origin)) {
    sendJson(response, 400, { error: "Choose a destination and a valid flight or hotel search." });
    return;
  }

  const query = type === "flights"
    ? `current flight fares and flight booking options from ${origin} to ${destination}${dates ? ` for ${dates}` : ""}`
    : `current hotel accommodation options and hotel booking sites in ${destination}${dates ? ` for ${dates}` : ""}`;
  try {
    const data = await tavilySearch(query, { includeAnswer: true, maxResults: 6 });
    sendJson(response, 200, formatTavilyResults(data));
  } catch (error) {
    console.error(`${type} search failed:`, error);
    sendJson(response, error.status || 502, {
      error: error.status === 503 ? error.message : `Live ${type} search is temporarily unavailable. Please try again.`
    });
  }
}

async function placesAutocomplete(request, response, url) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const query = (url.searchParams.get("input") || url.searchParams.get("query") || "").trim().slice(0, 100);
  const type = (url.searchParams.get("type") || "destination").toLowerCase();
  if (query.length < 2) {
    sendJson(response, 200, { suggestions: [] });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey) {
    try {
      const googleUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      googleUrl.searchParams.set("input", query);
      googleUrl.searchParams.set("language", "en");
      googleUrl.searchParams.set("key", apiKey);
      if (type === "city") {
        googleUrl.searchParams.set("types", "(cities)");
      } else {
        googleUrl.searchParams.set("types", "(regions)");
      }

      const googleRes = await fetch(googleUrl, { signal: AbortSignal.timeout(8000) });
      if (googleRes.ok) {
        const data = await googleRes.json();
        if (data.status === "OK" && Array.isArray(data.predictions)) {
          const suggestions = data.predictions.map((p) => ({
            name: p.structured_formatting?.main_text || p.description.split(",")[0].trim(),
            secondary: p.structured_formatting?.secondary_text || "",
            description: p.description,
            placeId: p.place_id,
            types: p.types || [],
            source: "google"
          }));
          sendJson(response, 200, { suggestions, source: "google" });
          return;
        }
        if (data.status === "ZERO_RESULTS") {
          sendJson(response, 200, { suggestions: [], source: "google" });
          return;
        }
        console.warn(`Google Place Autocomplete returned status ${data.status}:`, data.error_message || "");
      }
    } catch (err) {
      console.error("Google Place Autocomplete request failed:", err);
    }
  }

  // Graceful fallback using Open-Meteo Geocoding
  try {
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
    const fallbackRes = await fetch(geocodeUrl, { signal: AbortSignal.timeout(8000) });
    if (fallbackRes.ok) {
      const geoData = await fallbackRes.json();
      const places = Array.isArray(geoData.results) ? geoData.results : [];
      const suggestions = places.map((place) => ({
        name: place.name,
        secondary: [place.admin1, place.country].filter(Boolean).join(", "),
        description: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
        country: place.country || "",
        countryCode: place.country_code || "",
        latitude: place.latitude,
        longitude: place.longitude,
        source: "geocoding"
      }));
      sendJson(response, 200, { suggestions, source: "geocoding" });
      return;
    }
  } catch (err) {
    console.error("Fallback location lookup failed:", err);
  }

  sendJson(response, 200, { suggestions: [], source: "none" });
}

function publicAppConfig(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(response, 200, {
    authProvider: "local",
    authEnabled: true,
    supabaseEnabled: false
  });
}

/* ---------- Local Authentication & Data Storage ---------- */
const dataDir = path.join(root, "data");
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.error("Could not create data directory:", err);
  }
}

const usersFile = path.join(dataDir, "users.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const tripsFile = path.join(dataDir, "trips.json");

function loadJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function saveJsonFile(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const newHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(newHash, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const refreshToken = crypto.randomBytes(32).toString("hex");
  const expiresIn = 30 * 24 * 60 * 60; // 30 days
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const sessions = loadJsonFile(sessionsFile, []);
  const now = Math.floor(Date.now() / 1000);
  const activeSessions = sessions.filter((s) => s && s.expiresAt > now);
  activeSessions.push({
    token,
    refreshToken,
    userId: user.id,
    expiresAt
  });
  saveJsonFile(sessionsFile, activeSessions);

  return {
    access_token: token,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      user_metadata: {
        full_name: user.name
      }
    }
  };
}

function authenticateRequest(request) {
  const authHeader = request.headers["authorization"] || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (request.headers["apikey"]) {
    token = request.headers["apikey"].trim();
  }
  if (!token) return null;

  const sessions = loadJsonFile(sessionsFile, []);
  const now = Math.floor(Date.now() / 1000);
  const session = sessions.find((s) => s && s.token === token && s.expiresAt > now);
  if (!session) return null;

  const users = loadJsonFile(usersFile, []);
  const user = users.find((u) => u && u.id === session.userId);
  if (!user) return null;

  return { user, session };
}

function seedDemoUserIfEmpty() {
  const users = loadJsonFile(usersFile, []);
  if (users.length === 0) {
    const demoPassword = "password123";
    const { hash, salt } = hashPassword(demoPassword);
    const demoUser = {
      id: "usr_demo_wanderly",
      email: "demo@wanderly.com",
      name: "Demo Explorer",
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };
    users.push(demoUser);
    saveJsonFile(usersFile, users);
    console.log("Seeded demo account: demo@wanderly.com / password123");
  }
}
seedDemoUserIfEmpty();

async function authRegister(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }
  const body = await readJson(request, response);
  if (!body) return;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : (body.data?.full_name || email.split("@")[0]);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: "Please enter a valid email address." });
    return;
  }
  if (!password || password.length < 6) {
    sendJson(response, 400, { error: "Password must be at least 6 characters long." });
    return;
  }

  const users = loadJsonFile(usersFile, []);
  if (users.some((u) => u && u.email === email)) {
    sendJson(response, 409, { error: "An account with this email already exists. Please sign in." });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    email,
    name: name || "Explorer",
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveJsonFile(usersFile, users);

  const session = createSession(newUser);
  sendJson(response, 201, session);
}

async function authLogin(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }
  const body = await readJson(request, response);
  if (!body) return;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    sendJson(response, 400, { error: "Email and password are required." });
    return;
  }

  const users = loadJsonFile(usersFile, []);
  const user = users.find((u) => u && u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    sendJson(response, 401, { error: "Invalid email or password. Please try again." });
    return;
  }

  const session = createSession(user);
  sendJson(response, 200, session);
}

async function authLogout(request, response) {
  const auth = authenticateRequest(request);
  if (auth) {
    const sessions = loadJsonFile(sessionsFile, []);
    const remaining = sessions.filter((s) => s && s.token !== auth.session.token);
    saveJsonFile(sessionsFile, remaining);
  }
  sendJson(response, 200, { message: "Signed out successfully." });
}

async function authRefresh(request, response) {
  const body = await readJson(request, response);
  const refreshToken = body?.refresh_token;
  if (!refreshToken) {
    sendJson(response, 400, { error: "refresh_token required" });
    return;
  }
  const sessions = loadJsonFile(sessionsFile, []);
  const session = sessions.find((s) => s && s.refreshToken === refreshToken);
  if (!session) {
    sendJson(response, 401, { error: "Invalid refresh token. Please sign in again." });
    return;
  }
  const users = loadJsonFile(usersFile, []);
  const user = users.find((u) => u && u.id === session.userId);
  if (!user) {
    sendJson(response, 401, { error: "User no longer exists." });
    return;
  }
  const newSession = createSession(user);
  sendJson(response, 200, newSession);
}

function authMe(request, response) {
  const auth = authenticateRequest(request);
  if (!auth) {
    sendJson(response, 401, { error: "Not authenticated" });
    return;
  }
  sendJson(response, 200, {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      user_metadata: { full_name: auth.user.name }
    }
  });
}

async function authTrips(request, response) {
  const auth = authenticateRequest(request);
  if (!auth) {
    sendJson(response, 401, { error: "Sign in required to view or save trips." });
    return;
  }
  const allTrips = loadJsonFile(tripsFile, {});

  if (request.method === "GET") {
    const userTrips = allTrips[auth.user.id] || [];
    sendJson(response, 200, { saved_trips: userTrips });
    return;
  }

  if (request.method === "POST") {
    const body = await readJson(request, response);
    if (!body) return;
    const trips = Array.isArray(body.saved_trips) ? body.saved_trips.slice(0, 20) : [];
    allTrips[auth.user.id] = trips;
    saveJsonFile(tripsFile, allTrips);
    sendJson(response, 200, { success: true, saved_trips: trips });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}
function _discardOld() {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

// delete_start
// replaced_public_key
  let supabaseUrl = "";
  try {
    const parsedUrl = new URL(configuredUrl);
    if (["http:", "https:"].includes(parsedUrl.protocol) && !parsedUrl.username && !parsedUrl.password) {
      supabaseUrl = parsedUrl.origin;
    }
  } catch {
// replaced_err
  }

  sendJson(response, 200, {
    supabaseUrl,
    supabaseKey: publicKey,
// replaced_bool
  });
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (pathname.startsWith("/api/") && !allowApiRequest(request, response)) return;

  if (pathname === "/api/auth/register" || pathname === "/api/auth/signup") {
    await authRegister(request, response);
    return;
  }
  if (pathname === "/api/auth/login" || pathname === "/api/auth/signin") {
    await authLogin(request, response);
    return;
  }
  if (pathname === "/api/auth/logout" || pathname === "/api/auth/signout") {
    await authLogout(request, response);
    return;
  }
  if (pathname === "/api/auth/refresh") {
    await authRefresh(request, response);
    return;
  }
  if (pathname === "/api/auth/me") {
    authMe(request, response);
    return;
  }
  if (pathname === "/api/auth/trips") {
    await authTrips(request, response);
    return;
  }
  if (pathname === "/api/config") {
    publicAppConfig(request, response);
    return;
  }
  if (pathname === "/api/autocomplete" || pathname === "/api/places-autocomplete") {
    await placesAutocomplete(request, response, new URL(request.url, "http://localhost"));
    return;
  }
  if (pathname === "/api/search") {
    await searchDestinations(request, response);
    return;
  }
  if (pathname === "/api/plan") {
    await planTrip(request, response);
    return;
  }
  if (pathname === "/api/explore") {
    await exploreDestination(request, response, new URL(request.url, "http://localhost"));
    return;
  }
  if (pathname === "/api/cost-profile") {
    await costProfile(request, response, new URL(request.url, "http://localhost"));
    return;
  }
  if (pathname === "/api/travel-search") {
    await searchTravel(request, response);
    return;
  }

  const basename = path.basename(pathname).toLowerCase();
  if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) {
    response.writeHead(404).end("Not found");
    return;
  }

  const filePath = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      const status = statError.code === "ENOENT" || statError.code === "ENOTDIR" ? 404 : 500;
      response.writeHead(status).end(status === 404 ? "Not found" : "Unable to access file");
      if (status === 500) console.error(statError);
      return;
    }
    if (!stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", (error) => {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end("Unable to read file");
    });
    stream.pipe(response);
  });
});

const port = Number(process.env.PORT) || 5173;
server.listen(port, "127.0.0.1", () => {
  console.log(`Wanderly is running at http://localhost:${port}`);
});
