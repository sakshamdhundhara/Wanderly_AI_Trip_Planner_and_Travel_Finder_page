# Wanderly — Interactive Travel Landing Page

A responsive, interactive travel website built with **HTML5, CSS3, vanilla JavaScript,
and a dependency-free Node.js backend**. It combines Wanderly's existing hand-picked trips
with live destination research, personalized itinerary ideas, weather, maps, and travel searches.

## Run it

1. Use Node.js 18 or newer. Copy `.env.example` to `.env` and set `TAVILY_API_KEY` to your Tavily API key. Optionally set `GOOGLE_MAPS_API_KEY` for Google Maps Place Autocomplete (otherwise Open-Meteo Geocoding is used).
2. Wanderly's current Node.js backend handles email/password accounts and stores account and trip data locally under `data/`. Keep that folder private and back it up if you need to preserve local accounts and saved trips. For production or multi-device accounts, replace the local auth store with a managed authentication provider before deployment.
3. Run `npm run dev` and open the URL shown in the terminal (default: `http://localhost:5173`).
4. No `npm install` is needed. Tavily search, itinerary, flight and hotel research require internet access and the key. Real-time place autocomplete, weather, maps and Commons photos need internet access.

> The live destination search works through the Node.js server. Opening `index.html` directly
> or using a static-only server will not provide the `/api/` endpoints.
> Keep `.env` private. If a key has been pasted into a chat, shared, or committed, revoke it
> with Tavily and replace it before using the app.

> If the planner says it cannot reach the server, keep `npm run dev` running and open the exact
> `http://localhost:...` address printed in that terminal. Do not use a preview URL after its
> development server has stopped.

## Folder structure

```text
wanderly/
├── package.json   npm run dev command (no dependencies)
├── server.js      dependency-free local development server
├── index.html      markup for every section + overlays
├── style.css       design tokens, components, responsive rules
├── script.js       all behaviour (data, search, planner, booking, modals)
├── fonts.css       self-hosted DM Sans + Playfair Display (embedded woff2)
├── README.md
├── supabase/       SQL migration for account-owned saved trips and row-level security
└── assets/         optimised local photos (hero, destinations, trips, journal)
```

## Page sections

| Section | What it does |
|---|---|
| Sticky header | Scroll progress bar, active-link tracking, saved-places popover, account sign-in, animated mobile menu |
| Hero | Auto-playing photo slider with dots, floating stat cards, animated headline, animated counters |
| Search bar | Live autocomplete suggestions and Tavily search for any destination |
| Destinations | Six featured cards, current web results and images, live weather and OpenStreetMap, flight/hotel web searches, filters and saved favourites |
| Destination modal | Tabbed detail view — overview, highlights, day-by-day itinerary, reviews — plus share and booking |
| Upcoming trips | Three departures with seat availability, itinerary modal and a full booking flow |
| Trip planner | Personalized Tavily itinerary, destination-adjusted INR budget, trip preferences, suggested route, and saved trips |
| Why Wanderly | Click-through benefits accordion |
| Stories | Swipeable / arrow-navigated testimonial carousel with dots |
| Journal | Three expandable long-form articles inside the modal |
| FAQ | Accessible single-open accordion |
| Contact | Validated demo form with inline error messages and success state |
| Footer | Link columns, newsletter form with validation, socials |
| Extras | Toast notifications, back-to-top button, saved-place persistence, calendar (.ics) download |

## Interactive features checklist

- **Real-Time Place Autocomplete** — Debounced input fields for destination, starting city, and hero search query Google Maps Place Autocomplete (`/api/autocomplete`), providing instant location suggestions, custom entry fallback, and automated fallback to Open-Meteo Geocoding when an API key is not present.
- **Destination Explorer** — Tavily provides a current overview and attraction links. Open-Meteo provides the location forecast, OpenStreetMap provides the map, and the image gallery displays openly licensed Wikimedia Commons images with attribution.
- **AI trip planner** — choose departure and return dates (a selected date range synchronizes the trip length), set an optional total budget in INR, then Tavily builds a detailed, scannable itinerary. If no budget is entered, the destination-adjusted live estimate is used. When a custom budget is provided, the itinerary compares it with the estimate. Results include:
  - Header cards showing duration, travellers, trip style, full travel dates, starting hub, requested budget, and live estimate when they differ.
  - Interactive quick-jump tabs for fast navigation across days and thematic sections.
  - Day-by-day collapsible timeline cards broken down into distinct time slots: Morning (🌅), Afternoon (☀️), Evening (🌙), and Getting around (🚇).
  - Dedicated reference cards for Where to stay (🏨), Must-try local food (🍜), Budget guidance (💰), and Practical travel tips (💡).
  - One-click copy, print/PDF export, and account save actions.
  - Rich verified source cards linking to original guides and archives.
- **Flight and hotel research** — Tavily searches the web for current flight and accommodation information. Results link to their original providers; they are not guaranteed fares, availability, or bookings.
- **Budget calculator** — the existing estimate updates with trip length, group size, comfort, flights and insurance. Stays, meals, activities and local transport use a destination price-level multiplier calculated from the latest common World Bank private-consumption PPP and official exchange-rate year, relative to India. The calculator stays in INR. If a location or World Bank data is unavailable, it clearly falls back to the India baseline. Flights and insurance remain broad sample estimates and are not supplier quotes.
- **Featured filters** — style tabs and the existing local destination filters work independently of web search.
- **Filters & sorting** — style tabs, month select, sort by price/rating/name, and a clearable status bar.
- **Saved places and trips** — save featured or searched destinations and save/load/remove planner trips. Guests are prompted to sign in before creating an AI itinerary or saving a plan; the requested action resumes after successful sign-in. Saved destinations remain local.
- **Accounts** — email/password sign-up, sign-in, session refresh, sign-out, and per-user trip storage use the local Node.js backend.
- **Detail modal** — every destination and trip opens a tabbed guide with itinerary and reviews.
- **3-step booking drawer** — dates, travellers, room type, contact validation, confirmation code,
  and an "Add to calendar" `.ics` download.
- **Trip planner** — change the trip-length/traveller sliders and the estimate, breakdown bars and route update instantly. Setting a return date updates the trip length, and changing trip length keeps both dates aligned. The optional custom INR budget and date range are remembered and included in generated and saved plans.
- **Carousel** — arrows, dots and touch swipe.
- **Forms** — inline validation on contact, newsletter and booking; success messages without reload.
- **Micro-interactions** — scroll reveals, hover lifts, focus rings, toast messages, progress bar.

## Test checklist

1. Resize between 1440 px, 820 px and 390 px — nothing should overflow sideways.
2. Open the hamburger menu on a narrow screen and confirm links close it.
3. Type “jap”, “beach” or “mountains” in the search box and pick a suggestion.
4. Combine a style tab with the sort dropdown, then hit **Clear filters**.
5. Heart two destinations, refresh the page, and check they are still saved.
6. Open a destination card → switch between all four tabs → click **Check dates**.
7. Complete the booking drawer (try submitting empty to see validation) and download the calendar file.
8. Move the planner sliders and change comfort level / toggles.
9. Open an article in the Journal, then press `Esc` to close it.
10. Submit the contact form empty, then correctly.
11. Tab through the page with the keyboard only — every control should be reachable and visible.
12. Search for a city not in the featured cards and check the Tavily overview, sources, images, weather and map.
13. Enter a destination in the planner, choose a style and trip length, and create an itinerary; confirm the overview, separate daily sections, practical notes, budget caveats and research links are easy to scan.
14. Search flights and hotels from the live destination results, then follow a source link.
15. Save a searched destination and a trip, refresh, and load/remove the saved items.
16. Compare the budget for a destination in India with one abroad; confirm the local-cost multiplier and year are shown, and that a location with unavailable data clearly shows the India-baseline fallback.
17. Configure Supabase and apply the migration, then create an account, save a trip, sign out and in again, and confirm the trip is restored. Repeat with a second account to verify trips do not cross accounts; test email confirmation if enabled in Supabase.
18. Choose departure and return dates and confirm the trip-length control updates; set a custom INR budget and confirm the generated itinerary receives both that budget and the live estimate.

## Accessibility notes

- Semantic landmarks (`header`, `nav`, `main`, `section`, `footer`), one `h1`, labelled sections.
- Skip-to-content link, visible `:focus-visible` rings, `aria-expanded` / `aria-pressed` / `aria-selected`
  states on every toggle, `role="dialog"` + `aria-modal` on the modal and drawer, `Esc` closes overlays,
  focus is trapped in the modal and returned to the trigger.
- `aria-live` regions announce search results, planner estimate and form errors.
- `prefers-reduced-motion` disables the slider autoplay, counters and transitions.
- All photos have descriptive `alt` text; decorative marks use `aria-hidden`.

## Performance notes

- All photos are local, resized and progressive JPEGs (≈2.2 MB total for 22 images).
- Fonts are self-hosted and embedded, so there are zero third-party requests.
- Below-the-fold images use `loading="lazy"`; the hero image is preloaded.
- Scroll and resize handlers are throttled with `requestAnimationFrame` / passive listeners.

## Notes

This is a travel discovery and planning tool, not a booking service. Live itinerary, destination,
flight and hotel research is returned by Tavily and should be verified with the linked sources.
Weather and map coordinates come from Open-Meteo; the map is provided by OpenStreetMap.
Destination price levels use World Bank indicator `PA.NUS.PRVT.PP` (private-consumption PPP) divided by `PA.NUS.FCRF` (official exchange rate), compared with India's values for the latest common year. This is a broad national consumer-price comparison, not a tourism-specific price index or live quote; actual hotel, meal, activity and transport prices can vary significantly by city and season.
Destination photographs come from Wikimedia Commons and are limited to CC0/CC BY/CC BY-SA
images; each image links to its source and license information.
Wanderly's sample departures, booking flow, reviews and testimonials are demo content. Search and
planner preferences (destination, origin, dates, group size, style and estimated budget) are sent
to Tavily to perform the requested research; do not enter sensitive personal details. Guest planner
trips and saved places stay in the visitor's browser (`localStorage`). When Supabase is configured,
planner trips sync to the signed-in user's account and are protected by row-level security. This
project does not use a Supabase service-role key in the browser.

## Possible next steps

1. Connect a flight/hotel inventory provider for bookable availability and verified prices.
2. Add OAuth providers or password-reset UX if the account experience needs them.
3. Add a payment/deposit step and email confirmation behind the booking drawer.
4. Add a dark mode using the existing CSS variables.
