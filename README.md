# Purpose

Help a person compare commute impact when moving homes. Given a **current** and one or more **candidate** addresses plus a list of frequently visited places, the app computes and compares travel times and distances for each origin→destination pair, and summarizes the gains/losses.

## Primary users & scenarios

- Individuals or families evaluating a new apartment/house.
- Typical places: **work, school, shop, rest** (categories repeatable per place).

## Inputs

- **Origins**: current home and 1–3 candidate homes.
- **Destinations**: list of addresses, each with category and optional nickname.
- **Settings**: travel mode (start with Driving), departure time preset (e.g., 08:30), traffic range (BEST_GUESS with optimistic/pessimistic bounds).

## Outputs

- **Comparison table** showing, per destination: current vs new home time (min–max), distance, delta minutes/percent, and a “winner.”
- **Visit-all** option: a single optimized route per origin to visit every destination once, with total time and ordered stops.
- **Map view**: markers by category and color-coded routes from selected origins.

## How it works (under the hood)

- Geocode all inputs to place IDs.
- For each origin, call a route **matrix** to the destination list; compute min–max using traffic models at a chosen departure time (or sample a small time window).
- For “visit-all,” request a route with waypoint optimization per origin.

## UI (left inputs, right map)

Left: origin fields, commute settings, destination rows (address + category), Compute button, tabs for **Table** and **Visit-all**.

Right: interactive map with origins, destination icons, and routes; hover a table row to highlight on the map.

## MVP scope

- Driving mode, one departure time, min–max range.
- Up to 2 origins and ~15 destinations.
- Table + map + visit-all.
- CSV import for destinations (optional).

## Non-goals (v1)

- Historical reliability charts, multi-vehicle planning, or long-term caching of ETAs.
- Mixing Google route data with non-Google basemaps.