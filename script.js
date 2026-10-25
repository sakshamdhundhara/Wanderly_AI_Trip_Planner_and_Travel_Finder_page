/* =========================================================
   Wanderly — interactive travel landing page
   Vanilla JS, no dependencies.
   ---------------------------------------------------------
   1. Helpers & storage
   2. Site chrome (header, nav, progress, reveal, counters)
   3. Hero slider
   4. Data
   5. Search, filters & sorting
   6. Saved places
   7. Destination modal & journal articles
   8. Trip booking drawer
   9. Trip planner
  10. Stories carousel
  11. FAQ, forms, toasts, misc
   ========================================================= */
document.documentElement.classList.add("js");

/* ---------- 1. Helpers & storage ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`wanderly:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`wanderly:${key}`, JSON.stringify(value)); } catch { /* private mode */ }
  },
  remove(key) {
    try { localStorage.removeItem(`wanderly:${key}`); } catch { /* noop */ }
  }
};

const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function highlightMatch(text, query) {
  const safeText = escapeHTML(text);
  if (!query || !query.trim()) return safeText;
  const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safeQuery})`, "gi");
  return safeText.replace(regex, "<mark>$1</mark>");
}

function toast(title, message = "", icon = "✳") {
  const stack = $("#toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><strong></strong><small></small></div>`;
  el.querySelector("strong").textContent = title;
  el.querySelector("small").textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 320);
  }, 3800);
}

/* ---------- 2. Site chrome ---------- */
const header = $("#header");
const progress = $("#scroll-progress");
const toTop = $("#to-top");
let ticking = false;

function onScroll() {
  const y = window.scrollY;
  const h = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.width = `${h > 0 ? (y / h) * 100 : 0}%`;
  if (header) header.classList.toggle("is-stuck", y > 12);
  if (toTop) toTop.hidden = y < 620;
  ticking = false;
}
window.addEventListener("scroll", () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
onScroll();

toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

/* mobile menu */
const menuToggle = $("#menu-toggle");
const navLinks = $("#nav-links");
function closeMenu() {
  navLinks?.classList.remove("is-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}
menuToggle?.addEventListener("click", () => {
  const open = navLinks?.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(!!open));
});
$$(".nav-link").forEach((link) => link.addEventListener("click", closeMenu));

/* active nav link while scrolling */
const sections = $$("main section[id]");
if ("IntersectionObserver" in window && sections.length) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      $$(".nav-link").forEach((l) =>
        l.classList.toggle("is-active", l.getAttribute("href") === `#${id}`)
      );
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => navObserver.observe(s));
}

/* reveal on scroll */
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      const delay = Number(entry.target.dataset.delay || 0);
      setTimeout(() => entry.target.classList.add("is-in"), delay + i * 40);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el, i) => {
    if (i < 4) el.dataset.delay = String(i * 90);
    revealObserver.observe(el);
  });
} else {
  $$(".reveal").forEach((el) => el.classList.add("is-in"));
}

/* animated counters */
const counters = $$("[data-count]");
if (counters.length && "IntersectionObserver" in window) {
  const countObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const suffix = el.dataset.suffix || "";
      const duration = reducedMotion ? 0 : 1300;
      const start = performance.now();
      const step = (now) => {
        const p = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const value = target * eased;
        el.textContent = (decimals ? value.toFixed(decimals) : Math.floor(value).toLocaleString("en-IN")) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => countObserver.observe(c));
}

/* ---------- 3. Hero slider ---------- */
(() => {
  const slides = $$(".hero-slide");
  const dots = $$(".hero-dot");
  const caption = $("#hero-caption");
  if (!slides.length) return;
  const captions = [
    "Lake Braies · Dolomites, Italy",
    "Lago di Carezza · Dolomites, Italy",
    "Sunrise above the clouds · Himachal, India",
    "Milky Way over the peaks · Ladakh, India"
  ];
  let index = 0;
  let timer;

  function go(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle("is-active", n === index));
    dots.forEach((d, n) => {
      d.classList.toggle("is-active", n === index);
      d.setAttribute("aria-selected", String(n === index));
    });
    if (caption) caption.textContent = captions[index] || captions[0];
  }
  function play() {
    if (reducedMotion) return;
    clearInterval(timer);
    timer = setInterval(() => go(index + 1), 5600);
  }
  dots.forEach((d) => d.addEventListener("click", () => { go(Number(d.dataset.slide)); play(); }));
  const frame = $(".hero-frame");
  frame?.addEventListener("mouseenter", () => clearInterval(timer));
  frame?.addEventListener("mouseleave", play);
  frame?.addEventListener("focusin", () => clearInterval(timer));
  play();
})();

/* ---------- 4. Data ---------- */
const DESTINATIONS = {
  kyoto: {
    name: "Kyoto", country: "Japan", title: "Slow Days in Kyoto",
    img: "assets/kyoto.jpg", days: 6, nights: 5, price: 68500, rating: 4.9, reviewCount: 486,
    group: 12, difficulty: "Easy", best: "March–May, October–November",
    styles: ["culture", "cities", "mountains"],
    months: ["Mar", "Apr", "May", "Oct", "Nov"],
    summary: "Six days in Japan's old capital, built around three neighbourhoods instead of a checklist. Think temple bells at 6am, a bicycle through quiet backstreets and dinner at a counter with eight seats.",
    highlights: [
      { icon: "⛩", title: "Fushimi at first light", text: "We walk the torii gates before 7am — you will share them with foxes, not crowds." },
      { icon: "🍜", title: "Counter dinners", text: "Three family-run kitchens, chosen by our Kyoto guide Rina, who grew up two streets away." },
      { icon: "🎋", title: "Arashiyama by bike", text: "A bamboo grove, a riverbank lunch and the long way home along the Katsura." },
      { icon: "🍵", title: "A tea afternoon", text: "A small matcha workshop with a 4th-generation tea grower from Uji." },
      { icon: "🏯", title: "One big temple, unhurried", text: "We pick Kiyomizu-dera and give it a full morning instead of twenty minutes." },
      { icon: "🚆", title: "A day in Nara", text: "Deer, a giant bronze Buddha and the best mochi of the trip, 45 minutes away." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive & settle in Gion", text: "Airport pickup, a slow walk along the Shirakawa canal and an easy first dinner." },
      { day: "Day 2", title: "Temples before the crowds", text: "Fushimi Inari at sunrise, breakfast near Kyoto Station, free afternoon." },
      { day: "Day 3", title: "Arashiyama by bike", text: "Bamboo grove, riverside lunch, monkey park or a nap — your call." },
      { day: "Day 4", title: "Uji tea & Nara deer", text: "Morning matcha workshop, afternoon in Nara, back for a late ramen." },
      { day: "Day 5", title: "Craft & kitchen day", text: "A block-print studio visit, Nishiki market tasting walk, farewell dinner." },
      { day: "Day 6", title: "Depart", text: "Breakfast, a last coffee, transfer to Kansai airport." }
    ],
    reviews: [
      { name: "Ananya Sharma", trip: "March 2026", initials: "A", stars: 5, text: "The early temple morning alone was worth the trip. Rina knew every shopkeeper by name." },
      { name: "Dev Kapoor", trip: "November 2025", initials: "D", stars: 5, text: "Slow in the best way. We never queued for anything and still saw everything we wanted." }
    ]
  },
  amalfi: {
    name: "Amalfi Coast", country: "Italy", title: "The Amalfi Feeling",
    img: "assets/amalfi.jpg", days: 5, nights: 4, price: 92000, rating: 4.8, reviewCount: 312,
    group: 12, difficulty: "Easy", best: "April–June, September–October",
    styles: ["beaches", "culture"],
    months: ["Apr", "May", "Jun", "Sep", "Oct"],
    summary: "Cliff villages, lemon groves and long lunches that quietly turn into dinner. A coastal week with a boat day, a cooking afternoon and no 7am coach departures.",
    highlights: [
      { icon: "⛵", title: "Private gozzo day", text: "A wooden boat, a cool box and swimming stops only locals know." },
      { icon: "🍋", title: "Lemon grove lunch", text: "Four courses under a pergola in Ravello, cooked by the family that owns it." },
      { icon: "🥾", title: "Path of the Gods", text: "A guided ridge walk above the coast, downhill and shaded before noon." },
      { icon: "🍝", title: "Pasta afternoon", text: "Hand-rolled scialatielli with a chef who has taught the same recipe for 30 years." },
      { icon: "🌅", title: "Positano at golden hour", text: "The view everyone photographs — with a table already booked." },
      { icon: "🍷", title: "Furore wine cellar", text: "A tiny terraced vineyard and a tasting with the winemaker." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive in Positano", text: "Ferry transfer, sunset aperitivo and a first seaside dinner." },
      { day: "Day 2", title: "Boat day", text: "Swim stops at Li Galli, lunch on board, back for a slow evening." },
      { day: "Day 3", title: "Ravello & the ridge", text: "Villa gardens, lemon lunch and the Path of the Gods with a local guide." },
      { day: "Day 4", title: "Amalfi & cooking", text: "Old town walk, paper museum, pasta class and a long table dinner." },
      { day: "Day 5", title: "Depart", text: "Morning swim, breakfast, transfer to Naples." }
    ],
    reviews: [
      { name: "Rohan Mehta", trip: "June 2026", initials: "R", stars: 5, text: "The boat day was the single best day of our year. Nothing felt rushed." },
      { name: "Ishita Bose", trip: "September 2025", initials: "I", stars: 4, text: "Beautiful. Bring good shoes — the steps are no joke, but the guide paced it well." }
    ]
  },
  himachal: {
    name: "Himachal", country: "India", title: "Into the Mountains",
    img: "assets/himachal.jpg", days: 7, nights: 6, price: 28900, rating: 5.0, reviewCount: 604,
    group: 9, difficulty: "Moderate", best: "March–June, September–December",
    styles: ["mountains", "adventure"],
    months: ["Mar", "Apr", "May", "Jun", "Sep", "Oct", "Nov", "Dec"],
    summary: "Pine forests, monastery mornings and the kind of silence you can actually hear. A week above the treeline with homestays, short hikes and a lot of chai.",
    highlights: [
      { icon: "🏔", title: "Sunrise above the clouds", text: "A short pre-dawn walk to a ridge with a 180° Himalayan view." },
      { icon: "🛕", title: "Monastery morning", text: "Butter lamps, morning chants and breakfast with the monks." },
      { icon: "🥾", title: "Three gentle hikes", text: "Between 4 and 9 km, always with a tea stop and a jeep backup." },
      { icon: "🏡", title: "Family homestays", text: "Two nights with a local family — siddu, rajma and stories by the bukhari." },
      { icon: "🌌", title: "Stargazing night", text: "No light pollution for 40km. We bring the blankets and the telescope." },
      { icon: "🛶", title: "River afternoon", text: "Riverside picnic and optional rafting on the Beas." }
    ],
    itinerary: [
      { day: "Day 1", title: "Chandigarh → Bir", text: "Scenic drive, monastery visit and a first mountain sunset." },
      { day: "Day 2", title: "Bir meadows", text: "A 6km walk through tea gardens and pine forest, paragliding optional." },
      { day: "Day 3", title: "Village homestay", text: "Drive to a smaller village, cook dinner with the family." },
      { day: "Day 4", title: "Ridge day", text: "Pre-dawn hike for sunrise, long lunch, free afternoon." },
      { day: "Day 5", title: "Riverside & rafting", text: "Beas river picnic, optional grade-II rafting." },
      { day: "Day 6", title: "Stargazing", text: "Slow morning, local market, night sky session with a guide." },
      { day: "Day 7", title: "Depart", text: "Breakfast and drive back to Chandigarh." }
    ],
    reviews: [
      { name: "Priya Verma", trip: "September 2026", initials: "P", stars: 5, text: "We took our parents and it worked perfectly — the guide called every evening." },
      { name: "Arjun Sethi", trip: "May 2026", initials: "A", stars: 5, text: "Nine people, one jeep, zero stress. The stargazing night is unforgettable." }
    ]
  },
  bali: {
    name: "Bali", country: "Indonesia", title: "Bali, Slowly",
    img: "assets/bali.jpg", days: 6, nights: 5, price: 54200, rating: 4.7, reviewCount: 398,
    group: 12, difficulty: "Easy", best: "April–September",
    styles: ["beaches", "culture", "adventure"],
    months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    summary: "Rice terraces at sunrise, waterfall swims and warungs worth the detour. Ubud first, then the quiet north coast — no beach-club crawls.",
    highlights: [
      { icon: "🌾", title: "Terraces before breakfast", text: "A 6am walk through Jatiluwih with farmers heading out to work." },
      { icon: "💧", title: "Waterfall swim", text: "Two falls, one crowded, one secret. We go to the second." },
      { icon: "🧘", title: "Morning yoga", text: "Optional rooftop session overlooking the valley, mats provided." },
      { icon: "🍛", title: "Warung crawl", text: "Five family kitchens in one afternoon, guided by a local food writer." },
      { icon: "🛕", title: "Temple etiquette", text: "A proper visit with a priest's explanation, not a photo stop." },
      { icon: "🚲", title: "Village by bicycle", text: "Flat lanes, rice fields and a coconut stop that lasts an hour." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive in Ubud", text: "Airport pickup, market walk and a first Balinese dinner." },
      { day: "Day 2", title: "Terraces & falls", text: "Sunrise walk, waterfall swim, afternoon free." },
      { day: "Day 3", title: "Food & craft", text: "Warung crawl, silver workshop, evening dance performance." },
      { day: "Day 4", title: "North coast", text: "Drive over the ridge to Amed, sunset on the black-sand beach." },
      { day: "Day 5", title: "Reef morning", text: "Snorkelling, hammock afternoon, farewell seafood dinner." },
      { day: "Day 6", title: "Depart", text: "Breakfast and transfer to Denpasar." }
    ],
    reviews: [
      { name: "Meera Iyer", trip: "July 2026", initials: "M", stars: 5, text: "The homestay family still messages us on festivals. That tells you everything." },
      { name: "Nikhil Rao", trip: "May 2026", initials: "N", stars: 4, text: "Lovely pace. North coast was the surprise highlight — glad it wasn't all Ubud." }
    ]
  },
  jaipur: {
    name: "Jaipur", country: "India", title: "Pink City Diaries",
    img: "assets/jaipur.jpg", days: 4, nights: 3, price: 18600, rating: 4.8, reviewCount: 521,
    group: 12, difficulty: "Easy", best: "October–March",
    styles: ["culture", "cities"],
    months: ["Jan", "Feb", "Oct", "Nov", "Dec"],
    summary: "Fort sunrises, block-print workshops and the best kachori of your life. A four-day heritage weekend that skips the tourist traps and eats extremely well.",
    highlights: [
      { icon: "🏰", title: "Fort sunrise", text: "Nahargarh at 6:30am with chai, before the heat and the buses." },
      { icon: "🖨", title: "Block printing", text: "A hands-on session with a family workshop in Sanganer." },
      { icon: "🍽", title: "Old-city food walk", text: "Pyaaz kachori, lassi, dal baati and a rooftop dinner." },
      { icon: "💎", title: "Gem & jewellery", text: "A cutting workshop and honest, no-pressure browsing." },
      { icon: "🏛", title: "City Palace & Hawa Mahal", text: "A guided morning with an architectural historian." },
      { icon: "🐘", title: "Ethical elephant morning", text: "A sanctuary visit focused on care, not rides." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive & old city", text: "Check in, sunset at Nahargarh, dinner on a rooftop." },
      { day: "Day 2", title: "Forts & palaces", text: "Amber Fort early, City Palace, free afternoon." },
      { day: "Day 3", title: "Craft & food", text: "Block printing, gem workshop, evening food walk." },
      { day: "Day 4", title: "Depart", text: "Slow breakfast, last shopping stop, airport transfer." }
    ],
    reviews: [
      { name: "Sara Khan", trip: "November 2025", initials: "S", stars: 5, text: "I grew up in Pune and still learned things about Rajasthan. Superbly guided." },
      { name: "Vikram Joshi", trip: "February 2026", initials: "V", stars: 4, text: "Food walk was the highlight. Wish we had one more day." }
    ]
  },
  maldives: {
    name: "Maldives", country: "Maldives", title: "Overwater Escape",
    img: "assets/maldives.jpg", days: 5, nights: 4, price: 124000, rating: 4.9, reviewCount: 267,
    group: 10, difficulty: "Easy", best: "November–March",
    styles: ["beaches"],
    months: ["Jan", "Feb", "Mar", "Nov", "Dec"],
    summary: "Reef mornings, a hammock that fits your whole afternoon, zero notifications. A short, deeply unhurried island stay with a local-island day built in.",
    highlights: [
      { icon: "🐠", title: "House reef", text: "Turtles and reef sharks fifty metres from your deck." },
      { icon: "🛶", title: "Sunset dhoni", text: "A traditional boat, dolphin pods and no engine noise." },
      { icon: "🏝", title: "Local island day", text: "A fishing village, a school visit and lunch with a family." },
      { icon: "🤿", title: "Two guided dives", text: "For beginners or certified divers, gear included." },
      { icon: "🌊", title: "Sandbank picnic", text: "A sandbar that disappears at high tide. We pack accordingly." },
      { icon: "💆", title: "One spa afternoon", text: "An open-air treatment with the reef below your table." }
    ],
    itinerary: [
      { day: "Day 1", title: "Seaplane & settle", text: "Transfer, villa check-in, sunset on the west deck." },
      { day: "Day 2", title: "Reef day", text: "Snorkel briefing, house reef, afternoon free." },
      { day: "Day 3", title: "Local island", text: "Village morning, family lunch, dhoni sunset cruise." },
      { day: "Day 4", title: "Sandbank & spa", text: "Private sandbank picnic, spa afternoon, farewell dinner." },
      { day: "Day 5", title: "Depart", text: "Breakfast and seaplane transfer." }
    ],
    reviews: [
      { name: "Kabir Nair", trip: "February 2026", initials: "K", stars: 5, text: "The invoice matched the estimate exactly. No surprise city tax at checkout." },
      { name: "Tara Menon", trip: "December 2025", initials: "T", stars: 5, text: "The local island day made it feel like a real place, not just a resort." }
    ]
  }
};

const ALL_DESTINATIONS = [
  // Wanderly signature destinations
  { name: "Kyoto", country: "Japan", region: "East Asia", tag: "Culture & temples", styles: ["culture", "cities", "mountains"], img: "assets/kyoto.jpg", icon: "⛩" },
  { name: "Amalfi Coast", country: "Italy", region: "Southern Europe", tag: "Cliff villages & turquoise sea", styles: ["beaches", "culture"], img: "assets/amalfi.jpg", icon: "🍋" },
  { name: "Himachal Pradesh", country: "India", region: "Western Himalayas", tag: "Pine forests & snow peaks", styles: ["mountains", "adventure"], img: "assets/himachal.jpg", icon: "🏔" },
  { name: "Bali", country: "Indonesia", region: "Southeast Asia", tag: "Rice terraces & coastal sunsets", styles: ["beaches", "culture", "adventure"], img: "assets/bali.jpg", icon: "🌴" },
  { name: "Jaipur", country: "India", region: "Rajasthan", tag: "Pink City palaces & craft heritage", styles: ["culture", "cities"], img: "assets/jaipur.jpg", icon: "🏰" },
  { name: "Maldives", country: "Maldives", region: "Indian Ocean", tag: "Overwater villas & house reefs", styles: ["beaches", "relaxation"], img: "assets/maldives.jpg", icon: "🐠" },
  { name: "Dolomites", country: "Italy", region: "Italian Alps", tag: "Mirror lakes & rifugio trails", styles: ["mountains", "adventure"], img: "assets/trip-dolomites.jpg", icon: "⛰" },
  { name: "Goa", country: "India", region: "Konkan Coast", tag: "Quiet shores & Portuguese bakeries", styles: ["beaches", "relaxation"], img: "assets/trip-goa.jpg", icon: "⛵" },
  { name: "Meghalaya", country: "India", region: "Northeast India", tag: "Root bridges & misty cloud trails", styles: ["mountains", "adventure", "nature"], img: "assets/trip-meghalaya.jpg", icon: "🌿" },

  // Renowned world destinations
  { name: "Patagonia", country: "Argentina & Chile", region: "South America", tag: "Glaciers, peaks & wild trails", styles: ["adventure", "mountains", "nature"], icon: "🥾" },
  { name: "Swiss Alps", country: "Switzerland", region: "Central Europe", tag: "Matterhorn, scenic trains & meadows", styles: ["mountains", "nature"], icon: "🏔" },
  { name: "Santorini", country: "Greece", region: "Cyclades", tag: "Caldera sunsets & whitewashed cliffs", styles: ["beaches", "culture", "relaxation"], icon: "🏛" },
  { name: "Tokyo", country: "Japan", region: "East Asia", tag: "Modern neon, ramen & historic shrines", styles: ["cities", "culture", "food"], icon: "🗼" },
  { name: "Paris", country: "France", region: "Western Europe", tag: "Art, architecture & Seine promenades", styles: ["cities", "culture", "food"], icon: "🥐" },
  { name: "Rome", country: "Italy", region: "Southern Europe", tag: "Ancient Colosseum, piazzas & food", styles: ["cities", "culture", "food"], icon: "🏛" },
  { name: "Barcelona", country: "Spain", region: "Catalonia", tag: "Gaudí architecture & Mediterranean coast", styles: ["cities", "beaches", "culture"], icon: "🎨" },
  { name: "Iceland", country: "Iceland", region: "Nordic Europe", tag: "Waterfalls, black sand & auroras", styles: ["adventure", "nature"], icon: "🌌" },
  { name: "Dubai", country: "United Arab Emirates", region: "Middle East", tag: "Futuristic skyline & desert dunes", styles: ["cities", "luxury"], icon: "✨" },
  { name: "New York City", country: "United States", region: "North America", tag: "Central Park, Broadway & museums", styles: ["cities", "culture"], icon: "🗽" },
  { name: "London", country: "United Kingdom", region: "Western Europe", tag: "Historic theatres, parks & riverwalks", styles: ["cities", "culture"], icon: "💂" },
  { name: "Queenstown", country: "New Zealand", region: "South Island", tag: "Fjords, alpine lakes & outdoor adventures", styles: ["adventure", "mountains", "nature"], icon: "🛶" },
  { name: "Banff & Lake Louise", country: "Canada", region: "Rocky Mountains", tag: "Turquoise lakes & pine wilderness", styles: ["mountains", "nature"], icon: "🌲" },
  { name: "Bangkok & Phuket", country: "Thailand", region: "Southeast Asia", tag: "Night markets, temples & island beaches", styles: ["beaches", "food", "culture"], icon: "🍜" },
  { name: "Cairo & Giza", country: "Egypt", region: "North Africa", tag: "Great Pyramids & Nile river voyages", styles: ["culture", "adventure"], icon: "🐪" },
  { name: "Machu Picchu", country: "Peru", region: "Andes", tag: "Inca citadel in the cloud forest", styles: ["adventure", "culture", "mountains"], icon: "⛰" },
  { name: "Prague", country: "Czech Republic", region: "Central Europe", tag: "Bohemian castles & historic squares", styles: ["cities", "culture"], icon: "🏰" },
  { name: "Amsterdam", country: "Netherlands", region: "Western Europe", tag: "Canals, art museums & cycling", styles: ["cities", "culture"], icon: "🚲" },
  { name: "Florence & Tuscany", country: "Italy", region: "Southern Europe", tag: "Renaissance art, vineyards & hills", styles: ["culture", "food"], icon: "🍷" },
  { name: "Istanbul", country: "Turkey", region: "Eurasia", tag: "Historic bazaars & Bosphorus views", styles: ["culture", "cities", "food"], icon: "🕌" },
  { name: "Cape Town", country: "South Africa", region: "Southern Africa", tag: "Table Mountain, coastal drives & bays", styles: ["adventure", "beaches", "nature"], icon: "🌊" },
  { name: "Ha Long Bay & Hanoi", country: "Vietnam", region: "Southeast Asia", tag: "Emerald waters & street food culture", styles: ["nature", "food", "culture"], icon: "🛶" },
  { name: "Marrakech", country: "Morocco", region: "North Africa", tag: "Medina souks, riads & desert gateways", styles: ["culture", "adventure"], icon: "🏺" },
  { name: "Lofoten Islands", country: "Norway", region: "Nordic Europe", tag: "Arctic fjords & midnight sun", styles: ["mountains", "nature", "adventure"], icon: "❄" },
  { name: "Vienna", country: "Austria", region: "Central Europe", tag: "Imperial palaces & historic coffeehouses", styles: ["cities", "culture"], icon: "☕" },
  { name: "Dubrovnik", country: "Croatia", region: "Adriatic Coast", tag: "Medieval walls & crystal sea", styles: ["beaches", "culture"], icon: "🏰" },
  { name: "Seoul", country: "South Korea", region: "East Asia", tag: "Ancient palaces, K-culture & street food", styles: ["cities", "culture", "food"], icon: "🥢" },
  { name: "Singapore", country: "Singapore", region: "Southeast Asia", tag: "Futuristic gardens & vibrant street food", styles: ["cities", "nature", "family"], icon: "🌺" },
  { name: "Sri Lanka", country: "Sri Lanka", region: "South Asia", tag: "Scenic hill trains, surf & wildlife", styles: ["beaches", "nature", "culture"], icon: "🐘" },
  { name: "Nepal & Everest", country: "Nepal", region: "Himalayas", tag: "High passes, monasteries & trekking", styles: ["mountains", "adventure"], icon: "🧗" },

  // Renowned Indian destinations
  { name: "Ladakh", country: "India", region: "Trans-Himalayas", tag: "Monasteries, high passes & starry skies", styles: ["mountains", "adventure"], icon: "🌌" },
  { name: "Spiti Valley", country: "India", region: "Himachal Pradesh", tag: "Moonscape valleys & ancient gompas", styles: ["mountains", "adventure"], icon: "🏔" },
  { name: "Kerala Backwaters", country: "India", region: "Kerala", tag: "Houseboats, coconut lagoons & tea hills", styles: ["nature", "relaxation"], icon: "🛶" },
  { name: "Kashmir", country: "India", region: "Jammu & Kashmir", tag: "Dal Lake shikaras & snow valleys", styles: ["mountains", "nature"], icon: "🌸" },
  { name: "Udaipur", country: "India", region: "Rajasthan", tag: "Lake palaces & marble courtyards", styles: ["culture", "cities"], icon: "🏰" },
  { name: "Varanasi", country: "India", region: "Uttar Pradesh", tag: "Ancient ghats, Ganga aarti & old alleys", styles: ["culture"], icon: "🛕" },
  { name: "Andaman Islands", country: "India", region: "Bay of Bengal", tag: "White sand shores & turquoise diving", styles: ["beaches", "adventure"], icon: "🏝" },
  { name: "Rishikesh", country: "India", region: "Uttarakhand", tag: "Yoga retreats, river rafting & foothills", styles: ["adventure", "relaxation"], icon: "🧘" },
  { name: "Darjeeling & Sikkim", country: "India", region: "Eastern Himalayas", tag: "Tea estates & Kanchenjunga sunrises", styles: ["mountains", "nature"], icon: "🍵" },
  { name: "Hampi", country: "India", region: "Karnataka", tag: "Boulder landscapes & historic ruins", styles: ["culture", "adventure"], icon: "🏛" },
  { name: "Jaisalmer", country: "India", region: "Rajasthan", tag: "Golden sandstone fort & desert dunes", styles: ["culture", "adventure"], icon: "🐪" },
  { name: "Rann of Kutch", country: "India", region: "Gujarat", tag: "Endless white salt desert & moonlit nights", styles: ["culture", "nature"], icon: "✨" },
  { name: "Coorg", country: "India", region: "Karnataka", tag: "Coffee plantations & misty waterfalls", styles: ["nature", "relaxation"], icon: "☕" },
  { name: "Munnar", country: "India", region: "Kerala", tag: "Lush tea carpets & cool mountain air", styles: ["mountains", "nature"], icon: "🍃" },
  { name: "Ooty", country: "India", region: "Tamil Nadu", tag: "Nilgiri toy train & botanical hills", styles: ["mountains", "nature"], icon: "🚂" },
  { name: "Pondicherry", country: "India", region: "Puducherry", tag: "French colonial quarters & seaside cafes", styles: ["beaches", "culture"], icon: "🥖" },
  { name: "Manali", country: "India", region: "Himachal Pradesh", tag: "Cedar forests & high Himalayan routes", styles: ["mountains", "adventure"], icon: "⛷" },
  { name: "Shimla", country: "India", region: "Himachal Pradesh", tag: "Colonial ridge walks & pine paths", styles: ["mountains", "culture"], icon: "🌲" },
  { name: "Agra", country: "India", region: "Uttar Pradesh", tag: "Taj Mahal & Mughal architectural gems", styles: ["culture"], icon: "🕌" },
  { name: "Kaziranga", country: "India", region: "Assam", tag: "One-horned rhino safaris & wetlands", styles: ["nature", "adventure"], icon: "🦏" }
];

const ALL_STARTING_CITIES = [
  // Major Indian departure hubs
  { name: "Jaipur", region: "Rajasthan", country: "India", code: "JAI", tag: "Pink City airport hub", popular: true },
  { name: "New Delhi", region: "Delhi NCR", country: "India", code: "DEL", tag: "Indira Gandhi International (DEL)", popular: true },
  { name: "Mumbai", region: "Maharashtra", country: "India", code: "BOM", tag: "Chhatrapati Shivaji Maharaj (BOM)", popular: true },
  { name: "Bengaluru", region: "Karnataka", country: "India", code: "BLR", tag: "Kempegowda International (BLR)", popular: true },
  { name: "Hyderabad", region: "Telangana", country: "India", code: "HYD", tag: "Rajiv Gandhi International (HYD)", popular: true },
  { name: "Chennai", region: "Tamil Nadu", country: "India", code: "MAA", tag: "Chennai International (MAA)", popular: true },
  { name: "Kolkata", region: "West Bengal", country: "India", code: "CCU", tag: "Netaji Subhash Chandra Bose (CCU)", popular: true },
  { name: "Pune", region: "Maharashtra", country: "India", code: "PNQ", tag: "Pune Airport (PNQ)", popular: true },
  { name: "Ahmedabad", region: "Gujarat", country: "India", code: "AMD", tag: "Sardar Vallabhbhai Patel (AMD)", popular: true },
  { name: "Kochi", region: "Kerala", country: "India", code: "COK", tag: "Cochin International (COK)", popular: true },
  { name: "Goa", region: "Goa", country: "India", code: "GOX", tag: "Dabolim & Mopa (GOI / GOX)", popular: true },
  { name: "Chandigarh", region: "Punjab & Haryana", country: "India", code: "IXC", tag: "Shaheed Bhagat Singh (IXC)", popular: true },
  { name: "Lucknow", region: "Uttar Pradesh", country: "India", code: "LKO", tag: "Chaudhary Charan Singh (LKO)", popular: false },
  { name: "Indore", region: "Madhya Pradesh", country: "India", code: "IDR", tag: "Devi Ahilya Bai Holkar (IDR)", popular: false },
  { name: "Surat", region: "Gujarat", country: "India", code: "STV", tag: "Surat International (STV)", popular: false },
  { name: "Bhubaneswar", region: "Odisha", country: "India", code: "BBI", tag: "Biju Patnaik Airport (BBI)", popular: false },
  { name: "Coimbatore", region: "Tamil Nadu", country: "India", code: "CJB", tag: "Coimbatore International (CJB)", popular: false },
  { name: "Thiruvananthapuram", region: "Kerala", country: "India", code: "TRV", tag: "Trivandrum International (TRV)", popular: false },
  { name: "Guwahati", region: "Assam", country: "India", code: "GAU", tag: "Lokpriya Gopinath Bordoloi (GAU)", popular: false },
  { name: "Amritsar", region: "Punjab", country: "India", code: "ATQ", tag: "Sri Guru Ram Dass Jee (ATQ)", popular: false },
  { name: "Vadodara", region: "Gujarat", country: "India", code: "BDQ", tag: "Vadodara Airport (BDQ)", popular: false },
  { name: "Visakhapatnam", region: "Andhra Pradesh", country: "India", code: "VTZ", tag: "Visakhapatnam Airport (VTZ)", popular: false },
  { name: "Bhopal", region: "Madhya Pradesh", country: "India", code: "BHO", tag: "Raja Bhoj Airport (BHO)", popular: false },
  { name: "Patna", region: "Bihar", country: "India", code: "PAT", tag: "Jay Prakash Narayan (PAT)", popular: false },
  { name: "Dehradun", region: "Uttarakhand", country: "India", code: "DED", tag: "Jolly Grant Airport (DED)", popular: false },
  { name: "Varanasi", region: "Uttar Pradesh", country: "India", code: "VNS", tag: "Lal Bahadur Shastri (VNS)", popular: false },
  { name: "Mangalore", region: "Karnataka", country: "India", code: "IXE", tag: "Mangalore International (IXE)", popular: false },
  { name: "Nagpur", region: "Maharashtra", country: "India", code: "NAG", tag: "Dr. Babasaheb Ambedkar (NAG)", popular: false },
  { name: "Ranchi", region: "Jharkhand", country: "India", code: "IXR", tag: "Birsa Munda Airport (IXR)", popular: false },
  { name: "Raipur", region: "Chhattisgarh", country: "India", code: "RPR", tag: "Swami Vivekananda Airport (RPR)", popular: false },
  { name: "Srinagar", region: "Jammu & Kashmir", country: "India", code: "SXR", tag: "Sheikh ul-Alam (SXR)", popular: false },
  { name: "Udaipur", region: "Rajasthan", country: "India", code: "UDR", tag: "Maharana Pratap Airport (UDR)", popular: false },
  { name: "Jodhpur", region: "Rajasthan", country: "India", code: "JDH", tag: "Jodhpur Airport (JDH)", popular: false },

  // Key international transit and departure hubs
  { name: "Dubai", region: "Dubai", country: "United Arab Emirates", code: "DXB", tag: "Dubai International hub", popular: true },
  { name: "Singapore", region: "Singapore", country: "Singapore", code: "SIN", tag: "Changi Airport hub", popular: true },
  { name: "London", region: "England", country: "United Kingdom", code: "LHR", tag: "Heathrow & Gatwick hubs", popular: true },
  { name: "New York", region: "New York", country: "United States", code: "JFK", tag: "JFK, EWR & LGA hubs", popular: true },
  { name: "Bangkok", region: "Central Thailand", country: "Thailand", code: "BKK", tag: "Suvarnabhumi Airport (BKK)", popular: true },
  { name: "Doha", region: "Qatar", country: "Qatar", code: "DOH", tag: "Hamad International hub", popular: false },
  { name: "Kuala Lumpur", region: "Malaysia", country: "Malaysia", code: "KUL", tag: "KLIA hub", popular: false },
  { name: "Paris", region: "Île-de-France", country: "France", code: "CDG", tag: "Charles de Gaulle (CDG)", popular: false },
  { name: "Tokyo", region: "Kanto", country: "Japan", code: "HND", tag: "Haneda & Narita hubs", popular: false },
  { name: "Sydney", region: "New South Wales", country: "Australia", code: "SYD", tag: "Kingsford Smith hub", popular: false },
  { name: "Toronto", region: "Ontario", country: "Canada", code: "YYZ", tag: "Pearson International (YYZ)", popular: false },
  { name: "Frankfurt", region: "Hesse", country: "Germany", code: "FRA", tag: "Frankfurt Airport (FRA)", popular: false },
  { name: "San Francisco", region: "California", country: "United States", code: "SFO", tag: "SFO Bay Area hub", popular: false },
  { name: "Amsterdam", region: "North Holland", country: "Netherlands", code: "AMS", tag: "Schiphol Airport (AMS)", popular: false },
  { name: "Melbourne", region: "Victoria", country: "Australia", code: "MEL", tag: "Tullamarine Airport (MEL)", popular: false }
];

const THEMES = [
  { key: "beaches", label: "Beach escapes", desc: "Sand, reefs, slow afternoons" },
  { key: "mountains", label: "Mountain air", desc: "Ridges, pine, cold mornings" },
  { key: "culture", label: "Culture & food", desc: "Markets, kitchens, old towns" },
  { key: "adventure", label: "Adventure", desc: "Trails, rivers, altitude" },
  { key: "cities", label: "City breaks", desc: "Short flights, long weekends" }
];

const TRIPS = {
  dolomites: {
    name: "Alpine Lakes & Huts", place: "Italy · Dolomites", img: "assets/trip-dolomites.jpg",
    price: 108000, max: 12, seats: 4, rating: 4.9, reviewCount: 186,
    days: 6, nights: 5, difficulty: "Moderate", best: "June–September, December–March",
    dates: ["12 Nov 2026", "26 Nov 2026", "10 Dec 2026", "07 Jan 2027"],
    summary: "Six days of rifugio breakfasts, mirror-still lakes and ridgelines you will talk about for years. Two bases, no long transfers, one very good coffee stop.",
    highlights: [
      { icon: "🏔", title: "Lake Braies at sunrise", text: "We get to the jetty an hour before the boaters do." },
      { icon: "🥾", title: "Three hut walks", text: "Between 5 and 11 km a day, always ending somewhere with food." },
      { icon: "🧀", title: "Rifugio lunches", text: "Polenta, speck and a view that costs nothing extra." },
      { icon: "🚠", title: "One cable car day", text: "Up 2,000 m for a ridge walk with the whole range in front of you." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive in Bolzano", text: "Train pickup, old-town walk, welcome dinner with the group." },
      { day: "Day 2", title: "Lake Braies", text: "Sunrise at the jetty, a loop walk, afternoon free in the village." },
      { day: "Day 3", title: "Hut day", text: "Cable car up, an 8 km ridge walk, long lunch at a rifugio." },
      { day: "Day 4", title: "Val di Funes", text: "Two villages, a meadow walk and the best strudel on the route." },
      { day: "Day 5", title: "Free & farewell", text: "Optional via ferrata or a spa afternoon, group dinner." },
      { day: "Day 6", title: "Depart", text: "Breakfast and transfer to Bolzano station." }
    ],
    reviews: [
      { name: "Neha Kulkarni", trip: "September 2026", initials: "N", stars: 5, text: "The sunrise at Braies is worth the early alarm. Our guide knew exactly where to stand." },
      { name: "Daniel Frisch", trip: "July 2026", initials: "D", stars: 5, text: "Perfect balance of walking and sitting still with coffee. Rifugio lunch was a highlight." }
    ]
  },
  goa: {
    name: "Off-Season Goa", place: "India · Goa", img: "assets/trip-goa.jpg",
    price: 32400, max: 16, seats: 7, rating: 4.7, reviewCount: 214,
    days: 4, nights: 3, difficulty: "Easy", best: "June–September, November",
    dates: ["28 Nov 2026", "12 Dec 2026", "09 Jan 2027"],
    summary: "Empty beaches, Portuguese bakeries and a sunset cruise with a fisherman who knows the good spots. A long-weekend reset with almost no driving.",
    highlights: [
      { icon: "⛵", title: "Fisherman's sunset cruise", text: "A small boat, a cool box and no itinerary for two hours." },
      { icon: "🥐", title: "Bakery mornings", text: "Poee, bebinca and the best chorizo pao in Panjim." },
      { icon: "🌿", title: "Spice garden lunch", text: "A family-run garden with a home-style thali." },
      { icon: "🏖", title: "Three quiet beaches", text: "We skip the crowded strip entirely." }
    ],
    itinerary: [
      { day: "Day 1", title: "Arrive & settle", text: "Check in, evening beach walk, first Goan dinner." },
      { day: "Day 2", title: "Old Goa & bakeries", text: "Church walk, Latin quarter, bakery crawl, free afternoon." },
      { day: "Day 3", title: "Boat & beach", text: "Spice garden lunch, quiet-beach afternoon, sunset cruise." },
      { day: "Day 4", title: "Depart", text: "Slow breakfast and airport transfer." }
    ],
    reviews: [
      { name: "Sara Khan", trip: "November 2026", initials: "S", stars: 5, text: "The bakery list was dangerously good. The cruise was the highlight of the weekend." },
      { name: "Rahul Dutta", trip: "December 2025", initials: "R", stars: 4, text: "Great value. Would have liked one more beach day." }
    ]
  },
  meghalaya: {
    name: "Cloud Trail Walk", place: "India · Meghalaya", img: "assets/trip-meghalaya.jpg",
    price: 41900, max: 10, seats: 2, rating: 4.9, reviewCount: 132,
    days: 5, nights: 4, difficulty: "Moderate+", best: "October–April",
    dates: ["05 Dec 2026", "19 Dec 2026", "16 Jan 2027"],
    summary: "Living root bridges, cave swims and homestay dinners in the wettest, greenest corner of India. Two hikes, both worth the sweat.",
    highlights: [
      { icon: "🌉", title: "Double-decker root bridge", text: "A 3,000-step descent, a swim and a climb back — slowly." },
      { icon: "🕳", title: "Cave morning", text: "Mawsmai's lit chambers, plus a river cave for the brave." },
      { icon: "🏡", title: "Two homestay nights", text: "Jadoh, pork, and a family that has hosted for three generations." },
      { icon: "☁", title: "Cloud viewpoint", text: "A sunrise drive to a ridge that is often above the clouds." }
    ],
    itinerary: [
      { day: "Day 1", title: "Shillong arrival", text: "Airport pickup, evening market walk, group briefing." },
      { day: "Day 2", title: "Root bridges", text: "Nongriat descent, waterfall swim, homestay night." },
      { day: "Day 3", title: "Caves & clouds", text: "Mawsmai cave, a ridge viewpoint, drive to Cherrapunji." },
      { day: "Day 4", title: "Waterfall day", text: "Three falls, a picnic and a slow evening." },
      { day: "Day 5", title: "Depart", text: "Early breakfast and transfer to Shillong airport." }
    ],
    reviews: [
      { name: "Ankit Bose", trip: "January 2026", initials: "A", stars: 5, text: "The descent is serious but the guide paced it perfectly. Homestay food was unreal." },
      { name: "Divya Menon", trip: "December 2025", initials: "D", stars: 5, text: "Only nine of us and two guides. Felt like travelling with friends." }
    ]
  }
};

const POSTS = {
  "kyoto-slow": {
    title: "Ten slow days in Kansai — without ticking boxes",
    kicker: "Guide · 8 min read", date: "12 October 2026", img: "assets/journal-roadtrip.jpg",
    lead: "We replaced a checklist of seventeen temples with three neighbourhoods, one bicycle and a lot of vending-machine coffee. It was the best trip we have planned.",
    body: `
      <p>There is a particular kind of tiredness that comes from trying to see a city properly. You wake at six, photograph a gate, queue for a garden, walk four kilometres, eat standing up, and by the seventh day you cannot remember which temple had the moss.</p>
      <p>So for our Kansai route we tried the opposite. Ten days. Three bases. Nothing booked before 10am.</p>
      <h3>Base one: Gion, on foot</h3>
      <p>Gion in the early morning belongs to shopkeepers sweeping their front steps. We walked the same four streets every day and by day three the woman at the pickle shop was waving at us. That is not something you can schedule, but you can make room for it.</p>
      <blockquote>Slow travel is not about doing less. It is about noticing more of what you are already doing.</blockquote>
      <h3>What we kept</h3>
      <ul>
        <li><strong>Fushimi at 6:40am.</strong> The gates are the same gates, but the sound is completely different.</li>
        <li><strong>One bicycle day.</strong> Arashiyama is a thirty-minute ride from the edge of the city and a world away.</li>
        <li><strong>A tea workshop in Uji.</strong> Two hours that taught us more about Japan than any museum.</li>
        <li><strong>Counter dinners.</strong> Eight seats, one menu, a chef who will absolutely tell you how to eat it.</li>
      </ul>
      <h3>What we dropped</h3>
      <p>The day trip to Osaka, the themed café, and the seventh temple. Nobody missed them. We replaced all three with a long lunch and a nap, which is a legitimate travel activity and honestly the one we remember most.</p>
      <p>Our advice: pick three things per day, not seven. Leave the middle of the afternoon empty. The city will fill it for you.</p>`
  },
  packing: {
    title: "The 7 kg carry-on that survived a week in the Himalayas",
    kicker: "Packing · 4 min read", date: "28 September 2026", img: "assets/journal-packing.jpg",
    lead: "One bag, three layers and the single item our mountain guides insist every traveller forgets. A field-tested list from seven days above 2,000 metres.",
    body: `
      <p>Seven days, one 40-litre bag, no checked luggage. The rules are simple: everything must earn its place, and nothing gets packed “just in case”.</p>
      <h3>The three-layer rule</h3>
      <p>Base layer, fleece, shell. That is it. Mountain weather changes every two hours, so you dress and undress rather than carrying five outfits.</p>
      <ul>
        <li><strong>Merino base layer</strong> — worn four days, did not smell, worth every rupee.</li>
        <li><strong>Light fleece</strong> — the evening layer, also the pillow layer.</li>
        <li><strong>Packable rain shell</strong> — 280 g and the most used item in the bag.</li>
      </ul>
      <h3>The item everyone forgets</h3>
      <p>A dry bag. Not for your phone — for your passport and one clean t-shirt. Rivers, rain and jeep rides will find your luggage eventually; the difference between a damp bag and a ruined trip is about ₹400.</p>
      <blockquote>If you are wondering whether to bring it, you probably do not need it. If you will be cold and wet without it, bring two.</blockquote>
      <h3>What we left behind</h3>
      <p>The tripod, the second pair of shoes, the drone (permits), and the hardback book. A guide's advice we now repeat: pack for the trip you are taking, not for every trip you have ever taken.</p>`
  },
  stars: {
    title: "Where to sleep under the Milky Way in India",
    kicker: "Stargazing · 5 min read", date: "04 September 2026", img: "assets/journal-stars.jpg",
    lead: "Five high-altitude camps, one star-spotting checklist and the best month to go. You do not need an expensive telescope — you need darkness.",
    body: `
      <p>India has some of the darkest skies left in Asia, and most of them are a night's drive from a reasonably connected town. Here is where we take travellers who ask to see the Milky Way properly.</p>
      <h3>The shortlist</h3>
      <ul>
        <li><strong>Spiti, Himachal Pradesh</strong> — 4,200 m, almost no light pollution. June to September.</li>
        <li><strong>Nubra Valley, Ladakh</strong> — cold, clear, and the Milky Way reads like a texture.</li>
        <li><strong>Rann of Kutch, Gujarat</strong> — flat white horizon, surprisingly good for beginners.</li>
        <li><strong>Chikmagalur, Karnataka</strong> — the easiest weekend option from Bengaluru.</li>
        <li><strong>Sandakphu, West Bengal</strong> — ridge camping with a Kanchenjunga silhouette.</li>
      </ul>
      <h3>What actually matters</h3>
      <p>New moon, clear forecast, altitude, and getting out of the vehicle. That is the whole checklist. A cheap tripod and a phone set to a 20-second exposure will out-perform an expensive camera on the wrong night.</p>
      <blockquote>Give your eyes twenty minutes. Then look up — and stop looking for the photo.</blockquote>
      <h3>Cold is the tax</h3>
      <p>Clear skies mean cold nights. Our guides carry two blankets and a thermos of chai for exactly this reason, and we still recommend a down jacket even in summer at altitude.</p>`
  }
};

/* ---------- 5. Search, filters & sorting ---------- */
const state = {
  q: "", style: "all", month: "", travellers: 2, sort: "recommended", tab: "all"
};

const destGrid = $("#dest-grid");
const destCards = $$(".dest-card");
const searchForm = $("#trip-search");
const qInput = $("#q");
const suggestions = $("#suggestions");
const statusBar = $("#search-status");
const statusText = $("#search-status-text");
const emptyState = $("#dest-empty");
const liveResults = $("#live-results");
const destinationExplorer = $("#destination-explorer");
const exploreStatus = $("#weather-status");
const weatherDetails = $("#weather-details");
const destinationMap = $("#destination-map");
const mapStatus = $("#map-status");
const mapLink = $("#map-link");
const imageCard = $("#image-card");
const imageStatus = $("#image-status");
const imageCredit = $("#image-credit");
const destinationImages = $("#destination-images");
const travelResults = $("#travel-results");
let liveSearchController = null;
let exploreController = null;
let travelController = null;

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function applyFilters(announce = false) {
  liveSearchController?.abort();
  exploreController?.abort();
  travelController?.abort();
  liveSearchController = null;
  exploreController = null;
  travelController = null;
  [$("#search-flights"), $("#search-hotels")].filter(Boolean).forEach((button) => { button.disabled = false; });
  if (liveResults) liveResults.hidden = true;
  if (destinationExplorer) destinationExplorer.hidden = true;
  if (travelResults) travelResults.hidden = true;
  if (destGrid) destGrid.hidden = false;

  const query = normalise(state.q);
  const tokens = query ? query.split(" ") : [];
  const effectiveStyle = state.tab !== "all" ? state.tab : state.style;

  let visible = 0;
  destCards.forEach((card) => {
    const haystack = normalise(`${card.dataset.name} ${card.querySelector("h3")?.textContent || ""} ${card.querySelector("p")?.textContent || ""}`);
    const dest = DESTINATIONS[card.dataset.id];
    const matchesQuery = tokens.every((t) => haystack.includes(t));
    const matchesStyle = effectiveStyle === "all" || (dest?.styles || []).includes(effectiveStyle);
    const matchesMonth = !state.month || (dest?.months || []).includes(state.month);
    const show = matchesQuery && matchesStyle && matchesMonth;
    card.hidden = !show;
    if (show) {
      visible += 1;
      card.style.animation = "none";
      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;
      card.style.animation = "";
    }
  });

  sortCards();

  const active = tokens.length > 0 || effectiveStyle !== "all" || Boolean(state.month);
  if (statusBar && statusText) {
    if (active) {
      const bits = [];
      if (state.q.trim()) bits.push(`“${state.q.trim()}”`);
      if (effectiveStyle !== "all") bits.push(effectiveStyle);
      if (state.month) bits.push(state.month);
      statusText.textContent = `${visible} destination${visible === 1 ? "" : "s"} matching ${bits.join(" · ")}`;
      statusBar.hidden = false;
    } else {
      statusBar.hidden = true;
    }
  }
  if (emptyState) emptyState.hidden = visible !== 0;

  if (announce) {
    toast(
      visible ? `${visible} trip${visible === 1 ? "" : "s"} found` : "No matches — try a broader search",
      visible ? `For ${state.travellers} traveller${state.travellers === 1 ? "" : "s"}${state.month ? ` in ${state.month}` : ""}` : "Try Jaipur, Kyoto or clear the filters",
      visible ? "⌖" : "◎"
    );
  }
}

function sortCards() {
  if (!destGrid) return;
  const cards = [...destCards];
  const by = state.sort;
  cards.sort((a, b) => {
    if (by === "price") return Number(a.dataset.price) - Number(b.dataset.price);
    if (by === "rating") return Number(b.dataset.rating) - Number(a.dataset.rating);
    if (by === "name") return a.querySelector("h3").textContent.localeCompare(b.querySelector("h3").textContent);
    return 0;
  });
  cards.forEach((c) => destGrid.appendChild(c));
}

/* tabs */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    state.tab = tab.dataset.filter;
    const select = $("#style");
    if (select) select.value = state.tab === "all" ? "all" : state.tab;
    state.style = select?.value || "all";
    applyFilters();
  });
});

$("#style")?.addEventListener("change", (e) => {
  state.style = e.target.value;
  state.tab = e.target.value;
  $$(".tab").forEach((t) => {
    const on = t.dataset.filter === state.tab;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
  });
  applyFilters();
});

$("#month")?.addEventListener("change", (e) => {
  state.month = e.target.value;
  applyFilters();
});

$("#sort-dest")?.addEventListener("change", (e) => {
  state.sort = e.target.value;
  sortCards();
});

/* travellers stepper */
const travellerOutput = $("#travellers");
$$("[data-step]").forEach((btn) => {
  btn.addEventListener("click", () => {
    invalidateItinerary();
    state.travellers = clamp(state.travellers + Number(btn.dataset.step), 1, 8);
    if (travellerOutput) travellerOutput.textContent = String(state.travellers);
    syncStepperButtons();
  });
});
function syncStepperButtons() {
  $$("[data-step]").forEach((btn) => {
    const dir = Number(btn.dataset.step);
    btn.disabled = (dir < 0 && state.travellers <= 1) || (dir > 0 && state.travellers >= 8);
  });
}
syncStepperButtons();

/* suggestion list with real-time Google Places Autocomplete */
async function fetchPlaceSuggestions(query, type = "destination", signal = null) {
  const url = `/api/autocomplete?input=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Autocomplete lookup failed");
  const data = await res.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

let qDebounceTimer = null;
let qAbortController = null;

function renderHeroSuggestions(results, query, isDefault = false, isLoading = false) {
  if (!suggestions) return;
  suggestions.replaceChildren();

  const header = document.createElement("li");
  header.className = "sug-header";
  header.setAttribute("role", "presentation");
  if (isLoading) {
    header.innerHTML = `<span>Matching destinations</span><small class="sug-loading"><span class="sug-spinner"></span> Searching places…</small>`;
  } else if (isDefault) {
    header.innerHTML = `<span>Trending destinations</span><small>Explore popular trips</small>`;
  } else {
    header.innerHTML = `<span>Matching destinations</span><small>${results.length} found</small>`;
  }
  suggestions.appendChild(header);

  if (!results.length && !isLoading) {
    const customLi = document.createElement("li");
    customLi.setAttribute("role", "option");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sug-custom-btn";
    btn.innerHTML = `<span class="sug-icon" aria-hidden="true">📍</span><span><strong>Use “${escapeHTML(query.trim())}”</strong><small>Search live web results for this place</small></span>`;
    btn.addEventListener("click", () => {
      qInput.value = query.trim();
      state.q = query.trim();
      suggestions.hidden = true;
      qInput.setAttribute("aria-expanded", "false");
      $("#q-clear").hidden = !qInput.value;
      applyFilters(true);
      $("#destinations").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    customLi.appendChild(btn);
    suggestions.appendChild(customLi);
    suggestions.hidden = false;
    qInput?.setAttribute("aria-expanded", "true");
    return;
  }

  results.slice(0, 7).forEach((r) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    const btn = document.createElement("button");
    btn.type = "button";
    const iconOrImg = r.img
      ? `<img src="${r.img}" alt="">`
      : `<span class="sug-icon" aria-hidden="true">${r.icon || "📍"}</span>`;
    const pill = r.country ? `<span class="sug-tag-pill">${escapeHTML(r.country)}</span>` : "";
    btn.innerHTML = `${iconOrImg}<span><strong>${highlightMatch(r.label, query)}</strong><small>${escapeHTML(r.sub)}</small></span>${pill}`;
    btn.addEventListener("click", () => {
      if (r.type === "dest" || r.type === "all_dest" || r.type === "place") {
        qInput.value = r.label;
        state.q = r.label;
        if (plannerDestination) {
          plannerDestination.value = r.label;
          planner.destination = r.label;
          store.set("planner", planner);
          updateCostProfile(r.label);
        }
      } else {
        qInput.value = ""; state.q = ""; state.tab = r.key; state.style = r.key;
        $$(".tab").forEach((t) => { const on = t.dataset.filter === r.key; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
      }
      suggestions.hidden = true;
      qInput.setAttribute("aria-expanded", "false");
      $("#q-clear").hidden = !qInput.value;
      applyFilters(true);
      $("#destinations").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    li.appendChild(btn);
    suggestions.appendChild(li);
  });
  suggestions.hidden = false;
  qInput?.setAttribute("aria-expanded", "true");
}

function buildSuggestions(query) {
  if (!suggestions) return;
  const q = normalise(query);

  if (!q) {
    const defaultDests = ALL_DESTINATIONS.filter((d) => d.img).slice(0, 5).map((d) => ({
      type: "all_dest",
      label: d.name,
      sub: `${d.country} · ${d.tag || ""}`,
      img: d.img,
      country: d.country
    }));
    renderHeroSuggestions(defaultDests, "", true);
    return;
  }

  // Build immediate local results
  const results = [];
  Object.entries(DESTINATIONS).forEach(([id, d]) => {
    const hay = normalise(`${d.name} ${d.country} ${d.styles.join(" ")} ${d.title}`);
    if (hay.includes(q)) results.push({ type: "dest", id, label: d.name, sub: `${d.country} · from ${inr(d.price)}`, img: d.img, country: d.country });
  });
  THEMES.forEach((t) => {
    if (normalise(`${t.key} ${t.label} ${t.desc}`).includes(q)) {
      results.push({ type: "theme", key: t.key, label: t.label, sub: t.desc, icon: "✳" });
    }
  });
  ALL_DESTINATIONS.forEach((d) => {
    if (results.some((r) => normalise(r.label) === normalise(d.name))) return;
    const hay = normalise(`${d.name} ${d.country} ${d.region || ""} ${(d.styles || []).join(" ")} ${d.tag || ""}`);
    if (hay.includes(q)) {
      results.push({
        type: "all_dest",
        label: d.name,
        sub: `${d.country} · ${d.tag || d.region || ""}`,
        img: d.img || "",
        icon: d.icon || "📍",
        country: d.country
      });
    }
  });

  renderHeroSuggestions(results, query, false, false);
}

function triggerHeroSearch(query) {
  clearTimeout(qDebounceTimer);
  qAbortController?.abort();

  if (!query.trim()) {
    buildSuggestions("");
    return;
  }

  // Show immediate local results first
  buildSuggestions(query);

  // Debounced real-time Google Places / Geocoding backend lookup
  qDebounceTimer = setTimeout(async () => {
    const controller = new AbortController();
    qAbortController = controller;
    try {
      const places = await fetchPlaceSuggestions(query.trim(), "destination", controller.signal);
      if (controller.signal.aborted) return;
      if (places.length) {
        const placeResults = places.map((p) => {
          const matchedLocal = ALL_DESTINATIONS.find((d) => normalise(d.name) === normalise(p.name));
          return {
            type: "place",
            label: p.name,
            sub: p.secondary || p.description || "",
            img: matchedLocal?.img || "",
            icon: matchedLocal?.icon || "📍",
            country: p.country || (p.secondary ? p.secondary.split(",").pop().trim() : "")
          };
        });
        renderHeroSuggestions(placeResults, query, false, false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.warn("Hero place search error:", err);
      }
    }
  }, 280);
}

qInput?.addEventListener("input", (e) => {
  state.q = e.target.value;
  $("#q-clear").hidden = !state.q;
  applyFilters();
  triggerHeroSearch(state.q);
});
qInput?.addEventListener("focus", () => { triggerHeroSearch(state.q || ""); });
qInput?.addEventListener("blur", () => setTimeout(() => {
  if (suggestions) suggestions.hidden = true;
  qInput.setAttribute("aria-expanded", "false");
}, 150));
qInput?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { suggestions.hidden = true; qInput.setAttribute("aria-expanded", "false"); }
  if (e.key === "ArrowDown" && !suggestions.hidden) {
    e.preventDefault();
    suggestions.querySelector("button")?.focus();
  }
});
suggestions?.addEventListener("keydown", (e) => {
  const buttons = $$("button", suggestions);
  const idx = buttons.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); buttons[Math.min(idx + 1, buttons.length - 1)]?.focus(); }
  if (e.key === "ArrowUp") { e.preventDefault(); if (idx <= 0) qInput.focus(); else buttons[idx - 1].focus(); }
  if (e.key === "Escape") { suggestions.hidden = true; qInput.focus(); }
});

$("#q-clear")?.addEventListener("click", () => {
  qInput.value = "";
  state.q = "";
  $("#q-clear").hidden = true;
  suggestions.hidden = true;
  applyFilters();
  qInput.focus();
});

/* quick chips */
$$("[data-quick]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const value = chip.dataset.quick;
    const dest = Object.entries(DESTINATIONS).find(([, d]) => normalise(d.name) === normalise(value));
    if (dest) {
      state.q = dest[1].name;
      state.tab = "all"; state.style = "all"; state.month = "";
      if (qInput) qInput.value = dest[1].name;
      const styleSel = $("#style"); if (styleSel) styleSel.value = "all";
      const monthSel = $("#month"); if (monthSel) monthSel.value = "";
      $$(".tab").forEach((t) => { const on = t.dataset.filter === "all"; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
      if ($("#q-clear")) $("#q-clear").hidden = false;
    } else {
      state.q = ""; if (qInput) qInput.value = ""; if ($("#q-clear")) $("#q-clear").hidden = true;
      state.style = value; state.tab = value;
      const styleSel = $("#style"); if (styleSel) styleSel.value = value;
      $$(".tab").forEach((t) => { const on = t.dataset.filter === value; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
    }
    applyFilters(true);
    $("#destinations").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  });
});

function resetFilters() {
  state.q = ""; state.style = "all"; state.month = ""; state.tab = "all"; state.travellers = 2;
  if (qInput) qInput.value = "";
  const styleSel = $("#style"); if (styleSel) styleSel.value = "all";
  const monthSel = $("#month"); if (monthSel) monthSel.value = "";
  $$(".tab").forEach((t) => { const on = t.dataset.filter === "all"; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
  if ($("#q-clear")) $("#q-clear").hidden = true;
  if (travellerOutput) travellerOutput.textContent = "2";
  applyFilters();
}
$("#clear-search")?.addEventListener("click", resetFilters);
$("#reset-empty")?.addEventListener("click", resetFilters);

async function searchLiveDestination() {
  const query = qInput?.value.trim() || "";
  if (query.length < 2) {
    toast("Add a destination", "Enter at least two characters to search the web", "⌖");
    qInput?.focus();
    return;
  }

  liveSearchController?.abort();
  const controller = new AbortController();
  liveSearchController = controller;
  exploreController?.abort();
  exploreController = new AbortController();
  travelController?.abort();
  travelController = null;
  [$("#search-flights"), $("#search-hotels")].filter(Boolean).forEach((button) => { button.disabled = false; });
  if (destGrid) destGrid.hidden = true;
  invalidateItinerary();
  planner.destination = query;
  if (plannerDestination) plannerDestination.value = query;
  store.set("planner", planner);
  updateCostProfile(query);
  if (emptyState) emptyState.hidden = true;
  if (destinationExplorer) destinationExplorer.hidden = false;
  if (exploreStatus) exploreStatus.textContent = "Looking up local weather…";
  if (weatherDetails) weatherDetails.hidden = true;
  if (destinationMap) destinationMap.hidden = true;
  if (mapLink) mapLink.hidden = true;
  if (mapStatus) {
    mapStatus.hidden = false;
    mapStatus.textContent = "Loading map…";
  }
  if (imageCard) imageCard.hidden = true;
  if (imageStatus) imageStatus.hidden = true;
  if (travelResults) travelResults.hidden = true;
  if (liveResults) {
    liveResults.replaceChildren();
    liveResults.hidden = false;
    const loading = document.createElement("p");
    loading.className = "live-search-loading";
    loading.textContent = `Searching the web for ${query}…`;
    liveResults.appendChild(loading);
  }
  if (statusBar && statusText) {
    statusText.textContent = `Searching the web for “${query}”…`;
    statusBar.hidden = false;
  }

  const submitButton = searchForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  loadDestinationExplorer(query, exploreController);

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Destination search failed.");
    if (controller !== liveSearchController) return;

    liveResults.replaceChildren();
    if (data.answer) {
      const answer = document.createElement("p");
      answer.className = "live-answer";
      const heading = document.createElement("strong");
      heading.textContent = "A quick overview";
      answer.append(heading, document.createTextNode(data.answer));
      liveResults.appendChild(answer);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    renderDestinationImages(data.images || [], data.imageError || "");
    let rendered = 0;
    results.forEach((result) => {
      let source;
      try {
        source = new URL(result.url);
      } catch {
        return;
      }
      if (!["http:", "https:"].includes(source.protocol)) return;

      const card = document.createElement("article");
      card.className = "dest-card live-result";
      const body = document.createElement("div");
      body.className = "dest-body";
      const meta = document.createElement("div");
      meta.className = "dest-meta";
      meta.textContent = source.hostname;
      const title = document.createElement("h3");
      title.textContent = result.title || source.hostname;
      const description = document.createElement("p");
      description.textContent = result.content;
      const footer = document.createElement("div");
      footer.className = "dest-foot";
      const favorite = document.createElement("button");
      favorite.className = "text-btn";
      favorite.type = "button";
      favorite.dataset.searchFav = qInput?.value.trim() || "";
      const isSaved = savedSearches.some((item) => normalise(item.query) === normalise(favorite.dataset.searchFav));
      favorite.setAttribute("aria-pressed", String(isSaved));
      favorite.setAttribute("aria-label", `${isSaved ? "Remove" : "Save"} ${favorite.dataset.searchFav} ${isSaved ? "from" : "to"} saved places`);
      favorite.textContent = isSaved ? "Saved ♥" : "Save place ♡";
      const link = document.createElement("a");
      link.className = "card-cta";
      link.href = source.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Read source ↗";
      footer.append(favorite, link);
      body.append(meta, title, description, footer);
      card.appendChild(body);
      liveResults.appendChild(card);
      rendered += 1;
    });

    if (!rendered) {
      const message = document.createElement("p");
      message.className = "live-no-results";
      message.textContent = "No useful web results found. Try a more specific destination.";
      liveResults.appendChild(message);
    }
    if (statusText) statusText.textContent = `${rendered} web result${rendered === 1 ? "" : "s"} for “${query}”`;
    toast(
      rendered ? `${rendered} web result${rendered === 1 ? "" : "s"} found` : "No web results found",
      `For ${query}`,
      rendered ? "⌖" : "◎"
    );
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Destination search failed:", error);
    if (liveResults) liveResults.hidden = true;
    if (destGrid) destGrid.hidden = false;
    if (statusText) statusText.textContent = error.message || "Destination search failed. Please try again.";
    toast("Search unavailable", error.message || "Please try again in a moment.", "!");
  } finally {
    if (controller === liveSearchController || liveSearchController === null) {
      if (controller === liveSearchController) liveSearchController = null;
      submitButton.disabled = false;
    }
  }
}

function weatherDescription(code) {
  const descriptions = {
    0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
    75: "Heavy snow", 80: "Rain showers", 81: "Showers", 82: "Heavy showers",
    95: "Thunderstorms", 96: "Thunderstorms with hail", 99: "Severe thunderstorms"
  };
  return descriptions[code] || "Current conditions";
}

async function loadDestinationExplorer(query, controller) {
  try {
    const response = await fetch(`/api/explore?destination=${encodeURIComponent(query)}`, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Location details are unavailable.");
    if (controller !== exploreController) return;

    const place = data.place;
    const current = data.weather?.current;
    const daily = data.weather?.daily;
    if (current && weatherDetails && exploreStatus) {
      const units = data.weather.units?.current || {};
      const location = [place?.name, place?.region, place?.country].filter(Boolean).join(", ");
      const today = daily?.time?.[0];
      const high = daily?.temperature_2m_max?.[0];
      const low = daily?.temperature_2m_min?.[0];
      exploreStatus.textContent = location;
      weatherDetails.replaceChildren();
      const summary = document.createElement("p");
      summary.className = "weather-current";
      summary.textContent = `${Math.round(current.temperature_2m)}${units.temperature_2m || "°"} · ${weatherDescription(current.weather_code)}`;
      const detail = document.createElement("p");
      detail.textContent = `Feels like ${Math.round(current.apparent_temperature)}${units.apparent_temperature || "°"} · Humidity ${current.relative_humidity_2m}% · Wind ${Math.round(current.wind_speed_10m)} ${units.wind_speed_10m || "km/h"}`;
      weatherDetails.append(summary, detail);
      if (today && high != null && low != null) {
        const outlook = document.createElement("p");
        outlook.className = "weather-outlook";
        outlook.textContent = `Today (${today}): high ${Math.round(high)}${data.weather.units?.daily?.temperature_2m_max || "°"}, low ${Math.round(low)}${data.weather.units?.daily?.temperature_2m_min || "°"}`;
        weatherDetails.appendChild(outlook);
      }
      weatherDetails.hidden = false;
    } else if (exploreStatus) {
      exploreStatus.textContent = "Weather information is not available for this place.";
    }

    if (destinationMap && mapStatus && data.mapEmbed) {
      destinationMap.src = data.mapEmbed;
      destinationMap.hidden = false;
      mapStatus.hidden = true;
      if (mapLink) {
        mapLink.href = data.mapLink;
        mapLink.hidden = false;
      }
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Destination weather and map lookup failed:", error);
    if (exploreStatus) exploreStatus.textContent = error.message || "Weather details are unavailable.";
    if (mapStatus) mapStatus.textContent = error.message || "Map details are unavailable.";
  }
}

function renderDestinationImages(images, error = "") {
  if (!destinationImages || !imageCard) return;
  destinationImages.replaceChildren();
  (Array.isArray(images) ? images : []).slice(0, 6).forEach((item) => {
    let source;
    let sourcePage;
    try {
      source = new URL(item.url);
      sourcePage = new URL(item.source);
    } catch {
      return;
    }
    if (source.protocol !== "https:" || !source.hostname.endsWith("wikimedia.org") ||
      sourcePage.protocol !== "https:" || sourcePage.hostname !== "commons.wikimedia.org") return;
    const figure = document.createElement("figure");
    const link = document.createElement("a");
    link.href = sourcePage.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const image = document.createElement("img");
    image.src = source.href;
    image.alt = item.description || item.title || "Travel inspiration";
    image.loading = "lazy";
    link.appendChild(image);
    const caption = document.createElement("figcaption");
    caption.textContent = [item.title, item.creator, item.license].filter(Boolean).join(" · ");
    figure.append(link, caption);
    destinationImages.appendChild(figure);
  });
  if (imageStatus) {
    imageStatus.textContent = error || (!destinationImages.childElementCount ? "No openly licensed images were found for this place." : "");
    imageStatus.hidden = !imageStatus.textContent;
  }
  if (imageCredit) imageCredit.hidden = !destinationImages.childElementCount;
  imageCard.hidden = !destinationImages.childElementCount && !imageStatus?.textContent;
}

function renderTravelResults(data, type) {
  if (!travelResults) return;
  travelResults.replaceChildren();
  if (data.answer) {
    const answer = document.createElement("p");
    answer.className = "live-answer";
    answer.textContent = data.answer;
    travelResults.appendChild(answer);
  }
  const results = Array.isArray(data.results) ? data.results : [];
  results.forEach((result) => {
    let source;
    try {
      source = new URL(result.url);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(source.protocol)) return;
    const card = document.createElement("article");
    card.className = "travel-result";
    const heading = document.createElement("h4");
    heading.textContent = result.title || source.hostname;
    const description = document.createElement("p");
    description.textContent = result.content;
    const link = document.createElement("a");
    link.href = source.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `Visit ${source.hostname} ↗`;
    card.append(heading, description, link);
    travelResults.appendChild(card);
  });
  if (!travelResults.childElementCount) {
    const message = document.createElement("p");
    message.className = "live-no-results";
    message.textContent = `No useful ${type} listings were found. Try another destination.`;
    travelResults.appendChild(message);
  }
  travelResults.hidden = false;
}

async function searchTravelOptions(type) {
  const destination = qInput?.value.trim() || "";
  const origin = $("#planner-origin")?.value.trim() || "";
  if (type === "flights" && !origin) {
    toast("Add your starting city", "Enter it in the trip planner to search flights", "✈");
    $("#planner-origin")?.focus();
    return;
  }

  travelController?.abort();
  const controller = new AbortController();
  travelController = controller;
  if (travelResults) {
    travelResults.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "live-search-loading";
    loading.textContent = `Searching live ${type} information…`;
    travelResults.appendChild(loading);
    travelResults.hidden = false;
  }

  const buttons = [$("#search-flights"), $("#search-hotels")].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch("/api/travel-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination,
        origin,
        type,
        dates: $("#planner-date")?.value || ""
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Live ${type} search failed.`);
    if (controller !== travelController) return;
    renderTravelResults(data, type);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(`Live ${type} search failed:`, error);
    if (travelResults) {
      const message = document.createElement("p");
      message.className = "live-no-results";
      message.textContent = error.message || `Live ${type} search is unavailable. Please try again.`;
      travelResults.replaceChildren(message);
      travelResults.hidden = false;
    }
  } finally {
  if (controller === travelController) {
    travelController = null;
    buttons.forEach((button) => { button.disabled = false; });
  }
}
}

$("#search-flights")?.addEventListener("click", () => searchTravelOptions("flights"));
$("#search-hotels")?.addEventListener("click", () => searchTravelOptions("hotels"));
liveResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-fav]");
  if (!button) return;
  const query = button.dataset.searchFav;
  const index = savedSearches.findIndex((item) => normalise(item.query) === normalise(query));
  if (index >= 0) {
savedSearches.splice(index, 1);
toast("Removed from saved places", query, "♡");
  } else {
savedSearches.unshift({ query, savedAt: new Date().toISOString() });
savedSearches = savedSearches.slice(0, 20);
toast("Destination saved", `${query} is in your saved places`, "♥");
  }
  store.set("savedSearches", savedSearches);
  renderSaved();
  button.setAttribute("aria-pressed", String(index < 0));
  button.setAttribute("aria-label", `${index < 0 ? "Remove" : "Save"} ${query} ${index < 0 ? "from" : "to"} saved places`);
  button.textContent = index < 0 ? "Saved ♥" : "Save place ♡";
  $$("[data-search-fav]").forEach((favorite) => {
if (normalise(favorite.dataset.searchFav) !== normalise(query)) return;
favorite.setAttribute("aria-pressed", String(index < 0));
favorite.setAttribute("aria-label", `${index < 0 ? "Remove" : "Save"} ${query} ${index < 0 ? "from" : "to"} saved places`);
favorite.textContent = index < 0 ? "Saved ♥" : "Save place ♡";
  });
});

searchForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  suggestions.hidden = true;
  qInput.setAttribute("aria-expanded", "false");
  searchLiveDestination();
  $("#destinations").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

/* ---------- 6. Saved collection (Trips & Destinations) ---------- */
let saved = store.get("saved", []);
if (!Array.isArray(saved)) saved = [];
let savedSearches = store.get("savedSearches", []);
if (!Array.isArray(savedSearches)) savedSearches = [];
else savedSearches = savedSearches.filter((item) => item && typeof item.query === "string");
const savedBtn = $("#saved-btn");
const savedPanel = $("#saved-panel");
const savedCount = $("#saved-count");
const savedList = $("#saved-list");

const savedDialog = $("#saved-dialog");
const savedDialogClose = $("#saved-dialog-close");
const tabSavedTrips = $("#tab-saved-trips");
const tabSavedPlaces = $("#tab-saved-places");
const panelSavedTrips = $("#panel-saved-trips");
const panelSavedPlaces = $("#panel-saved-places");
const dialogTripsCount = $("#dialog-trips-count");
const dialogPlacesCount = $("#dialog-places-count");
const dialogSavedTripsList = $("#dialog-saved-trips-list");
const dialogTripsEmpty = $("#dialog-trips-empty");
const dialogTripSync = $("#dialog-trip-sync");
const dialogSavedPlacesList = $("#dialog-saved-places-list");
const dialogPlacesEmpty = $("#dialog-places-empty");
const dialogPlacesClear = $("#dialog-places-clear");
const dialogJumpPlanner = $("#dialog-jump-planner");
const dialogJumpDestinations = $("#dialog-jump-destinations");
const openSavedDialogBtn = $("#open-saved-dialog-btn");

function setSavedDialogTab(tab = "trips") {
  const isTrips = tab === "trips";
  if (tabSavedTrips) {
    tabSavedTrips.classList.toggle("is-active", isTrips);
    tabSavedTrips.setAttribute("aria-selected", String(isTrips));
  }
  if (tabSavedPlaces) {
    tabSavedPlaces.classList.toggle("is-active", !isTrips);
    tabSavedPlaces.setAttribute("aria-selected", String(!isTrips));
  }
  if (panelSavedTrips) {
    panelSavedTrips.classList.toggle("is-active", isTrips);
    panelSavedTrips.hidden = !isTrips;
  }
  if (panelSavedPlaces) {
    panelSavedPlaces.classList.toggle("is-active", !isTrips);
    panelSavedPlaces.hidden = isTrips;
  }
}

function openSavedDialog(tab = "trips") {
  if (!savedDialog) return;
  setSavedDialogTab(tab);
  if (typeof renderSavedTrips === "function") renderSavedTrips();
  renderSaved();
  if (!savedDialog.open) {
    savedDialog.showModal();
    savedBtn?.setAttribute("aria-expanded", "true");
  }
}

function closeSavedDialog() {
  if (!savedDialog) return;
  if (savedDialog.open) savedDialog.close();
  savedBtn?.setAttribute("aria-expanded", "false");
}

function renderSaved() {
  const knownSaved = saved.filter((id) => DESTINATIONS[id]);
  const storedTrips = store.get("savedTrips", []);
  const trips = Array.isArray(storedTrips) ? storedTrips.filter((t) => t && typeof t === "object") : [];
  const placesCount = knownSaved.length + savedSearches.length;
  const totalCount = trips.length + placesCount;

  if (savedCount) {
    savedCount.textContent = String(totalCount);
    savedCount.hidden = totalCount === 0;
  }

  if (dialogTripsCount) dialogTripsCount.textContent = String(trips.length);
  if (dialogPlacesCount) dialogPlacesCount.textContent = String(placesCount);

  // Render Saved Destinations in Dialog
  if (dialogSavedPlacesList) {
    if (!knownSaved.length && !savedSearches.length) {
      if (dialogPlacesEmpty) dialogPlacesEmpty.hidden = false;
      dialogSavedPlacesList.replaceChildren();
    } else {
      if (dialogPlacesEmpty) dialogPlacesEmpty.hidden = true;
      dialogSavedPlacesList.replaceChildren();

      knownSaved.forEach((id) => {
        const d = DESTINATIONS[id];
        const li = document.createElement("li");
        li.className = "saved-place-item";

        const mainBtn = document.createElement("button");
        mainBtn.type = "button";
        mainBtn.className = "saved-place-main";
        mainBtn.dataset.openSaved = id;
        mainBtn.innerHTML = `
          <img src="${escapeHTML(d.img)}" alt="">
          <span class="saved-place-text">
            <strong>${escapeHTML(d.name)}</strong>
            <small>${escapeHTML(d.country)} · ${d.days} days · ${inr(d.price)}</small>
          </span>
        `;
        mainBtn.addEventListener("click", () => {
          closeSavedDialog();
          openDestination(id);
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "saved-place-delete";
        removeBtn.setAttribute("aria-label", `Remove ${d.name} from saved`);
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          saved = saved.filter((s) => s !== id);
          store.set("saved", saved);
          renderSaved();
          toast("Removed from saved", `${d.name} removed from your wishlist`, "♡");
        });

        li.append(mainBtn, removeBtn);
        dialogSavedPlacesList.appendChild(li);
      });

      savedSearches.forEach((item, index) => {
        if (!item || typeof item.query !== "string") return;
        const li = document.createElement("li");
        li.className = "saved-place-item";

        const mainBtn = document.createElement("button");
        mainBtn.type = "button";
        mainBtn.className = "saved-place-main";
        mainBtn.dataset.openSearchSaved = String(index);
        mainBtn.innerHTML = `
          <div style="width:48px;height:48px;border-radius:10px;background:var(--sage-soft);display:grid;place-items:center;font-size:1.2rem;flex-shrink:0">🔍</div>
          <span class="saved-place-text">
            <strong>${escapeHTML(item.query)}</strong>
            <small>Web destination search</small>
          </span>
        `;
        mainBtn.addEventListener("click", () => {
          closeSavedDialog();
          if (qInput) {
            qInput.value = item.query;
            state.q = item.query;
            if ($("#q-clear")) $("#q-clear").hidden = false;
            searchLiveDestination();
            $("#destinations")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
          }
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "saved-place-delete";
        removeBtn.setAttribute("aria-label", `Remove search ${item.query} from saved`);
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          savedSearches.splice(index, 1);
          store.set("savedSearches", savedSearches);
          renderSaved();
          toast("Search removed", item.query, "♡");
        });

        li.append(mainBtn, removeBtn);
        dialogSavedPlacesList.appendChild(li);
      });
    }
  }

  if (savedList) {
    if (!knownSaved.length && !savedSearches.length) {
      savedList.innerHTML = `<li class="saved-empty">No saved places yet. Tap the heart on any destination.</li>`;
    } else {
      savedList.innerHTML = knownSaved
        .map((id) => {
          const d = DESTINATIONS[id];
          return `<li><button type="button" data-open-saved="${id}">
            <img src="${escapeHTML(d.img)}" alt=""><span><strong>${escapeHTML(d.name)}</strong><small>${escapeHTML(d.country)} · ${d.days} days</small></span>
          </button></li>`;
        }).join("");
    }
  }

  $$(".heart").forEach((heart) => {
    const on = saved.includes(heart.dataset.fav);
    heart.setAttribute("aria-pressed", String(on));
    heart.setAttribute("aria-label", `${on ? "Remove" : "Save"} ${DESTINATIONS[heart.dataset.fav]?.name || "destination"} ${on ? "from" : "to"} your list`);
  });
}

function closeSavedPanel() {
  if (savedPanel) savedPanel.hidden = true;
  savedBtn?.setAttribute("aria-expanded", "false");
}

savedBtn?.addEventListener("click", () => {
  openSavedDialog("trips");
});

savedDialogClose?.addEventListener("click", closeSavedDialog);

savedDialog?.addEventListener("click", (e) => {
  if (e.target === savedDialog) closeSavedDialog();
});

tabSavedTrips?.addEventListener("click", () => setSavedDialogTab("trips"));
tabSavedPlaces?.addEventListener("click", () => setSavedDialogTab("places"));

openSavedDialogBtn?.addEventListener("click", () => openSavedDialog("trips"));

dialogPlacesClear?.addEventListener("click", () => {
  saved = [];
  savedSearches = [];
  store.set("saved", saved);
  store.set("savedSearches", savedSearches);
  renderSaved();
  toast("Saved places cleared", "Wishlist reset on all destinations", "♡");
});

$("#saved-clear")?.addEventListener("click", () => {
  saved = [];
  store.set("saved", saved);
  renderSaved();
  toast("Saved list cleared", "Hearts reset on all destinations", "♡");
});

dialogJumpPlanner?.addEventListener("click", () => {
  closeSavedDialog();
  $("#planner")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

dialogJumpDestinations?.addEventListener("click", () => {
  closeSavedDialog();
  $("#destinations")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

function handleSavedHash() {
  const hash = window.location.hash.toLowerCase();
  if (hash === "#saved-trips" || hash === "#saved") {
    openSavedDialog(hash === "#saved" ? "places" : "trips");
  }
}
window.addEventListener("hashchange", handleSavedHash);
if (["#saved-trips", "#saved"].includes(window.location.hash.toLowerCase())) {
  setTimeout(handleSavedHash, 200);
}

document.addEventListener("click", (e) => {
  if (!savedPanel || savedPanel.hidden) return;
  if (!savedPanel.contains(e.target) && !savedBtn?.contains(e.target)) closeSavedPanel();
});

$$(".heart").forEach((heart) => {
  heart.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = heart.dataset.fav;
    const isSaved = saved.includes(id);
    saved = isSaved ? saved.filter((s) => s !== id) : [...saved, id];
    store.set("saved", saved);
    heart.classList.remove("pop");
    // eslint-disable-next-line no-unused-expressions
    heart.offsetWidth;
    heart.classList.add("pop");
    renderSaved();
    toast(isSaved ? "Removed from saved" : `${DESTINATIONS[id].name} saved`, isSaved ? "Tap the heart again to re-add" : "Find it under the heart in the header", isSaved ? "♡" : "♥");
  });
});
renderSaved();

/* ---------- 7. Destination modal & articles ---------- */
const modal = $("#modal");
const modalBody = $("#modal-body");
const modalBackdrop = $("#modal-backdrop");
const modalClose = $("#modal-close");
let lastFocused = null;

function openModal(html) {
  if (!modal) return;
  lastFocused = document.activeElement;
  modalBody.innerHTML = html;
  modal.hidden = false;
  modalBackdrop.hidden = false;
  document.body.classList.add("is-locked");
  modalClose?.focus();
}
function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  modalBackdrop.hidden = true;
  if (!drawer.classList.contains("is-open")) document.body.classList.remove("is-locked");
  lastFocused?.focus?.();
}
modalClose?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", closeModal);

function destModalHTML(id) {
  const d = DESTINATIONS[id];
  if (!d) return "";
  return detailHTML(d, `data-book-dest="${id}"`, id);
}

function detailHTML(d, bookAttr, id, isTrip = false) {
  const highlights = d.highlights.map((h) =>
    `<div class="highlight"><span aria-hidden="true">${h.icon}</span><div><strong>${h.title}</strong><small>${h.text}</small></div></div>`
  ).join("");
  const itinerary = d.itinerary.map((s) =>
    `<li><span class="itin-day">${s.day}</span><div class="itin-card"><strong>${s.title}</strong><p>${s.text}</p></div></li>`
  ).join("");
  const reviews = d.reviews.map((r) =>
    `<div class="review"><div class="review-top"><span class="avatar a${(r.name.length % 6) + 1}">${r.initials}</span><div><strong>${r.name}</strong><small>${r.trip}</small></div><span class="stars" aria-label="${r.stars} out of 5">${"★".repeat(r.stars)}</span></div><p>${r.text}</p></div>`
  ).join("");

  return `
    <div class="dest-hero">
      <img src="${d.img}" alt="${d.title} in ${d.name}">
      <div class="dest-hero-copy">
        <div class="pill-row"><span class="pill">${d.country}</span><span class="pill">★ ${d.rating} · ${d.reviewCount} reviews</span></div>
        <h2 id="modal-title">${d.title}</h2>
        <p>${d.days} days · ${d.nights} nights · max ${d.group} travellers</p>
      </div>
    </div>
    <div class="modal-inner">
      <div class="modal-tabs" role="tablist" aria-label="Destination details">
        <button class="modal-tab is-active" role="tab" aria-selected="true" data-panel="overview">Overview</button>
        <button class="modal-tab" role="tab" aria-selected="false" data-panel="highlights">Highlights</button>
        <button class="modal-tab" role="tab" aria-selected="false" data-panel="itinerary">Day by day</button>
        <button class="modal-tab" role="tab" aria-selected="false" data-panel="reviews">Reviews</button>
      </div>

      <div class="modal-panel is-active" data-panel="overview">
        <div class="overview-grid">
          <div class="prose">
            <p>${d.summary}</p>
            <h4>Why travellers pick this trip</h4>
            <ul>
              <li>Small group — never more than ${d.group} travellers.</li>
              <li>Local guide with you the whole way, plus 24/7 support.</li>
              <li>Stays, local transport, breakfast and guides included.</li>
              <li>Free date changes up to 21 days before departure.</li>
            </ul>
          </div>
          <div class="fact-card">
            <h4>Trip facts</h4>
            <div class="fact"><span>Best months</span><strong>${d.best}</strong></div>
            <div class="fact"><span>Group size</span><strong>Max ${d.group}</strong></div>
            <div class="fact"><span>Pace</span><strong>${d.difficulty}</strong></div>
            <div class="fact"><span>Rating</span><strong>★ ${d.rating} / 5</strong></div>
            <div class="price-row"><strong>${inr(d.price)}</strong><small>per person</small></div>
            <button class="btn btn-primary full" ${bookAttr} style="margin-top:14px">Check dates <span aria-hidden="true">→</span></button>
            ${isTrip
              ? `<button class="btn btn-ghost full" ${bookAttr} style="margin-top:8px">See dates &amp; seats</button>`
              : `<button class="btn btn-ghost full" data-save-dest="${id}" style="margin-top:8px">${saved.includes(id) ? "♥ Saved" : "♡ Save for later"}</button>`}
          </div>
        </div>
      </div>

      <div class="modal-panel" data-panel="highlights">
        <div class="highlight-grid">${highlights}</div>
      </div>

      <div class="modal-panel" data-panel="itinerary">
        <ol class="itin">${itinerary}</ol>
      </div>

      <div class="modal-panel" data-panel="reviews">
        <div class="review-list">${reviews}</div>
        <p style="font-size:.72rem;color:var(--muted);margin-top:14px">Sample reviews for this student design concept.</p>
      </div>

      <div class="modal-cta">
        <div class="price-row"><strong>${inr(d.price)}</strong><small>per person · ${d.days} days</small></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-share-dest="${id}">Share</button>
          <button class="btn btn-primary" ${bookAttr}>Check dates <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>`;
}

function wireDestModal(id) {
  const d = DESTINATIONS[id];
  $$(".modal-tab", modal).forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".modal-tab", modal).forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      $$(".modal-panel", modal).forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.panel));
    });
  });
  $$("[data-book-trip]", modal).forEach((btn) => btn.addEventListener("click", () => {
    const t = TRIPS[btn.dataset.bookTrip];
    if (!t) return;
    closeModal();
    openBooking({ ...t, key: btn.dataset.bookTrip });
  }));
  $$("[data-book-dest]", modal).forEach((btn) => btn.addEventListener("click", () => {
    closeModal();
    openBooking({
      key: id, name: d.title, place: `${d.name} · ${d.country}`, img: d.img,
      price: d.price, max: d.group, seats: 4,
      dates: ["12 Nov 2026", "26 Nov 2026", "10 Dec 2026", "07 Jan 2027"]
    });
  }));
  $$("[data-save-dest]", modal).forEach((btn) => btn.addEventListener("click", () => {
    const on = saved.includes(id);
    saved = on ? saved.filter((s) => s !== id) : [...saved, id];
    store.set("saved", saved);
    btn.textContent = on ? "♡ Save for later" : "♥ Saved";
    renderSaved();
    toast(on ? "Removed from saved" : `${d.name} saved`, on ? "You can re-add it any time" : "Find it under the heart in the header", on ? "♡" : "♥");
  }));
  $$("[data-share-dest]", modal).forEach((btn) => btn.addEventListener("click", async () => {
    const text = `${d.title} — ${d.days} days in ${d.name} with Wanderly, from ${inr(d.price)} per person.`;
    try {
      if (navigator.share) await navigator.share({ title: d.title, text });
      else { await navigator.clipboard.writeText(text); toast("Copied to clipboard", "Paste it wherever you like", "⧉"); }
    } catch {
      toast("Ready to share", text, "⧉");
    }
  }));
}

function openDestination(id) {
  if (!DESTINATIONS[id]) return;
  openModal(destModalHTML(id));
  wireDestModal(id);
}

destCards.forEach((card) => {
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${card.querySelector("h3").textContent} details`);
  card.addEventListener("click", () => openDestination(card.dataset.id));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDestination(card.dataset.id); }
  });
});

/* journal articles */
function postModalHTML(key) {
  const p = POSTS[key];
  if (!p) return "";
  return `
    <div class="article-hero"><img src="${p.img}" alt=""></div>
    <div class="article-wrap">
      <div class="article-meta"><span>${p.kicker}</span><span class="dot"></span><span>${p.date}</span><span class="dot"></span><span>Wanderly route team</span></div>
      <h2 id="modal-title">${p.title}</h2>
      <p class="article-lead">${p.lead}</p>
      <div class="article-body">${p.body}</div>
      <div class="modal-cta">
        <p style="font-size:.8rem;color:var(--muted)">Enjoyed this? Get one postcard a month.</p>
        <a class="btn btn-primary" href="#contact" data-close-modal>Plan a trip <span aria-hidden="true">→</span></a>
      </div>
    </div>`;
}

$$(".post").forEach((post) => {
  post.setAttribute("tabindex", "0");
  post.setAttribute("role", "button");
  post.setAttribute("aria-label", `Read: ${post.querySelector("h3").textContent}`);
  const open = () => {
    openModal(postModalHTML(post.dataset.post));
    $$("[data-close-modal]", modal).forEach((el) => el.addEventListener("click", closeModal));
  };
  post.addEventListener("click", open);
  post.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
});

/* focus trap + escape */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSavedPanel();
    closeModal();
    closeBooking();
    closeMenu();
  }
  if (e.key === "Tab" && modal && !modal.hidden) {
    const focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- 8. Trip booking drawer ---------- */
const drawer = $("#booking-drawer");
const drawerBackdrop = $("#drawer-backdrop");
const bookingForm = $("#booking-form");
const drawerNext = $("#drawer-next");
const drawerBack = $("#drawer-back");
const drawerFoot = $("#drawer-foot");
const drawerTitle = $("#drawer-title");
const drawerTotal = $("#drawer-total");
const drawerTotalNote = $("#drawer-total-note");
const bookingSummary = $("#booking-summary");
const bookedSummary = $("#booked-summary");

const booking = { key: null, trip: null, step: 1, travellers: 2, room: "shared" };
const ROOM_SURCHARGE = 9500;

function openBooking(trip) {
  booking.trip = trip;
  booking.key = trip.key;
  booking.step = 1;
  booking.travellers = 2;
  booking.room = "shared";
  if (!drawer) return;

  drawerTitle.textContent = trip.name;
  bookingSummary.innerHTML = `<img src="${trip.img}" alt=""><div><strong>${trip.place}</strong><small>${trip.name}</small><small>${trip.seats} seats left · max ${trip.max}</small></div>`;
  $("#b-travellers").textContent = "2";
  const dateSelect = $("#b-date");
  if (dateSelect) dateSelect.innerHTML = trip.dates.map((d) => `<option>${d}</option>`).join("");
  const shared = $('input[name="room"][value="shared"]');
  if (shared) shared.checked = true;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  document.body.classList.add("is-locked");
  setBookingStep(1);
  drawerNext.focus();
}

function closeBooking() {
  if (!drawer || !drawer.classList.contains("is-open")) return;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.hidden = true;
  if (!modal || modal.hidden) document.body.classList.remove("is-locked");
}

function bookingTotal() {
  if (!booking.trip) return 0;
  const room = booking.room === "single" ? ROOM_SURCHARGE : 0;
  return (booking.trip.price + room) * booking.travellers;
}

function updateBookingTotal() {
  if (!drawerTotal) return;
  drawerTotal.textContent = inr(bookingTotal());
  drawerTotalNote.textContent = `for ${booking.travellers} traveller${booking.travellers === 1 ? "" : "s"}${booking.room === "single" ? " · private rooms" : ""}`;
}

function setBookingStep(step) {
  booking.step = step;
  $$(".drawer-step", drawer).forEach((s) => s.classList.toggle("is-active", Number(s.dataset.step) === step));
  $$("[data-step-dot]", drawer).forEach((dot) => {
    const n = Number(dot.dataset.stepDot);
    dot.classList.toggle("is-active", n === step);
    dot.classList.toggle("is-done", n < step);
  });
  if (drawerBack) drawerBack.hidden = step === 1;
  if (drawerNext) {
    drawerNext.textContent = step === 1 ? "Continue" : "Confirm booking";
    drawerNext.hidden = step === 3;
  }
  if (drawerFoot) drawerFoot.style.display = step === 3 ? "none" : "";
  updateBookingTotal();
  drawer.querySelector(".drawer-form")?.scrollTo({ top: 0 });
}

$$("[data-book]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const trip = TRIPS[btn.dataset.book];
    if (trip) openBooking({ ...trip, key: btn.dataset.book });
  });
});

$$(".trip-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    const trip = TRIPS[card.dataset.trip];
    if (trip) openBooking({ ...trip, key: card.dataset.trip });
  });
});

function openTripDetail(key) {
  const trip = TRIPS[key];
  if (!trip) return;
  const d = {
    ...trip,
    title: trip.name,
    country: trip.place,
    group: trip.max
  };
  openModal(detailHTML(d, `data-book-trip="${key}"`, key, true));
  wireDestModal(key);
}

$$("[data-details]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openTripDetail(btn.dataset.details);
  });
});

$("#drawer-close")?.addEventListener("click", closeBooking);
drawerBackdrop?.addEventListener("click", closeBooking);
drawerBack?.addEventListener("click", () => setBookingStep(clamp(booking.step - 1, 1, 3)));
$("#booked-done")?.addEventListener("click", closeBooking);

$$("[data-bstep]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const max = booking.trip?.seats || 8;
    booking.travellers = clamp(booking.travellers + Number(btn.dataset.bstep), 1, Math.min(max, 8));
    $("#b-travellers").textContent = String(booking.travellers);
    updateBookingTotal();
  });
});

$$('input[name="room"]').forEach((r) => r.addEventListener("change", () => {
  booking.room = r.value;
  updateBookingTotal();
}));

function fieldError(input, message) {
  const field = input.closest(".field") || input.closest("label")?.parentElement;
  const errorEl = field?.querySelector(".error");
  if (field) field.classList.toggle("has-error", Boolean(message));
  if (errorEl) errorEl.textContent = message;
  return !message;
}

function validateBookingStep2() {
  const name = $("#b-name");
  const email = $("#b-email");
  const phone = $("#b-phone");
  const terms = $("#b-terms");
  let ok = true;
  ok = fieldError(name, name.value.trim().length < 2 ? "Please tell us your name." : "") && ok;
  ok = fieldError(email, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim()) ? "" : "Enter a valid email address.") && ok;
  ok = fieldError(phone, /^[0-9+\s()-]{8,16}$/.test(phone.value.trim()) ? "" : "Enter a valid phone number.") && ok;
  const termsError = $("#b-terms-error");
  if (termsError) termsError.textContent = terms.checked ? "" : "Please accept the booking terms.";
  if (!terms.checked) ok = false;
  if (!ok) $("#drawer-title").animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
    { duration: 260 }
  );
  return ok;
}

drawerNext?.addEventListener("click", () => {
  if (booking.step === 1) { setBookingStep(2); $("#b-name").focus(); return; }
  if (booking.step === 2) {
    if (!validateBookingStep2()) return;
    finishBooking();
  }
});

function finishBooking() {
  const ref = `WDR-${Math.floor(1000 + Math.random() * 9000)}`;
  const date = $("#b-date").value;
  const name = $("#b-name").value.trim();
  const email = $("#b-email").value.trim();
  const room = booking.room === "single" ? "Private room" : "Shared twin";
  const total = bookingTotal();

  $("#booking-ref").textContent = ref;
  bookedSummary.innerHTML = `
    <div><span>Trip</span><strong>${booking.trip.name}</strong></div>
    <div><span>Departure</span><strong>${date}</strong></div>
    <div><span>Travellers</span><strong>${booking.travellers}</strong></div>
    <div><span>Room</span><strong>${room}</strong></div>
    <div><span>Estimate</span><strong>${inr(total)}</strong></div>`;

  const bookings = store.get("bookings", []);
  bookings.push({ ref, trip: booking.trip.name, date, travellers: booking.travellers, room, total, name, email, createdAt: new Date().toISOString() });
  store.set("bookings", bookings);

  setBookingStep(3);
  toast("Seat held", `${ref} · ${booking.trip.name}`, "✓");
}

$("#add-calendar")?.addEventListener("click", () => {
  const dateStr = $("#b-date").value;
  const parsed = new Date(`${dateStr} 09:00:00`);
  const start = isNaN(parsed) ? new Date() : parsed;
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wanderly//Demo//EN", "BEGIN:VEVENT",
    `UID:${Date.now()}@wanderly.example`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${booking.trip.name} with Wanderly`,
    `DESCRIPTION:Booking reference ${$("#booking-ref").textContent}. Demo booking from the Wanderly concept site.`,
    "LOCATION:" + booking.trip.place, "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "wanderly-trip.ics";
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Calendar file downloaded", "Open it to add the trip to your calendar", "▦");
});

/* ---------- 9. Trip planner ---------- */
const daysSlider = $("#days");
const peopleSlider = $("#people");
const daysOut = $("#days-out");
const peopleOut = $("#people-out");
const comfortBtns = $$("[data-comfort]");
const flightsToggle = $("#flights");
const insuranceToggle = $("#insurance");
const quoteTotal = $("#quote-total");
const quotePer = $("#quote-per");
const costProfileNote = $("#cost-profile-note");
const breakdown = $("#quote-breakdown");
const routeList = $("#route-list");
const routeDays = $("#route-days");
const plannerDestination = $("#planner-destination");
const plannerOrigin = $("#planner-origin");
const plannerDate = $("#planner-date");
const plannerReturnDate = $("#planner-return-date");
const plannerStyle = $("#planner-style");
const plannerBudgetInput = $("#planner-budget");
const plannerBudgetNote = $("#planner-budget-note");
const itineraryPanel = $("#itinerary-panel");
const itineraryTitle = $("#itinerary-title");
const itinerarySubtitle = $("#itinerary-subtitle");
const itineraryAnswer = $("#itinerary-answer");
const itineraryMeta = $("#itinerary-meta");
const itineraryNav = $("#itinerary-nav");
const itineraryNavScroll = $("#itinerary-nav-scroll");
const itinerarySources = $("#itinerary-sources");
const itinerarySourcesTitle = $("#itinerary-sources-title");
const itinerarySourcesCard = $("#itinerary-sources-card");
const quoteItineraryStatus = $("#quote-itinerary-status");
const savedTripList = $("#saved-trip-list");
const savedTripsPanel = $("#saved-trips");

const comfortRate = { 0.8: "simple", 1: "comfort", 1.65: "premium" };
const defaultPlanner = { days: 7, people: 2, comfort: 1, flights: false, insurance: true, destination: "", origin: "Jaipur", departureDate: "", returnDate: "", tripBudget: "", style: "culture" };
const previousPlannerValue = store.get("planner", store.get("plan", defaultPlanner));
const previousPlanner = previousPlannerValue && typeof previousPlannerValue === "object" ? previousPlannerValue : defaultPlanner;
let planner = {
  ...defaultPlanner,
  days: clamp(Number(previousPlanner.days) || 7, 3, 18),
  people: clamp(Number(previousPlanner.people) || 2, 1, 8),
  comfort: Object.hasOwn(comfortRate, Number(previousPlanner.comfort)) ? Number(previousPlanner.comfort) : 1,
  flights: Boolean(previousPlanner.flights),
  insurance: previousPlanner.insurance !== false,
  destination: typeof previousPlanner.destination === "string" ? previousPlanner.destination.slice(0, 120) : "",
  origin: typeof previousPlanner.origin === "string" ? previousPlanner.origin.slice(0, 80) : "Jaipur",
  departureDate: typeof previousPlanner.departureDate === "string" ? previousPlanner.departureDate : "",
  returnDate: typeof previousPlanner.returnDate === "string" ? previousPlanner.returnDate : "",
  tripBudget: previousPlanner.tripBudget === "" || previousPlanner.tripBudget == null
    ? ""
    : clamp(Number(previousPlanner.tripBudget) || 0, 0, 100000000),
  style: ["culture", "food", "nature", "adventure", "relaxation", "family", "budget", "luxury"].includes(previousPlanner.style) ? previousPlanner.style : "culture",
  costIndex: clamp(Number(previousPlanner.costIndex) || 1, 0.4, 5),
  costCountry: typeof previousPlanner.costCountry === "string" ? previousPlanner.costCountry : "India",
  costYear: typeof previousPlanner.costYear === "string" ? previousPlanner.costYear : "",
  costDestination: typeof previousPlanner.costDestination === "string" ? previousPlanner.costDestination : "",
  costStatus: "baseline",
  costError: ""
};
let itineraryController = null;
let currentItinerary = null;
let costProfileController = null;
let costProfileRequest = null;
let lastCostProfileDestination = "";

function paintRange(input) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const pct = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${pct}%`);
}

function dateOffset(dateString, days) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
}

function computeQuote() {
  const daily = { stay: 2600, food: 1500, experience: 1200 };
  const f = planner.comfort;
  const days = planner.days;
  const people = planner.people;
  const costIndex = clamp(Number(planner.costIndex) || 1, 0.4, 5);
  const stays = daily.stay * f * days * people * costIndex;
  const food = daily.food * f * days * people * costIndex;
  const experiences = daily.experience * f * days * people * costIndex;
  const transport = 7000 * Math.sqrt(f) * people * costIndex;
  const flights = planner.flights ? 24000 * people : 0;
  const insurance = planner.insurance ? 1400 * people : 0;
  const extras = flights + insurance;
  const total = stays + food + experiences + transport + extras;
  return { stays, food, experiences, transport, extras, flights, insurance, total };
}

function requestedTripBudget() {
  const customBudget = Number(planner.tripBudget);
  return planner.tripBudget !== "" && Number.isFinite(customBudget) ? customBudget : computeQuote().total;
}

function costProfileMessage() {
  if (planner.costStatus === "loading") return `Checking destination prices for ${planner.destination}; estimates remain in INR.`;
  if (planner.costStatus === "fallback") return `${planner.costError} Using the India baseline; all estimates remain in INR.`;
  if (planner.destination && planner.costIndex !== 1) {
    return `Local costs for ${planner.costCountry} are estimated at ${planner.costIndex.toFixed(2)}× India's price level (World Bank, ${planner.costYear}). All estimates are in INR; flights and insurance remain broad estimates.`;
  }
  if (planner.destination && planner.costYear) {
    const baseline = planner.costCountry === "India" ? "India is the price-level baseline" : `${planner.costCountry} uses India's baseline price level`;
    return `${baseline} (World Bank, ${planner.costYear}). All estimates are in INR; flights and insurance remain broad estimates.`;
  }
  return "Add a destination to adjust local costs against India's baseline. All estimates are in INR.";
}

async function updateCostProfile(destination) {
  const query = typeof destination === "string" ? destination.trim().slice(0, 120) : "";
  const key = query.normalize("NFKC").toLocaleLowerCase();
  if (!key) {
    costProfileController?.abort();
    costProfileController = null;
    costProfileRequest = null;
    lastCostProfileDestination = "";
    Object.assign(planner, { costIndex: 1, costCountry: "India", costYear: "", costDestination: "", costStatus: "baseline", costError: "" });
    renderQuote();
    return;
  }
  if (key === lastCostProfileDestination) return costProfileRequest || undefined;

  costProfileController?.abort();
  const controller = new AbortController();
  costProfileController = controller;
  lastCostProfileDestination = key;
  Object.assign(planner, { costIndex: 1, costCountry: "India", costYear: "", costDestination: "", costStatus: "loading", costError: "" });
  renderQuote();

  const request = (async () => {
    try {
      const response = await fetch(`/api/cost-profile?destination=${encodeURIComponent(query)}`, { signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Destination cost lookup failed.");
      if (controller !== costProfileController) return;
      const index = Number(data.costIndex);
      if (!Number.isFinite(index) || index <= 0 || typeof data.country !== "string" || typeof data.year !== "string") {
        throw new Error("Destination cost data was incomplete.");
      }
      Object.assign(planner, {
        costIndex: clamp(index, 0.4, 5),
        costCountry: data.country || "India",
        costYear: data.year,
        costDestination: key,
        costStatus: "adjusted",
        costError: ""
      });
      renderQuote();
    } catch (error) {
      if (controller.signal.aborted || controller !== costProfileController) return;
      console.error("Destination cost estimate failed:", error);
      lastCostProfileDestination = "";
      Object.assign(planner, {
        costIndex: 1,
        costCountry: "India",
        costYear: "",
        costDestination: "",
        costStatus: "fallback",
        costError: `Could not load price data for ${query}.`
      });
      renderQuote();
    } finally {
      if (controller === costProfileController) {
        costProfileController = null;
        costProfileRequest = null;
      }
    }
  })();
  costProfileRequest = request;
  return request;
}

function renderQuote() {
  const q = computeQuote();
  if (quoteTotal) quoteTotal.textContent = inr(q.total);
  if (quotePer) {
    quotePer.textContent = `${inr(q.total / planner.people)} per person · ${planner.days} days · ${comfortRate[planner.comfort]}`;
  }
  if (costProfileNote) costProfileNote.textContent = costProfileMessage();
  if (plannerBudgetNote) {
    plannerBudgetNote.textContent = planner.tripBudget === ""
      ? `AI plans use the live estimate of ${inr(q.total)} unless you set a budget.`
      : `Your AI plan will use a ${inr(requestedTripBudget())} total budget. Live estimate: ${inr(q.total)}.`;
  }
  if (breakdown) {
    const rows = [
      ["Stays", q.stays],
      ["Food & local transport", q.food + q.transport],
      ["Experiences & guides", q.experiences]
    ];
    if (planner.flights) rows.push(["Estimated flights", q.flights]);
    if (planner.insurance) rows.push(["Travel insurance", q.insurance]);
    breakdown.innerHTML = rows.map(([label, value]) => {
      const pct = q.total > 0 ? Math.round((value / q.total) * 100) : 0;
      return `<div class="bar-row"><div class="bar-top"><span>${label}</span><strong>${inr(value)}</strong></div><div class="bar"><span style="width:${pct}%"></span></div></div>`;
    }).join("");
  }
  if (routeList) {
    const stops = clamp(Math.round(planner.days / 2) + 1, 2, 6);
    const nightsEach = Math.max(1, Math.floor(planner.days / stops));
    const names = ["Arrive & find your feet", "Old town & local kitchens", "The big landscape day", "Slow day by the water", "Village stay & market", "Last morning, good coffee"];
    let day = 1;
    const items = [];
    for (let i = 0; i < stops; i += 1) {
      const span = i === stops - 1 ? planner.days - day + 1 : nightsEach;
      const end = Math.min(planner.days, day + span - 1);
      items.push(`<li><span>Day ${day}${end > day ? `–${end}` : ""} · ${names[i]}</span></li>`);
      day = end + 1;
      if (day > planner.days) break;
    }
    routeList.innerHTML = items.join("");
  }
  if (routeDays) routeDays.textContent = String(planner.days);
  store.set("planner", planner);
}

daysSlider?.addEventListener("input", (e) => {
  invalidateItinerary();
  planner.days = Number(e.target.value);
  if (planner.departureDate && planner.returnDate) {
    planner.returnDate = dateOffset(planner.departureDate, planner.days - 1);
    if (plannerReturnDate) plannerReturnDate.value = planner.returnDate;
  }
  if (daysOut) daysOut.textContent = `${planner.days} days`;
  paintRange(e.target);
  renderQuote();
});
peopleSlider?.addEventListener("input", (e) => {
  invalidateItinerary();
  planner.people = Number(e.target.value);
  if (peopleOut) peopleOut.textContent = `${planner.people} ${planner.people === 1 ? "person" : "people"}`;
  paintRange(e.target);
  renderQuote();
});
comfortBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    comfortBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-checked", "false"); });
    btn.classList.add("is-active");
    btn.setAttribute("aria-checked", "true");
    planner.comfort = Number(btn.dataset.comfort);
    renderQuote();
  });
});
flightsToggle?.addEventListener("change", (e) => { invalidateItinerary(); planner.flights = e.target.checked; renderQuote(); });
insuranceToggle?.addEventListener("change", (e) => { invalidateItinerary(); planner.insurance = e.target.checked; renderQuote(); });

/* Debounced Destination Autocomplete in Trip Planner */
function setupPlannerDestinationAutocomplete() {
  const input = plannerDestination;
  const list = $("#planner-dest-suggestions");
  const clearBtn = $("#planner-dest-clear");
  if (!input || !list) return;
  if (clearBtn) clearBtn.hidden = !input.value;

  let debounceTimer = null;
  let activeController = null;

  function renderPopular() {
    list.replaceChildren();
    const header = document.createElement("li");
    header.className = "sug-header";
    header.setAttribute("role", "presentation");
    header.innerHTML = `<span>Popular destinations</span><small>Pick or type any place</small>`;
    list.appendChild(header);

    const items = ALL_DESTINATIONS.filter((d) => d.img || ["Patagonia", "Swiss Alps", "Santorini", "Paris", "Tokyo", "Ladakh"].includes(d.name)).slice(0, 8);
    items.forEach((d) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const btn = document.createElement("button");
      btn.type = "button";
      const iconOrImg = d.img
        ? `<img src="${d.img}" alt="" width="40" height="40">`
        : `<span class="sug-icon" aria-hidden="true">${d.icon || "📍"}</span>`;
      btn.innerHTML = `${iconOrImg}<span><strong>${escapeHTML(d.name)}</strong><small>${escapeHTML(d.country)}${d.tag ? ` · ${escapeHTML(d.tag)}` : ""}</small></span><span class="sug-tag-pill">${escapeHTML(d.country)}</span>`;
      btn.addEventListener("click", () => select(d.name));
      li.appendChild(btn);
      list.appendChild(li);
    });

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function renderResults(places, query) {
    list.replaceChildren();
    const header = document.createElement("li");
    header.className = "sug-header";
    header.setAttribute("role", "presentation");
    header.innerHTML = `<span>Matching destinations</span><small>${places.length} result${places.length === 1 ? "" : "s"}</small>`;
    list.appendChild(header);

    if (!places.length) {
      const customLi = document.createElement("li");
      customLi.setAttribute("role", "option");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sug-custom-btn";
      btn.innerHTML = `<span class="sug-icon" aria-hidden="true">📍</span><span><strong>Use “${escapeHTML(query.trim())}”</strong><small>Plan trip for this custom destination</small></span>`;
      btn.addEventListener("click", () => select(query.trim()));
      customLi.appendChild(btn);
      list.appendChild(customLi);
    } else {
      places.forEach((p) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        const btn = document.createElement("button");
        btn.type = "button";

        const matchedLocal = ALL_DESTINATIONS.find((d) => normalise(d.name) === normalise(p.name));
        const iconOrImg = (matchedLocal && matchedLocal.img)
          ? `<img src="${matchedLocal.img}" alt="" width="40" height="40">`
          : `<span class="sug-icon" aria-hidden="true">${matchedLocal?.icon || "📍"}</span>`;

        const secondaryText = p.secondary || p.description || "";
        const countryTag = p.country || (p.secondary ? p.secondary.split(",").pop().trim() : "");
        const tagPill = countryTag ? `<span class="sug-tag-pill">${escapeHTML(countryTag)}</span>` : "";

        btn.innerHTML = `${iconOrImg}<span><strong>${highlightMatch(p.name, query)}</strong><small>${escapeHTML(secondaryText)}</small></span>${tagPill}`;
        btn.addEventListener("click", () => select(p.name));
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function select(destName) {
    input.value = destName;
    if (clearBtn) clearBtn.hidden = !destName;
    planner.destination = destName.slice(0, 120);
    invalidateItinerary();
    store.set("planner", planner);
    if (qInput) qInput.value = destName;
    if ($("#q-clear")) $("#q-clear").hidden = !destName;
    updateCostProfile(destName);
    close();
  }

  function close() {
    clearTimeout(debounceTimer);
    activeController?.abort();
    activeController = null;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    $$("button.is-hilite", list).forEach((b) => b.classList.remove("is-hilite"));
  }

  function triggerSearch(query) {
    clearTimeout(debounceTimer);
    activeController?.abort();

    if (!query.trim()) {
      renderPopular();
      return;
    }

    // Show searching spinner while waiting for debounced backend response
    list.replaceChildren();
    const loadingHeader = document.createElement("li");
    loadingHeader.className = "sug-header";
    loadingHeader.setAttribute("role", "presentation");
    loadingHeader.innerHTML = `<span>Matching destinations</span><small class="sug-loading"><span class="sug-spinner"></span> Searching places…</small>`;
    list.appendChild(loadingHeader);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");

    debounceTimer = setTimeout(async () => {
      const controller = new AbortController();
      activeController = controller;
      try {
        const places = await fetchPlaceSuggestions(query.trim(), "destination", controller.signal);
        if (controller.signal.aborted) return;
        renderResults(places, query.trim());
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn("Real-time destination autocomplete lookup error:", err);
        const localMatches = ALL_DESTINATIONS
          .filter((d) => normalise(d.name + " " + d.country).includes(normalise(query)))
          .slice(0, 7)
          .map((d) => ({
            name: d.name,
            secondary: d.country + (d.tag ? ` · ${d.tag}` : ""),
            description: d.name + ", " + d.country,
            country: d.country,
            source: "local"
          }));
        renderResults(localMatches, query.trim());
      }
    }, 280);
  }

  input.addEventListener("input", () => {
    planner.destination = input.value.slice(0, 120);
    invalidateItinerary();
    store.set("planner", planner);
    if (clearBtn) clearBtn.hidden = !input.value;
    triggerSearch(input.value);
  });

  input.addEventListener("change", () => {
    if (qInput) qInput.value = planner.destination;
    if ($("#q-clear")) $("#q-clear").hidden = !planner.destination;
    updateCostProfile(planner.destination);
  });

  input.addEventListener("focus", () => {
    triggerSearch(input.value);
  });

  input.addEventListener("focusout", (e) => {
    if (!list.contains(e.relatedTarget)) {
      setTimeout(close, 180);
    }
  });

  list.addEventListener("focusout", (e) => {
    if (e.relatedTarget !== input && !list.contains(e.relatedTarget)) {
      setTimeout(close, 180);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      if (list.hidden) {
        triggerSearch(input.value);
      } else {
        e.preventDefault();
        const firstBtn = list.querySelector("button");
        firstBtn?.focus();
        firstBtn?.classList.add("is-hilite");
      }
    } else if (e.key === "Enter") {
      if (!list.hidden) {
        const hilited = list.querySelector("button.is-hilite") || list.querySelector("button");
        if (hilited) {
          e.preventDefault();
          hilited.click();
        }
      }
    }
  });

  list.addEventListener("keydown", (e) => {
    const buttons = $$("button", list);
    const idx = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons.forEach((b) => b.classList.remove("is-hilite"));
      const next = buttons[Math.min(idx + 1, buttons.length - 1)];
      next?.focus();
      next?.classList.add("is-hilite");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons.forEach((b) => b.classList.remove("is-hilite"));
      if (idx <= 0) {
        input.focus();
      } else {
        const prev = buttons[idx - 1];
        prev?.focus();
        prev?.classList.add("is-hilite");
      }
    } else if (e.key === "Escape") {
      close();
      input.focus();
    }
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    if (clearBtn) clearBtn.hidden = true;
    planner.destination = "";
    invalidateItinerary();
    store.set("planner", planner);
    if (qInput) qInput.value = "";
    if ($("#q-clear")) $("#q-clear").hidden = true;
    updateCostProfile("");
    input.focus();
    renderPopular();
  });
}

/* Debounced Starting City Autocomplete in Trip Planner */
function setupPlannerOriginAutocomplete() {
  const input = plannerOrigin;
  const list = $("#planner-origin-suggestions");
  const clearBtn = $("#planner-origin-clear");
  if (!input || !list) return;
  if (clearBtn) clearBtn.hidden = !input.value;

  let debounceTimer = null;
  let activeController = null;

  function renderPopular() {
    list.replaceChildren();
    const header = document.createElement("li");
    header.className = "sug-header";
    header.setAttribute("role", "presentation");
    header.innerHTML = `<span>Popular starting cities</span><small>Hubs & airports</small>`;
    list.appendChild(header);

    const items = ALL_STARTING_CITIES.filter((c) => c.popular).slice(0, 8);
    items.forEach((c) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<span class="sug-icon sug-icon-city" aria-hidden="true">✈</span><span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.region ? `${c.region}, ${c.country}` : c.country)}${c.tag ? ` · ${escapeHTML(c.tag)}` : ""}</small></span><span class="sug-code-pill">${escapeHTML(c.code)}</span>`;
      btn.addEventListener("click", () => select(c.name));
      li.appendChild(btn);
      list.appendChild(li);
    });

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function renderResults(places, query) {
    list.replaceChildren();
    const header = document.createElement("li");
    header.className = "sug-header";
    header.setAttribute("role", "presentation");
    header.innerHTML = `<span>Matching starting cities</span><small>${places.length} result${places.length === 1 ? "" : "s"}</small>`;
    list.appendChild(header);

    if (!places.length) {
      const customLi = document.createElement("li");
      customLi.setAttribute("role", "option");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sug-custom-btn";
      btn.innerHTML = `<span class="sug-icon sug-icon-city" aria-hidden="true">✈</span><span><strong>Use “${escapeHTML(query.trim())}”</strong><small>Custom departure city</small></span>`;
      btn.addEventListener("click", () => select(query.trim()));
      customLi.appendChild(btn);
      list.appendChild(customLi);
    } else {
      places.forEach((p) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        const btn = document.createElement("button");
        btn.type = "button";

        const matchedLocal = ALL_STARTING_CITIES.find((c) => normalise(c.name) === normalise(p.name));
        const codePill = matchedLocal?.code
          ? `<span class="sug-code-pill">${escapeHTML(matchedLocal.code)}</span>`
          : (p.countryCode ? `<span class="sug-code-pill">${escapeHTML(p.countryCode)}</span>` : "");

        const secondaryText = p.secondary || p.description || "";

        btn.innerHTML = `<span class="sug-icon sug-icon-city" aria-hidden="true">✈</span><span><strong>${highlightMatch(p.name, query)}</strong><small>${escapeHTML(secondaryText)}</small></span>${codePill}`;
        btn.addEventListener("click", () => select(p.name));
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function select(cityName) {
    input.value = cityName;
    if (clearBtn) clearBtn.hidden = !cityName;
    planner.origin = cityName.slice(0, 80);
    store.set("planner", planner);
    close();
  }

  function close() {
    clearTimeout(debounceTimer);
    activeController?.abort();
    activeController = null;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    $$("button.is-hilite", list).forEach((b) => b.classList.remove("is-hilite"));
  }

  function triggerSearch(query) {
    clearTimeout(debounceTimer);
    activeController?.abort();

    if (!query.trim()) {
      renderPopular();
      return;
    }

    // Show searching spinner
    list.replaceChildren();
    const loadingHeader = document.createElement("li");
    loadingHeader.className = "sug-header";
    loadingHeader.setAttribute("role", "presentation");
    loadingHeader.innerHTML = `<span>Matching starting cities</span><small class="sug-loading"><span class="sug-spinner"></span> Searching cities…</small>`;
    list.appendChild(loadingHeader);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");

    debounceTimer = setTimeout(async () => {
      const controller = new AbortController();
      activeController = controller;
      try {
        const places = await fetchPlaceSuggestions(query.trim(), "city", controller.signal);
        if (controller.signal.aborted) return;
        renderResults(places, query.trim());
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn("Real-time city autocomplete lookup error:", err);
        const localMatches = ALL_STARTING_CITIES
          .filter((c) => normalise(c.name + " " + (c.region || "") + " " + c.country + " " + c.code).includes(normalise(query)))
          .slice(0, 7)
          .map((c) => ({
            name: c.name,
            secondary: (c.region ? `${c.region}, ` : "") + c.country,
            description: c.name + ", " + c.country,
            country: c.country,
            countryCode: c.code,
            source: "local"
          }));
        renderResults(localMatches, query.trim());
      }
    }, 280);
  }

  input.addEventListener("input", () => {
    planner.origin = input.value.slice(0, 80);
    store.set("planner", planner);
    if (clearBtn) clearBtn.hidden = !input.value;
    triggerSearch(input.value);
  });

  input.addEventListener("focus", () => {
    triggerSearch(input.value);
  });

  input.addEventListener("focusout", (e) => {
    if (!list.contains(e.relatedTarget)) {
      setTimeout(close, 180);
    }
  });

  list.addEventListener("focusout", (e) => {
    if (e.relatedTarget !== input && !list.contains(e.relatedTarget)) {
      setTimeout(close, 180);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      if (list.hidden) {
        triggerSearch(input.value);
      } else {
        e.preventDefault();
        const firstBtn = list.querySelector("button");
        firstBtn?.focus();
        firstBtn?.classList.add("is-hilite");
      }
    } else if (e.key === "Enter") {
      if (!list.hidden) {
        const hilited = list.querySelector("button.is-hilite") || list.querySelector("button");
        if (hilited) {
          e.preventDefault();
          hilited.click();
        }
      }
    }
  });

  list.addEventListener("keydown", (e) => {
    const buttons = $$("button", list);
    const idx = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons.forEach((b) => b.classList.remove("is-hilite"));
      const next = buttons[Math.min(idx + 1, buttons.length - 1)];
      next?.focus();
      next?.classList.add("is-hilite");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons.forEach((b) => b.classList.remove("is-hilite"));
      if (idx <= 0) {
        input.focus();
      } else {
        const prev = buttons[idx - 1];
        prev?.focus();
        prev?.classList.add("is-hilite");
      }
    } else if (e.key === "Escape") {
      close();
      input.focus();
    }
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    if (clearBtn) clearBtn.hidden = true;
    planner.origin = "";
    store.set("planner", planner);
    input.focus();
    renderPopular();
  });
}

setupPlannerDestinationAutocomplete();
setupPlannerOriginAutocomplete();

document.addEventListener("click", (e) => {
  const destField = plannerDestination?.closest(".planner-field");
  const originField = plannerOrigin?.closest(".planner-field");
  const heroField = qInput?.closest(".search-field");

  if (destField && !destField.contains(e.target)) {
    const destList = $("#planner-dest-suggestions");
    if (destList && !destList.hidden) {
      destList.hidden = true;
      plannerDestination?.setAttribute("aria-expanded", "false");
    }
  }

  if (originField && !originField.contains(e.target)) {
    const originList = $("#planner-origin-suggestions");
    if (originList && !originList.hidden) {
      originList.hidden = true;
      plannerOrigin?.setAttribute("aria-expanded", "false");
    }
  }

  if (heroField && !heroField.contains(e.target)) {
    if (suggestions && !suggestions.hidden) {
      suggestions.hidden = true;
      qInput?.setAttribute("aria-expanded", "false");
    }
  }
});
plannerDate?.addEventListener("change", () => {
  planner.departureDate = plannerDate.value;
  plannerReturnDate?.setCustomValidity("");
  if (plannerReturnDate) {
    plannerReturnDate.min = planner.departureDate ? dateOffset(planner.departureDate, 2) : "";
    plannerReturnDate.max = planner.departureDate ? dateOffset(planner.departureDate, 17) : "";
    if (planner.departureDate && planner.returnDate &&
      (daysBetween(planner.departureDate, planner.returnDate) < 3 || daysBetween(planner.departureDate, planner.returnDate) > 18)) {
      planner.returnDate = dateOffset(planner.departureDate, planner.days - 1);
      plannerReturnDate.value = planner.returnDate;
    }
  }
  invalidateItinerary();
  store.set("planner", planner);
});
plannerReturnDate?.addEventListener("change", () => {
  planner.returnDate = plannerReturnDate.value;
  plannerReturnDate.setCustomValidity("");
  if (planner.returnDate && !planner.departureDate) {
    plannerReturnDate.setCustomValidity("Choose a departure date first.");
    plannerReturnDate.reportValidity();
    return;
  }
  if (planner.returnDate) {
    const dateRangeDays = daysBetween(planner.departureDate, planner.returnDate);
    if (dateRangeDays < 3 || dateRangeDays > 18) {
      plannerReturnDate.setCustomValidity("Choose dates for a trip between 3 and 18 days.");
      plannerReturnDate.reportValidity();
      return;
    }
    planner.days = dateRangeDays;
    if (daysSlider) daysSlider.value = String(planner.days);
    if (daysOut) daysOut.textContent = `${planner.days} days`;
    if (daysSlider) paintRange(daysSlider);
  }
  invalidateItinerary();
  renderQuote();
});
plannerBudgetInput?.addEventListener("input", () => {
  plannerBudgetInput.setCustomValidity("");
  const budgetValue = plannerBudgetInput.value;
  if (budgetValue && (!plannerBudgetInput.validity.valid || Number(budgetValue) <= 0)) {
    plannerBudgetInput.setCustomValidity("Enter a budget between ₹1 and ₹10,00,00,000.");
  }
  planner.tripBudget = budgetValue === "" ? "" : Number(budgetValue);
  invalidateItinerary();
  renderQuote();
});
plannerStyle?.addEventListener("change", () => {
  planner.style = plannerStyle.value;
  invalidateItinerary();
  store.set("planner", planner);
});

const accountDialog = $("#account-dialog");
const accountButton = $("#account-button");
const accountLabel = $("#account-label");
const accountForm = $("#account-form");
const accountMessage = $("#account-message");
const accountNameField = $("#account-name-field");
const accountNameInput = $("#account-name");
const accountEmailInput = $("#account-email");
const accountPasswordInput = $("#account-password");
const accountSignedIn = $("#account-signed-in");
const accountEmailLabel = $("#account-email-label");
const accountToggle = $("#account-toggle");
const accountTitle = $("#account-title");
const accountIntro = $("#account-intro");
const accountSubmit = $("#account-submit");
const savedTripSync = $("#saved-trip-sync");
let accountConfigStatus = "ready";
let accountMode = "login";
let tripSyncQueue = Promise.resolve();
let pendingAccountAction = null;
const storedAccountSession = store.get("accountSession", null);
let accountSession = storedAccountSession?.access_token && storedAccountSession?.user?.id
  ? storedAccountSession
  : null;

function requireAccount(action) {
  if (accountSession?.user?.id) return true;
  pendingAccountAction = action;
  if (accountDialog && !accountDialog.open) accountDialog.showModal();
  setAccountMessage("Sign in or create an account to continue. Your trip details will be kept, and we’ll continue after sign-in.");
  return false;
}

function setAccountMessage(message = "", kind = "") {
  if (!accountMessage) return;
  accountMessage.textContent = message;
  accountMessage.hidden = !message;
  accountMessage.classList.toggle("is-error", kind === "error");
  accountMessage.classList.toggle("is-success", kind === "success");
}

function setAccountAvailability(available) {
  if (accountSubmit) accountSubmit.disabled = !available;
}

function setAccountMode(mode) {
  accountMode = mode;
  const registering = mode === "register";
  if (accountTitle) accountTitle.textContent = registering ? "Create account" : "Sign in";
  if (accountIntro) accountIntro.textContent = registering
    ? "Create a Wanderly account to sync your saved trips across all devices."
    : "Sign in to access your saved trips and synchronized travel plans.";
  if (accountNameField) accountNameField.hidden = !registering;
  if (accountNameInput) accountNameInput.required = registering;
  if (accountPasswordInput) accountPasswordInput.autocomplete = registering ? "new-password" : "current-password";
  if (accountSubmit) accountSubmit.textContent = registering ? "Create account" : "Sign in";
  if (accountToggle) accountToggle.textContent = registering ? "Already have an account? Sign in" : "Create a free account";
  const demoBtn = $("#account-demo-btn");
  if (demoBtn) demoBtn.hidden = registering;
  setAccountMessage("");
}

function setAccountSession(session) {
  accountSession = session;
  if (session) store.set("accountSession", session);
  else store.remove("accountSession");

  const signedIn = Boolean(session?.user?.id);
  if (accountForm) accountForm.hidden = signedIn;
  if (accountSignedIn) accountSignedIn.hidden = !signedIn;
  if (accountEmailLabel) {
    const displayName = session?.user?.name || session?.user?.user_metadata?.full_name || "";
    accountEmailLabel.textContent = displayName ? `${displayName} (${session?.user?.email || ""})` : (session?.user?.email || "");
  }
  if (accountToggle) accountToggle.hidden = signedIn;
  if (accountLabel) {
    const firstName = (session?.user?.name || "").split(" ")[0] || "Account";
    accountLabel.textContent = signedIn ? firstName : "Sign in";
  }
  if (accountButton) {
    accountButton.setAttribute("aria-label", signedIn ? `Account: ${session?.user?.email || "signed in"}` : "Sign in to Wanderly");
  }
  renderSavedTrips();
}

function sessionWithExpiry(session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("Authentication response was incomplete.");
  }
  const expiresAt = Number(session.expires_at) || Math.floor(Date.now() / 1000) + (Number(session.expires_in) || 86400 * 30);
  return { ...session, expires_at: expiresAt };
}

async function requestAuth(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(accountSession?.access_token ? { Authorization: `Bearer ${accountSession.access_token}` } : {}),
    ...options.headers
  };
  const response = await fetch(path, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Authentication failed (HTTP ${response.status}).`);
  }
  return data;
}

function mergeTrips(first, second) {
  const tripsById = new Map();
  [...first, ...second].forEach((trip) => {
    if (trip && typeof trip === "object" && typeof trip.id === "string") tripsById.set(trip.id, trip);
  });
  return [...tripsById.values()].slice(-20);
}

async function syncAccountTrips() {
  if (!accountSession?.user?.id) return;
  const userId = accountSession.user.id;
  const loadingMsg = "Loading your synced trips…";
  if (savedTripSync) savedTripSync.textContent = loadingMsg;
  if (dialogTripSync) dialogTripSync.textContent = loadingMsg;

  try {
    const res = await requestAuth("/api/auth/trips");
    const remoteTrips = Array.isArray(res?.saved_trips) ? res.saved_trips : [];
    const localTrips = store.get("savedTrips", []);
    const localOwner = store.get("savedTripsOwner", "");
    const canMergeLocalTrips = !localOwner || localOwner === userId;
    const trips = canMergeLocalTrips
      ? mergeTrips(remoteTrips, Array.isArray(localTrips) ? localTrips : [])
      : mergeTrips(remoteTrips, []);

    store.set("savedTrips", trips);
    store.set("savedTripsOwner", userId);
    renderSavedTrips();
    if (typeof renderSaved === "function") renderSaved();

    if (JSON.stringify(remoteTrips) !== JSON.stringify(trips)) {
      await requestAuth("/api/auth/trips", {
        method: "POST",
        body: JSON.stringify({ saved_trips: trips })
      });
    }

    const syncedMsg = "Your saved trips are synced to your account.";
    if (savedTripSync) savedTripSync.textContent = syncedMsg;
    if (dialogTripSync) dialogTripSync.textContent = syncedMsg;
  } catch (error) {
    console.warn("Could not sync account trips:", error);
    const msg = "Saved on this device. Sign in to sync across devices.";
    if (savedTripSync) savedTripSync.textContent = msg;
    if (dialogTripSync) dialogTripSync.textContent = msg;
  }
}

function syncSavedTrips(trips) {
  if (!accountSession?.user?.id) return;
  const snapshot = Array.isArray(trips) ? trips.slice(-20) : [];
  tripSyncQueue = tripSyncQueue.then(async () => {
    await requestAuth("/api/auth/trips", {
      method: "POST",
      body: JSON.stringify({ saved_trips: snapshot })
    });
    const msg = "Your saved trips are synced to your account.";
    if (savedTripSync) savedTripSync.textContent = msg;
    if (dialogTripSync) dialogTripSync.textContent = msg;
  }).catch((error) => {
    console.warn("Saved trip sync failed:", error);
  });
}

async function initializeAccount() {
  const dialog = accountDialog;
  if (!dialog || !accountButton) return;

  setAccountAvailability(true);
  setAccountSession(accountSession);
  setAccountMode("login");

  accountButton.addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    setAccountMessage("");
  });

  $("#account-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    pendingAccountAction = null;
  });

  accountToggle?.addEventListener("click", () => {
    setAccountMode(accountMode === "login" ? "register" : "login");
  });

  $("#account-demo-btn")?.addEventListener("click", () => {
    if (accountMode !== "login") setAccountMode("login");
    if (accountEmailInput) accountEmailInput.value = "demo@wanderly.com";
    if (accountPasswordInput) accountPasswordInput.value = "password123";
    accountForm?.requestSubmit();
  });

  accountForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!accountForm.reportValidity()) return;

    const email = accountEmailInput?.value.trim() || "";
    const password = accountPasswordInput?.value || "";
    const name = accountNameInput?.value.trim() || "";

    accountSubmit.disabled = true;
    setAccountMessage(accountMode === "register" ? "Creating your account…" : "Signing in…");

    try {
      const endpoint = accountMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const sessionData = await requestAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password, name })
      });

      setAccountSession(sessionWithExpiry(sessionData));
      setAccountMessage("You’re signed in! Loading your saved trips…", "success");
      await syncAccountTrips();
      accountForm.reset();
      const nextAction = pendingAccountAction;
      pendingAccountAction = null;
      dialog.close();
      const userName = sessionData.user?.name || email.split("@")[0];
      toast(`Welcome back, ${userName}!`, "Your account and saved trips are active.", "✓");
      if (nextAction) window.setTimeout(nextAction, 0);
    } catch (error) {
      console.error("Account authentication failed:", error);
      setAccountMessage(error.message || "Could not complete sign in. Please try again.", "error");
    } finally {
      accountSubmit.disabled = false;
    }
  });

  $("#account-signout")?.addEventListener("click", async () => {
    try {
      if (accountSession?.access_token) {
        await requestAuth("/api/auth/logout", { method: "POST" });
      }
    } catch (err) {
      console.warn("Sign-out request warning:", err);
    }
    setAccountSession(null);
    store.remove("savedTrips");
    store.remove("savedTripsOwner");
    renderSavedTrips();
    if (typeof renderSaved === "function") renderSaved();
    setAccountMode("login");
    setAccountMessage("You’ve signed out. Trips saved now will stay on this device.", "success");
    toast("Signed out", "You have signed out of your account.", "✓");
  });

  // Verify session on launch
  if (accountSession?.access_token) {
    try {
      const me = await requestAuth("/api/auth/me");
      if (me?.user) {
        setAccountSession({ ...accountSession, user: me.user });
        await syncAccountTrips();
      }
    } catch {
      setAccountSession(null);
    }
  }
}

function applyTripToPlanner(trip) {
  planner = {
    ...planner,
    days: clamp(Number(trip.days) || 7, 3, 18),
    people: clamp(Number(trip.people) || 2, 1, 8),
    comfort: Object.hasOwn(comfortRate, Number(trip.comfort)) ? Number(trip.comfort) : 1,
    flights: Boolean(trip.flights),
    insurance: trip.insurance !== false,
    destination: typeof trip.destination === "string" ? trip.destination : "",
    origin: typeof trip.origin === "string" ? trip.origin : "",
    departureDate: typeof trip.departureDate === "string" ? trip.departureDate : "",
    returnDate: typeof trip.returnDate === "string" ? trip.returnDate : "",
    tripBudget: trip.tripBudget === "" || trip.tripBudget == null ? "" : Number(trip.tripBudget),
    style: typeof trip.style === "string" ? trip.style : "culture",
    costIndex: clamp(Number(trip.costIndex) || 1, 0.4, 5),
    costCountry: typeof trip.costCountry === "string" ? trip.costCountry : "India",
    costYear: typeof trip.costYear === "string" ? trip.costYear : "",
    costDestination: typeof trip.costDestination === "string" ? trip.costDestination : "",
    costStatus: typeof trip.costYear === "string" && trip.costYear ? "adjusted" : "baseline",
    costError: ""
  };
  lastCostProfileDestination = planner.costDestination;
  syncPlannerControls();
  renderQuote();
  if (!planner.costDestination && planner.destination) updateCostProfile(planner.destination);
  currentItinerary = trip.itinerary ? {
    answer: trip.itinerary,
    results: trip.sources || [],
    destination: trip.destination,
    days: trip.days,
    travellers: trip.people,
    style: trip.style,
    departureDate: trip.departureDate,
    returnDate: trip.returnDate,
    origin: trip.origin,
    budget: trip.budget,
    estimatedBudget: trip.estimatedBudget
  } : null;
  renderItinerary(currentItinerary);
  closeSavedDialog();
  const targetElement = trip.itinerary ? $("#itinerary-panel") : $("#planner");
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
  toast("Trip loaded", `${trip.destination || "Custom trip"} · ${inr(trip.budget)}`, "✓");
}

function removeTripFromStorage(tripId, tripName) {
  const currentTrips = store.get("savedTrips", []);
  const remainingTrips = Array.isArray(currentTrips) ? currentTrips.filter((saved) => saved?.id !== tripId) : [];
  store.set("savedTrips", remainingTrips);
  renderSavedTrips();
  renderSaved();
  syncSavedTrips(remainingTrips);
  toast("Trip removed", tripName || "Custom trip", "♡");
}

function renderSavedTrips() {
  const storedTrips = store.get("savedTrips", []);
  const trips = Array.isArray(storedTrips) ? storedTrips.filter((trip) => trip && typeof trip === "object") : [];

  const syncMessage = accountSession
    ? "Your saved trips sync securely to your account."
    : "Saved on this device. Sign in to sync across devices.";
  if (savedTripSync) savedTripSync.textContent = syncMessage;
  if (dialogTripSync) dialogTripSync.textContent = syncMessage;
  if (dialogTripsCount) dialogTripsCount.textContent = String(trips.length);

  // 1. Render in Quote Card aside (#saved-trip-list)
  if (savedTripList) {
    savedTripList.replaceChildren();
    if (savedTripsPanel) savedTripsPanel.hidden = trips.length === 0 && !accountSession;

    trips.forEach((trip) => {
      const item = document.createElement("li");
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = trip.destination || "Custom trip";
      const meta = document.createElement("small");
      meta.textContent = `${trip.days} days · ${trip.people} traveller${trip.people === 1 ? "" : "s"} · ${inr(trip.budget)}`;
      details.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "saved-trip-actions";

      const load = document.createElement("button");
      load.className = "text-btn";
      load.type = "button";
      load.textContent = "Load";
      load.addEventListener("click", () => applyTripToPlanner(trip));

      const remove = document.createElement("button");
      remove.className = "text-btn";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove saved trip to ${trip.destination || "Custom trip"}`);
      remove.addEventListener("click", () => removeTripFromStorage(trip.id, trip.destination));

      actions.append(load, remove);
      item.append(details, actions);
      savedTripList.appendChild(item);
    });
  }

  // 2. Render in Full Dedicated Dialog (#dialog-saved-trips-list)
  if (dialogSavedTripsList) {
    dialogSavedTripsList.replaceChildren();
    if (trips.length === 0) {
      if (dialogTripsEmpty) dialogTripsEmpty.hidden = false;
    } else {
      if (dialogTripsEmpty) dialogTripsEmpty.hidden = true;

      trips.forEach((trip) => {
        const card = document.createElement("div");
        card.className = "saved-trip-card";

        const info = document.createElement("div");
        info.className = "saved-trip-info";

        const destBadge = document.createElement("div");
        destBadge.className = "saved-trip-dest-badge";
        destBadge.innerHTML = `<span class="saved-trip-icon" aria-hidden="true">✈</span><span>${escapeHTML(trip.destination || "Custom trip")}</span>`;

        const chips = document.createElement("div");
        chips.className = "saved-trip-chips";

        const priceChip = document.createElement("span");
        priceChip.className = "saved-chip saved-chip-price";
        priceChip.textContent = inr(trip.budget);
        chips.appendChild(priceChip);

        const daysChip = document.createElement("span");
        daysChip.className = "saved-chip";
        daysChip.textContent = `⏱ ${trip.days} days`;
        chips.appendChild(daysChip);

        const peopleChip = document.createElement("span");
        peopleChip.className = "saved-chip";
        peopleChip.textContent = `👥 ${trip.people} ${trip.people === 1 ? "traveller" : "travellers"}`;
        chips.appendChild(peopleChip);

        if (trip.style) {
          const styleChip = document.createElement("span");
          styleChip.className = "saved-chip";
          styleChip.textContent = `🎨 ${trip.style.replace(/^\w/, (l) => l.toUpperCase())}`;
          chips.appendChild(styleChip);
        }

        if (trip.origin) {
          const originChip = document.createElement("span");
          originChip.className = "saved-chip";
          originChip.textContent = `🛫 From ${trip.origin}`;
          chips.appendChild(originChip);
        }

        if (trip.departureDate) {
          const dateChip = document.createElement("span");
          dateChip.className = "saved-chip";
          dateChip.textContent = `📅 ${trip.departureDate}${trip.returnDate ? ` → ${trip.returnDate}` : ""}`;
          chips.appendChild(dateChip);
        }

        const itinChip = document.createElement("span");
        itinChip.className = "saved-chip";
        itinChip.textContent = trip.itinerary ? "✓ Full AI itinerary" : "Quote plan";
        chips.appendChild(itinChip);

        info.append(destBadge, chips);

        const actions = document.createElement("div");
        actions.className = "saved-trip-actions";

        const loadBtn = document.createElement("button");
        loadBtn.type = "button";
        loadBtn.className = "btn btn-primary btn-sm";
        loadBtn.innerHTML = `Load &amp; View Plan <span aria-hidden="true">→</span>`;
        loadBtn.addEventListener("click", () => applyTripToPlanner(trip));

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "text-btn";
        removeBtn.textContent = "Remove";
        removeBtn.setAttribute("aria-label", `Remove saved trip to ${trip.destination || "Custom trip"}`);
        removeBtn.addEventListener("click", () => removeTripFromStorage(trip.id, trip.destination));

        actions.append(loadBtn, removeBtn);
        card.append(info, actions);
        dialogSavedTripsList.appendChild(card);
      });
    }
  }

  // 3. Update heart badge count in header
  if (savedCount) {
    const knownSaved = saved.filter((id) => DESTINATIONS[id]);
    const totalCount = trips.length + knownSaved.length + savedSearches.length;
    savedCount.textContent = String(totalCount);
    savedCount.hidden = totalCount === 0;
  }
}

function syncPlannerControls() {
  if (daysSlider) daysSlider.value = String(planner.days);
  if (daysOut) daysOut.textContent = `${planner.days} days`;
  if (peopleSlider) peopleSlider.value = String(planner.people);
  if (peopleOut) peopleOut.textContent = `${planner.people} ${planner.people === 1 ? "person" : "people"}`;
  if (plannerDestination) {
    plannerDestination.value = planner.destination || "";
    const clearDest = $("#planner-dest-clear");
    if (clearDest) clearDest.hidden = !planner.destination;
  }
  if (plannerOrigin) {
    plannerOrigin.value = planner.origin || "";
    const clearOrigin = $("#planner-origin-clear");
    if (clearOrigin) clearOrigin.hidden = !planner.origin;
  }
  if (plannerDate) plannerDate.value = planner.departureDate || "";
  if (plannerReturnDate) {
    plannerReturnDate.value = planner.returnDate || "";
    plannerReturnDate.min = planner.departureDate ? dateOffset(planner.departureDate, 2) : "";
    plannerReturnDate.max = planner.departureDate ? dateOffset(planner.departureDate, 17) : "";
    plannerReturnDate.setCustomValidity("");
  }
  if (plannerBudgetInput) plannerBudgetInput.value = planner.tripBudget === "" ? "" : String(planner.tripBudget);
  if (plannerStyle) plannerStyle.value = planner.style || "culture";
  if (flightsToggle) flightsToggle.checked = planner.flights;
  if (insuranceToggle) insuranceToggle.checked = planner.insurance;
  if (daysSlider) paintRange(daysSlider);
  if (peopleSlider) paintRange(peopleSlider);
  comfortBtns.forEach((button) => {
    const active = Number(button.dataset.comfort) === planner.comfort;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function invalidateItinerary() {
  itineraryController?.abort();
  itineraryController = null;
  const button = $("#create-itinerary");
  if (button) {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
  currentItinerary = null;
  renderItinerary(null);
}

function formatInlineMarkdown(text) {
  if (!text) return "";
  let escaped = escapeHTML(text);
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/__(.+?)__/g, "<strong>$1</strong>");
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  return escaped;
}

function parseItinerarySections(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ");

  const dayNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  let latestDay = 0;
  const withSeparatedDays = text.replace(/[:;]\s*(?:(?:the\s+)?next day|(?:the\s+)?day\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\b)/gi, (marker, day) => {
    latestDay = day ? Number(dayNumbers[day.toLowerCase()] || day) : latestDay + 1;
    return `\n\n## Day ${latestDay} `;
  });

  const lines = withSeparatedDays.split("\n").map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let currentSection = null;

  function startSection(type, title, rawTitle = "") {
    currentSection = {
      type,
      title: title || "Trip Section",
      rawTitle: rawTitle || title,
      dayNumber: 0,
      dayTitle: "",
      lines: []
    };
    if (type === "day") {
      const match = title.match(/^Day\s+(\d{1,2})(?:\s*[—–:-]\s*(.+))?$/i);
      if (match) {
        currentSection.dayNumber = Number(match[1]);
        currentSection.dayTitle = (match[2] || "").trim();
      }
    }
    sections.push(currentSection);
  }

  lines.forEach((line) => {
    if (/^#{1,3}$/.test(line)) return;

    const mdHeading = line.match(/^#{1,3}\s+(.+)$/);
    const dayHeading = line.match(/^(?:(?:\*\*|__)?Day\s+(\d{1,2})\b.*?(?:\*\*|__)?)$/i);
    const namedHeading = line.match(/^(?:(?:\*\*|__)?(Trip overview|Overview|Where to stay|Suggested stay|Accommodation|Lodging|Food to try|Must-try foods|Local dishes|Food highlights|Dining|Budget notes|Daily budget|Typical daily costs|Budget advice|Practical tips|Travel tips|Getting around|Transport|Logistics)\b\s*:?\s*(?:\*\*|__)?)\s*:?\s*(.*)$/i);

    if (mdHeading) {
      const headingText = mdHeading[1].replace(/[*_#]/g, "").trim();
      const isDay = /^day\s+\d{1,2}\b/i.test(headingText);
      const isOverview = /^(?:trip\s+)?overview$/i.test(headingText);
      const isStay = /^(?:where to stay|suggested stay|accommodation|lodging)$/i.test(headingText);
      const isFood = /^(?:food to try|must-try foods|local dishes|food highlights|dining)$/i.test(headingText);
      const isBudget = /^(?:budget notes|daily budget|typical daily costs|budget advice)$/i.test(headingText);
      const isTips = /^(?:practical tips|travel tips|getting around|transport|logistics)$/i.test(headingText);

      if (isDay) startSection("day", headingText);
      else if (isOverview) startSection("overview", "Trip Overview");
      else if (isStay) startSection("stay", "Where to Stay");
      else if (isFood) startSection("food", "Must-Try Local Food");
      else if (isBudget) startSection("budget", "Budget & Daily Costs");
      else if (isTips) startSection("tips", "Practical Travel Tips");
      else startSection("general", headingText);
      return;
    }

    if (namedHeading) {
      const name = namedHeading[1].replace(/[*_]/g, "").trim();
      const remainder = namedHeading[2] ? namedHeading[2].trim() : "";
      if (/^(?:where to stay|suggested stay|accommodation|lodging)$/i.test(name)) startSection("stay", "Where to Stay");
      else if (/^(?:food to try|must-try foods|local dishes|food highlights|dining)$/i.test(name)) startSection("food", "Must-Try Local Food");
      else if (/^(?:budget notes|daily budget|typical daily costs|budget advice)$/i.test(name)) startSection("budget", "Budget & Daily Costs");
      else if (/^(?:practical tips|travel tips|getting around|transport|logistics)$/i.test(name)) startSection("tips", "Practical Travel Tips");
      else if (/^(?:trip overview|overview)$/i.test(name)) startSection("overview", "Trip Overview");
      else startSection("general", name);

      if (remainder && currentSection) currentSection.lines.push(remainder);
      return;
    }

    if (dayHeading && (/^Day\s+\d{1,2}\s*(?:[—–:-]\s*[^.!?]{1,90})?$/i.test(dayHeading[0].replace(/[*_]/g, "").trim()))) {
      const cleanDay = dayHeading[0].replace(/[*_]/g, "").trim();
      startSection("day", cleanDay);
      return;
    }

    if (!currentSection) {
      startSection("overview", "Trip Overview");
    }
    currentSection.lines.push(line);
  });

  return sections;
}

function parseDaySlots(lines) {
  const slots = [];
  let currentSlot = null;

  function ensureSlot(type, title, icon) {
    currentSlot = { type, title, icon, items: [] };
    slots.push(currentSlot);
  }

  lines.forEach((line) => {
    const clean = line.replace(/^[*-•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    if (!clean) return;

    const morningMatch = clean.match(/^(?:(?:\*\*|__)?(?:Morning|Early Morning|Sunrise|Dawn)\b(?:\*\*|__)?)\s*:?\s*(.*)$/i);
    const afternoonMatch = clean.match(/^(?:(?:\*\*|__)?(?:Afternoon|Midday|Lunch|Lunchtime)\b(?:\*\*|__)?)\s*:?\s*(.*)$/i);
    const eveningMatch = clean.match(/^(?:(?:\*\*|__)?(?:Evening|Night|Dinner|Sunset|Dusk)\b(?:\*\*|__)?)\s*:?\s*(.*)$/i);
    const transitMatch = clean.match(/^(?:(?:\*\*|__)?(?:Getting around|Transport|Transit|Logistics)\b(?:\*\*|__)?)\s*:?\s*(.*)$/i);
    const highlightMatch = clean.match(/^(?:(?:\*\*|__)?(?:Highlight|Must-see|Key sight|Tip)\b(?:\*\*|__)?)\s*:?\s*(.*)$/i);

    if (morningMatch) {
      ensureSlot("morning", "Morning", "🌅");
      if (morningMatch[1].trim()) currentSlot.items.push(morningMatch[1].trim());
      return;
    }
    if (afternoonMatch) {
      ensureSlot("afternoon", "Afternoon", "☀️");
      if (afternoonMatch[1].trim()) currentSlot.items.push(afternoonMatch[1].trim());
      return;
    }
    if (eveningMatch) {
      ensureSlot("evening", "Evening", "🌙");
      if (eveningMatch[1].trim()) currentSlot.items.push(eveningMatch[1].trim());
      return;
    }
    if (transitMatch) {
      ensureSlot("transit", "Getting around", "🚇");
      if (transitMatch[1].trim()) currentSlot.items.push(transitMatch[1].trim());
      return;
    }
    if (highlightMatch) {
      ensureSlot("highlight", "Key Highlight", "📍");
      if (highlightMatch[1].trim()) currentSlot.items.push(highlightMatch[1].trim());
      return;
    }

    if (!currentSlot) {
      ensureSlot("general", "Activities", "📍");
    }
    currentSlot.items.push(clean);
  });

  return slots;
}

function renderOverviewCard(section) {
  const card = document.createElement("div");
  card.className = "itinerary-overview-card";
  card.id = "itin-section-overview";

  const head = document.createElement("div");
  head.className = "itin-overview-head";
  head.innerHTML = `<span aria-hidden="true">🧭</span><span>Trip Overview</span>`;
  card.appendChild(head);

  section.lines.forEach((line) => {
    const p = document.createElement("p");
    p.innerHTML = formatInlineMarkdown(line);
    card.appendChild(p);
  });

  return card;
}

function renderDayCard(section, index) {
  const card = document.createElement("article");
  card.className = "itinerary-day-card is-open";
  card.id = `itin-day-${section.dayNumber || index + 1}`;
  card.dataset.day = String(section.dayNumber || index + 1);

  const header = document.createElement("header");
  header.className = "itin-day-header";
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "true");
  header.setAttribute("aria-controls", `itin-body-${section.dayNumber || index + 1}`);

  const meta = document.createElement("div");
  meta.className = "itin-day-meta";

  const badge = document.createElement("span");
  badge.className = "itin-day-badge";
  badge.textContent = `Day ${section.dayNumber || index + 1}`;

  const title = document.createElement("h4");
  title.className = "itin-day-title";
  const cleanTitle = section.dayTitle || section.title.replace(/^Day\s+\d{1,2}\s*[—–:-]\s*/i, "").trim() || "Full Day Exploration";
  title.textContent = cleanTitle;

  meta.append(badge, title);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "itin-day-toggle";
  toggle.setAttribute("aria-label", `Toggle Day ${section.dayNumber || index + 1} details`);
  toggle.innerHTML = `<span aria-hidden="true">▾</span>`;

  header.append(meta, toggle);

  const body = document.createElement("div");
  body.className = "itin-day-body";
  body.id = `itin-body-${section.dayNumber || index + 1}`;

  const slots = parseDaySlots(section.lines);
  const slotsGrid = document.createElement("div");
  slotsGrid.className = "itin-slots-grid";

  slots.forEach((slot) => {
    const slotCard = document.createElement("div");
    slotCard.className = `itin-slot slot-${slot.type}`;

    const slotBadge = document.createElement("div");
    slotBadge.className = "itin-slot-badge";
    slotBadge.innerHTML = `<span class="itin-slot-icon" aria-hidden="true">${slot.icon}</span><span class="itin-slot-name">${escapeHTML(slot.title)}</span>`;

    const details = document.createElement("div");
    details.className = "itin-slot-details";

    if (slot.items.length === 1) {
      const p = document.createElement("p");
      p.innerHTML = formatInlineMarkdown(slot.items[0]);
      details.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      slot.items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = formatInlineMarkdown(item);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    slotCard.append(slotBadge, details);
    slotsGrid.appendChild(slotCard);
  });

  body.appendChild(slotsGrid);
  card.append(header, body);

  function toggleDay() {
    const closed = card.classList.toggle("is-closed");
    header.setAttribute("aria-expanded", String(!closed));
    toggle.setAttribute("aria-expanded", String(!closed));
  }

  header.addEventListener("click", toggleDay);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDay();
    }
  });

  return card;
}

function renderReferenceCard(section) {
  const card = document.createElement("article");
  card.className = `itinerary-ref-card ref-${section.type}`;
  card.id = `itin-section-${section.type}`;

  const icons = {
    stay: "🏨",
    food: "🍜",
    budget: "💰",
    tips: "💡",
    general: "📌"
  };
  const subtitles = {
    stay: "Curated neighborhoods & base recommendations",
    food: "Signature regional dishes & dining culture",
    budget: "Daily spending estimates & cost optimization",
    tips: "Local customs, transit passes, connectivity & essentials",
    general: "Practical trip guidance"
  };

  const header = document.createElement("header");
  header.className = "itin-ref-header";
  header.innerHTML = `
    <span class="itin-ref-icon" aria-hidden="true">${icons[section.type] || "📌"}</span>
    <div>
      <h4>${escapeHTML(section.title)}</h4>
      <p class="itin-ref-sub">${escapeHTML(subtitles[section.type] || "")}</p>
    </div>
  `;
  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "itin-ref-body";

  const isBulletList = section.lines.some((l) => /^[*-•]\s+|\d+[.)]\s+/.test(l));
  if (isBulletList) {
    const ul = document.createElement("ul");
    section.lines.forEach((l) => {
      const clean = l.replace(/^[*-•]\s+|\d+[.)]\s+/, "").trim();
      if (!clean) return;
      const li = document.createElement("li");
      li.innerHTML = formatInlineMarkdown(clean);
      ul.appendChild(li);
    });
    body.appendChild(ul);
  } else {
    section.lines.forEach((l) => {
      if (!l.trim()) return;
      const p = document.createElement("p");
      p.innerHTML = formatInlineMarkdown(l);
      body.appendChild(p);
    });
  }

  card.appendChild(body);
  return card;
}

function buildItineraryNavigation(sections, hasSources) {
  if (!itineraryNav || !itineraryNavScroll) return;
  itineraryNavScroll.replaceChildren();

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "itinerary-nav-btn is-active";
  allBtn.innerHTML = `<span>✨</span><span>All</span>`;
  allBtn.addEventListener("click", () => {
    $$(".itinerary-nav-btn", itineraryNav).forEach((b) => b.classList.remove("is-active"));
    allBtn.classList.add("is-active");
    itineraryAnswer?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  });
  itineraryNavScroll.appendChild(allBtn);

  sections.forEach((sec, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "itinerary-nav-btn";

    let label = "";
    let targetId = "";

    if (sec.type === "overview") {
      label = "🧭 Overview";
      targetId = "itin-section-overview";
    } else if (sec.type === "day") {
      label = `Day ${sec.dayNumber || idx + 1}`;
      targetId = `itin-day-${sec.dayNumber || idx + 1}`;
    } else if (sec.type === "stay") {
      label = "🏨 Stay";
      targetId = "itin-section-stay";
    } else if (sec.type === "food") {
      label = "🍜 Food";
      targetId = "itin-section-food";
    } else if (sec.type === "budget") {
      label = "💰 Budget";
      targetId = "itin-section-budget";
    } else if (sec.type === "tips") {
      label = "💡 Tips";
      targetId = "itin-section-tips";
    } else {
      label = `📌 ${sec.title.slice(0, 16)}`;
      targetId = `itin-section-${idx}`;
    }

    btn.textContent = label;
    btn.addEventListener("click", () => {
      $$(".itinerary-nav-btn", itineraryNav).forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const target = document.getElementById(targetId);
      if (target) {
        if (target.classList.contains("is-closed")) {
          target.classList.remove("is-closed");
          target.querySelector(".itin-day-header")?.setAttribute("aria-expanded", "true");
        }
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }
    });
    itineraryNavScroll.appendChild(btn);
  });

  if (hasSources) {
    const srcBtn = document.createElement("button");
    srcBtn.type = "button";
    srcBtn.className = "itinerary-nav-btn";
    srcBtn.textContent = "🔗 Sources";
    srcBtn.addEventListener("click", () => {
      $$(".itinerary-nav-btn", itineraryNav).forEach((b) => b.classList.remove("is-active"));
      srcBtn.classList.add("is-active");
      itinerarySourcesCard?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    itineraryNavScroll.appendChild(srcBtn);
  }

  itineraryNav.hidden = false;
}

function buildPlainTextItinerary(data, sections) {
  const dest = data.destination || planner.destination || "Destination";
  const days = data.days || planner.days;
  const travellers = data.travellers || planner.people;
  const style = (data.style || planner.style || "").toUpperCase();
  const budget = data.budget ? inr(Number(data.budget)) : "";

  let output = ` Wanderly Trip Plan: ${dest} (${days} Days · ${style})\n`;
  output += `Travellers: ${travellers} | Budget: ${budget}\n`;
  if (data.origin) output += `Departing from: ${data.origin}\n`;
  if (data.departureDate) output += `Dates: ${data.departureDate}${data.returnDate ? ` to ${data.returnDate}` : ""}\n`;
  output += `--------------------------------------------------\n\n`;

  sections.forEach((sec) => {
    if (sec.type === "overview") {
      output += `🧭 TRIP OVERVIEW\n${sec.lines.join("\n")}\n\n`;
    } else if (sec.type === "day") {
      output += `🗓️ DAY ${sec.dayNumber}: ${sec.dayTitle || sec.title}\n`;
      const slots = parseDaySlots(sec.lines);
      slots.forEach((s) => {
        output += `  ${s.title}:\n`;
        s.items.forEach((item) => output += `    • ${item}\n`);
      });
      output += "\n";
    } else if (sec.type === "stay") {
      output += `🏨 WHERE TO STAY\n${sec.lines.map((l) => `  • ${l}`).join("\n")}\n\n`;
    } else if (sec.type === "food") {
      output += `🍜 FOOD TO TRY\n${sec.lines.map((l) => `  • ${l}`).join("\n")}\n\n`;
    } else if (sec.type === "budget") {
      output += `💰 BUDGET NOTES\n${sec.lines.map((l) => `  • ${l}`).join("\n")}\n\n`;
    } else if (sec.type === "tips") {
      output += `💡 PRACTICAL TIPS\n${sec.lines.map((l) => `  • ${l}`).join("\n")}\n\n`;
    }
  });

  output += `Crafted with Wanderly (https://wanderly.travel)\n`;
  return output;
}

function renderItineraryAnswer(rawAnswer, tripData, parsedSections = null) {
  itineraryAnswer.replaceChildren();
  itineraryAnswer.classList.remove("itinerary-error");

  const sections = parsedSections || parseItinerarySections(rawAnswer);
  if (!sections.length) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "itinerary-error";
    emptyMsg.textContent = "No structured itinerary details were returned. Please try generating again.";
    itineraryAnswer.appendChild(emptyMsg);
    return;
  }

  // 1. Overview card
  const overview = sections.find((s) => s.type === "overview");
  if (overview && overview.lines.length) {
    itineraryAnswer.appendChild(renderOverviewCard(overview));
  }

  // 2. Day cards
  const days = sections.filter((s) => s.type === "day");
  days.forEach((daySec, idx) => {
    itineraryAnswer.appendChild(renderDayCard(daySec, idx));
  });

  // 3. Reference cards
  const refSections = sections.filter((s) => ["stay", "food", "budget", "tips", "general"].includes(s.type));
  if (refSections.length) {
    const refGrid = document.createElement("div");
    refGrid.className = "itinerary-reference-grid";
    refSections.forEach((ref) => {
      refGrid.appendChild(renderReferenceCard(ref));
    });
    itineraryAnswer.appendChild(refGrid);
  }
}

function renderItinerary(data) {
  if (!itineraryPanel) return;
  if (!data) {
    itineraryPanel.hidden = true;
    if (quoteItineraryStatus) quoteItineraryStatus.hidden = true;
    return;
  }
  itineraryPanel.hidden = false;
  if (quoteItineraryStatus) quoteItineraryStatus.hidden = false;

  itineraryTitle.textContent = `${data.destination || planner.destination || "Your"} Itinerary`;
  if (itinerarySubtitle) {
    const travellersText = Number(data.travellers || planner.people) === 1 ? "1 traveller" : `${data.travellers || planner.people} travellers`;
    itinerarySubtitle.textContent = `A customized ${data.days || planner.days}-day itinerary crafted for ${travellersText}, styled for ${data.style || planner.style} travel.`;
  }

  const tripDetails = [
    { icon: "⏱️", text: `${data.days || planner.days} Days · ${Math.max(1, (data.days || planner.days) - 1)} Nights` },
    { icon: "👥", text: `${data.travellers || planner.people} ${Number(data.travellers || planner.people) === 1 ? "Traveller" : "Travellers"}` },
    { icon: "🎨", text: `${(data.style || planner.style).replace(/^\w/, (l) => l.toUpperCase())} Travel` },
    (data.origin || planner.origin) ? { icon: "✈️", text: `From ${data.origin || planner.origin}` } : null,
    (data.departureDate || planner.departureDate) ? {
      icon: "📅",
      text: `${new Date(`${data.departureDate || planner.departureDate}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}${(data.returnDate || planner.returnDate) ? ` – ${new Date(`${data.returnDate || planner.returnDate}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}`
    } : null,
    Number.isFinite(Number(data.budget)) ? { icon: "💳", text: `${inr(Number(data.budget))} Total Budget` } : null,
    Number.isFinite(Number(data.estimatedBudget)) && Number(data.estimatedBudget) !== Number(data.budget)
      ? { icon: "📊", text: `${inr(Number(data.estimatedBudget))} Live Estimate` }
      : null
  ].filter(Boolean);

  itineraryMeta.replaceChildren();
  tripDetails.forEach((detail) => {
    const badge = document.createElement("span");
    badge.className = "itin-meta-pill";
    badge.innerHTML = `<span aria-hidden="true">${detail.icon}</span><span>${escapeHTML(detail.text)}</span>`;
    itineraryMeta.appendChild(badge);
  });

  const sections = parseItinerarySections(data.answer);
  renderItineraryAnswer(data.answer, data, sections);

  itinerarySources.replaceChildren();
  let sourceCount = 0;
  (data.results || []).slice(0, 8).forEach((result) => {
    let source;
    try {
      source = new URL(result.url);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(source.protocol)) return;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "source-card";
    link.innerHTML = `
      <span class="source-icon" aria-hidden="true">🌐</span>
      <span class="source-info">
        <strong class="source-title">${escapeHTML(result.title || source.hostname)}</strong>
        <span class="source-domain">${escapeHTML(source.hostname.replace(/^www\./, ""))}</span>
      </span>
      <span class="source-arrow" aria-hidden="true">↗</span>
    `;
    item.appendChild(link);
    itinerarySources.appendChild(item);
    sourceCount += 1;
  });

  if (itinerarySourcesCard) {
    itinerarySourcesCard.hidden = sourceCount === 0;
  }
  buildItineraryNavigation(sections, sourceCount > 0);
}

function saveCurrentTrip(itinerary = currentItinerary) {
  if (!requireAccount(() => saveCurrentTrip(itinerary))) return;
  const storedTrips = store.get("savedTrips", []);
  const savedTrips = Array.isArray(storedTrips) ? storedTrips : [];
  const trip = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...planner,
    budget: requestedTripBudget(),
    estimatedBudget: computeQuote().total,
    itinerary: itinerary?.answer || "",
    sources: Array.isArray(itinerary?.results) ? itinerary.results.slice(0, 5) : [],
    savedAt: new Date().toISOString()
  };
  const updatedTrips = [...savedTrips.slice(-19), trip];
  store.set("savedTrips", updatedTrips);
  renderSavedTrips();
  renderSaved();
  syncSavedTrips(updatedTrips);
  toast("Trip saved", `${trip.destination || "Custom trip"} · ${inr(trip.budget)}`, "✓");
}

$("#quote-save")?.addEventListener("click", () => saveCurrentTrip(null));
$("#save-itinerary")?.addEventListener("click", () => saveCurrentTrip());

$("#copy-itinerary")?.addEventListener("click", async () => {
  if (!currentItinerary) return;
  const sections = parseItinerarySections(currentItinerary.answer);
  const text = buildPlainTextItinerary(currentItinerary, sections);
  try {
    await navigator.clipboard.writeText(text);
    toast("Itinerary copied", "Formatted day-by-day plan copied to clipboard", "📋");
  } catch {
    toast("Itinerary plan", "Could not copy automatically", "📋");
  }
});

$("#print-itinerary")?.addEventListener("click", () => {
  window.print();
});

$("#toggle-all-days")?.addEventListener("click", () => {
  const cards = $$(".itinerary-day-card", itineraryAnswer);
  if (!cards.length) return;
  const anyOpen = cards.some((c) => !c.classList.contains("is-closed"));
  cards.forEach((c) => {
    c.classList.toggle("is-closed", anyOpen);
    c.querySelector(".itin-day-header")?.setAttribute("aria-expanded", String(!anyOpen));
    c.querySelector(".itin-day-toggle")?.setAttribute("aria-expanded", String(!anyOpen));
  });
  const btn = $("#toggle-all-days");
  if (btn) {
    btn.innerHTML = anyOpen ? `<span aria-hidden="true">↕</span> Expand all` : `<span aria-hidden="true">↕</span> Collapse all`;
  }
});

$("#quote-itin-jump")?.addEventListener("click", (e) => {
  e.preventDefault();
  itineraryPanel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

async function createItinerary() {
  planner.destination = plannerDestination?.value.trim() || "";
  planner.origin = plannerOrigin?.value.trim() || "";
  planner.departureDate = plannerDate?.value || "";
  planner.returnDate = plannerReturnDate?.value || "";
  planner.tripBudget = plannerBudgetInput?.value === "" ? "" : Number(plannerBudgetInput?.value);
  planner.style = plannerStyle?.value || "culture";
  if (planner.destination.length < 2) {
    toast("Add a destination", "Enter a city or region for your itinerary", "⌖");
    plannerDestination?.focus();
    return;
  }
  if (plannerBudgetInput && !plannerBudgetInput.reportValidity()) return;
  if (planner.returnDate && !planner.departureDate) {
    plannerReturnDate?.setCustomValidity("Choose a departure date first.");
    plannerReturnDate?.reportValidity();
    return;
  }
  plannerReturnDate?.setCustomValidity("");
  if (planner.departureDate && planner.returnDate) {
    const selectedDays = daysBetween(planner.departureDate, planner.returnDate);
    if (selectedDays < 3 || selectedDays > 18) {
      plannerReturnDate?.setCustomValidity("Choose dates for a trip between 3 and 18 days.");
      plannerReturnDate?.reportValidity();
      return;
    }
    if (selectedDays !== planner.days) {
      planner.days = selectedDays;
      if (daysSlider) daysSlider.value = String(selectedDays);
      if (daysOut) daysOut.textContent = `${selectedDays} days`;
      if (daysSlider) paintRange(daysSlider);
      renderQuote();
    }
  }
  if (!requireAccount(createItinerary)) return;

  itineraryController?.abort();
  const controller = new AbortController();
  itineraryController = controller;
  currentItinerary = null;
  if (itineraryPanel) itineraryPanel.hidden = false;
  if (quoteItineraryStatus) quoteItineraryStatus.hidden = false;
  if (itineraryTitle) itineraryTitle.textContent = `Planning ${planner.destination}…`;
  if (itinerarySubtitle) itinerarySubtitle.textContent = `Connecting to research feeds and curating your ${planner.days}-day ${planner.style} trip…`;
  if (itineraryMeta) itineraryMeta.replaceChildren();
  if (itineraryNav) itineraryNav.hidden = true;
  if (itinerarySourcesCard) itinerarySourcesCard.hidden = true;
  if (itineraryAnswer) {
    itineraryAnswer.replaceChildren();
    itineraryAnswer.classList.remove("itinerary-error");
    const loadingCard = document.createElement("div");
    loadingCard.className = "itinerary-loading-card";
    loadingCard.innerHTML = `
      <div class="sug-spinner" aria-hidden="true"></div>
      <h4>Curating your ${planner.days}-day ${planner.style} trip to ${escapeHTML(planner.destination)}…</h4>
      <p>Gathering verified sights, regional food specialties, pacing, and local transport advice.</p>
    `;
    itineraryAnswer.appendChild(loadingCard);
  }
  itineraryPanel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });

  const button = $("#create-itinerary");
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }

  try {
    await updateCostProfile(planner.destination);
    if (controller !== itineraryController) return;
    renderQuote();
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: planner.destination,
        origin: planner.origin,
        departureDate: planner.departureDate,
        returnDate: planner.returnDate,
        days: planner.days,
        travellers: planner.people,
        style: planner.style,
        budget: requestedTripBudget(),
        estimatedBudget: computeQuote().total
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Itinerary planning failed.");
    if (controller !== itineraryController) return;
    currentItinerary = data;
    renderItinerary(data);
    toast("Your itinerary is ready", `${data.days} days in ${data.destination}`, "✳");
    itineraryPanel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("AI itinerary generation failed:", error);
    const errorMessage = error instanceof TypeError && /fetch/i.test(error.message)
      ? "Can't reach Wanderly's server. Run npm run dev and open the localhost address shown in the terminal, then try again."
      : error.message || "Could not create your itinerary. Please try again.";
    if (itineraryAnswer) {
      itineraryAnswer.replaceChildren();
      const errEl = document.createElement("p");
      errEl.className = "itinerary-error";
      errEl.textContent = errorMessage;
      itineraryAnswer.appendChild(errEl);
    }
    toast("Itinerary unavailable", errorMessage, "!");
  } finally {
    if (controller === itineraryController) {
      itineraryController = null;
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }
}

$("#create-itinerary")?.addEventListener("click", createItinerary);
$("#quote-book")?.addEventListener("click", () => {
  $("#contact")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  setTimeout(() => $("#c-name")?.focus({ preventScroll: true }), 700);
  toast("Let's talk it through", "Tell us the rough idea below", "☏");
});
$("#quote-share")?.addEventListener("click", async () => {
  const q = computeQuote();
  const text = `My Wanderly plan: ${planner.days} days, ${planner.people} travellers, ${comfortRate[planner.comfort]} — about ${inr(q.total)}.`;
  try {
    await navigator.clipboard.writeText(text);
    toast("Estimate copied", text, "⧉");
  } catch {
    toast("Your estimate", text, "⧉");
  }
});

/* init planner from storage */
(() => {
  if (plannerDate) plannerDate.min = new Date().toISOString().slice(0, 10);
  if (plannerReturnDate && planner.departureDate) {
    plannerReturnDate.min = dateOffset(planner.departureDate, 2);
    plannerReturnDate.max = dateOffset(planner.departureDate, 17);
  }
  syncPlannerControls();
  renderQuote();
  renderSavedTrips();
  initializeAccount();
  if (planner.destination) updateCostProfile(planner.destination);
})();

/* ---------- 10. Stories carousel ---------- */
(() => {
  const track = $("#story-track");
  const cards = $$(".story-card", track || document);
  const dotsWrap = $("#story-dots");
  let page = 0;

  const perView = () => (window.innerWidth <= 700 ? 1 : window.innerWidth <= 980 ? 2 : 3);
  const pages = () => Math.max(1, Math.ceil(cards.length / perView()));

  function renderDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    for (let i = 0; i < pages(); i += 1) {
      const dot = document.createElement("button");
      dot.className = `story-dot${i === page ? " is-active" : ""}`;
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to story page ${i + 1}`);
      dot.setAttribute("aria-selected", String(i === page));
      dot.addEventListener("click", () => go(i));
      dotsWrap.appendChild(dot);
    }
  }
  function go(p) {
    page = (p + pages()) % pages();
    if (track) track.style.transform = `translateX(-${page * 100}%)`;
    $$(".story-dot", dotsWrap || document).forEach((d, i) => {
      d.classList.toggle("is-active", i === page);
      d.setAttribute("aria-selected", String(i === page));
    });
  }
  $("#story-next")?.addEventListener("click", () => go(page + 1));
  $("#story-prev")?.addEventListener("click", () => go(page - 1));

  /* swipe */
  let startX = null;
  track?.addEventListener("pointerdown", (e) => { startX = e.clientX; });
  track?.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 45) go(page + (dx < 0 ? 1 : -1));
    startX = null;
  });
  track?.addEventListener("pointercancel", () => { startX = null; });

  window.addEventListener("resize", () => { page = clamp(page, 0, pages() - 1); renderDots(); go(page); });
  renderDots();
  go(0);
})();

/* ---------- 11. FAQ, forms, misc ---------- */
$$(".faq-item").forEach((item) => {
  const btn = $(".faq-q", item);
  const panel = $(".faq-a", item);
  btn?.addEventListener("click", () => {
    const isOpen = item.classList.contains("is-open");
    $$(".faq-item").forEach((other) => {
      other.classList.remove("is-open");
      $(".faq-q", other)?.setAttribute("aria-expanded", "false");
      $(".faq-a", other).style.maxHeight = null;
    });
    if (!isOpen) {
      item.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      panel.style.maxHeight = `${panel.scrollHeight + 8}px`;
    }
  });
});

/* benefit accordion */
const BENEFIT_DETAIL = [
  ["Handpicked, not scraped.", "Our route team sleeps in the homestays, eats at the restaurants and walks every trail before it reaches this page. If it is on Wanderly, someone here has been there."],
  ["Priced in the open.", "One number that already includes taxes, tips and local transport. What you see at checkout is what leaves your account — we have never charged a surprise city tax."],
  ["Small by design.", "Nine travellers is our ceiling on mountain routes. That means no queues at the trailhead, tables that fit the whole group and a guide who learns your name by the second morning."],
  ["Humans on call.", "A real guide, a real phone number, 24/7 while you are travelling. If a flight is cancelled at 2am, someone picks up and reworks the plan before breakfast."]
];
$$("[data-benefit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const i = Number(btn.dataset.benefit);
    $$("[data-benefit]").forEach((b) => b.classList.toggle("is-active", b === btn));
    const detail = $("#benefit-detail");
    if (detail) detail.innerHTML = `<p><strong>${BENEFIT_DETAIL[i][0]}</strong> ${BENEFIT_DETAIL[i][1]}</p>`;
  });
});
$$("[data-benefit]")[0]?.classList.add("is-active");

/* contact form */
const contactForm = $("#contact-form");
contactForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#c-name");
  const email = $("#c-email");
  let ok = true;
  ok = fieldError(name, name.value.trim().length < 2 ? "Please tell us your name." : "") && ok;
  ok = fieldError(email, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim()) ? "" : "Enter a valid email address.") && ok;
  if (!ok) return;

  const ideas = store.get("ideas", []);
  ideas.push({ name: name.value.trim(), email: email.value.trim(), destination: $("#c-where").value, message: $("#c-msg").value.trim(), at: new Date().toISOString() });
  store.set("ideas", ideas);
  const success = $("#contact-success");
  if (success) success.hidden = false;
  contactForm.reset();
  toast("Idea received", "Saved in your browser — this demo does not send email", "✉");
});

["c-name", "c-email"].forEach((id) => {
  $(`#${id}`)?.addEventListener("input", (e) => fieldError(e.target, ""));
});

/* newsletter */
$("#newsletter-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#nl-email");
  const note = $("#newsletter-note");
  const valid = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(input.value.trim());
  if (!valid) {
    if (note) { note.textContent = "Please enter a valid email."; note.style.color = "#f0a99b"; }
    input.focus();
    return;
  }
  store.set("newsletter", { email: input.value.trim(), at: new Date().toISOString() });
  if (note) { note.textContent = "You're on the list — see you next month ✳"; note.style.color = "#a9d3b9"; }
  input.value = "";
  toast("Subscribed", "One postcard a month, no selling", "✳");
});

/* hero film button */
$("#hero-video-btn")?.addEventListener("click", () => {
  openModal(`
    <div class="article-hero" style="aspect-ratio:16/9">
      <img src="assets/gallery-3.jpg" alt="Sunrise above a sea of clouds in the Himalayas">
      <div class="film-overlay">
        <span class="film-play" aria-hidden="true">▶</span>
      </div>
    </div>
    <div class="article-wrap" style="text-align:center">
      <p class="eyebrow" style="justify-content:center">The Wanderly film · 0:40</p>
      <h2 id="modal-title">Forty seconds. Six places. Zero rush.</h2>
      <p class="article-lead">This is a concept site, so the film is a placeholder — imagine sunrise over Lake Braies, a Kyoto street at 6am and a boat on the Beas.</p>
      <div class="film-stats">
        <div><strong>6</strong><small>locations</small></div>
        <div><strong>40s</strong><small>runtime</small></div>
        <div><strong>4K</strong><small>footage</small></div>
        <div><strong>0</strong><small>voiceovers</small></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">
        <a class="btn btn-primary" href="#destinations" data-close-modal>Explore destinations <span aria-hidden="true">→</span></a>
        <button class="btn btn-ghost" data-close-modal>Maybe later</button>
      </div>
    </div>`);
  $$("[data-close-modal]", modal).forEach((el) => el.addEventListener("click", closeModal));
  $("#film-close")?.addEventListener("click", closeModal);
});

/* deep links from footer / nav that point at overlays */
$$('a[href="#plan"]').forEach((a) => a.addEventListener("click", () => setTimeout(() => $("#q")?.focus({ preventScroll: true }), 600)));

/* year */
const yearEl = $("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* first visit greeting */
if (!store.get("seen", false)) {
  store.set("seen", true);
  setTimeout(() => {
    if (!modal.hidden || drawer.classList.contains("is-open")) return;
    toast("Welcome to Wanderly", "Tap any destination card for the full guide", "✳");
  }, 4200);
}

/* init */
applyFilters();
