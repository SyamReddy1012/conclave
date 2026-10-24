# Smart Hospital Optimization & Emergency Response System

**Team TechHunters** · Innovative Conclave · N.K. Syam Sundar Reddy, K. Vishal, S. Nikhil

> One live view of beds, medicines and ambulances, so the right help reaches the right hospital faster.

**Right ambulance. Right hospital. Right medicine.**

This README is a guide for building the web application described in the project presentation. Items marked **(Suggested)** are build suggestions that are not in the presentation. Items marked **(Needs confirmation)** are undecided or inconsistent in the presentation.

---

## 1. What You Are Building

A Python web app with a Power BI dashboard, made of four modules:

| Module | What it does |
| --- | --- |
| **Bed Management** | Tracks total, occupied and free beds across general, ICU and emergency wards, with low-availability alerts |
| **Medicine Inventory** | Monitors quantities and expiry dates, with low-stock and near-expiry alerts |
| **Accident Hotspots** | Analyses historical accident data and maps high-risk zones on an interactive map |
| **Smart Ambulance Allocation** | Recommends the best ambulance by location and travel time, then matches a hospital with capacity |

---

## 2. Tech Stack

| Layer | Technology |
| --- | --- |
| Data sources | Public road-accident data plus sample hospital, bed, medicine and ambulance data |
| Processing | Python, Pandas |
| Storage | PostgreSQL (beds, medicines, ambulances, user roles) |
| Interface | HTML, CSS, JavaScript; Power BI dashboard; OpenStreetMap maps |

**(Needs confirmation):** The slide lists HTML/CSS/JS, while the speaker notes mention a **Streamlit** app. Decide on one front-end approach before you start. See [Section 5](#5-open-decisions).

---

## 3. Prerequisites

- Python 3.x
- PostgreSQL
- Power BI Desktop (for the dashboard)
- A modern web browser

**(Suggested)** Python packages: `pandas`, a PostgreSQL driver such as `psycopg2-binary`, and your chosen web framework. Pin the versions you actually use in `requirements.txt`.

---

## 4. Build Order

Follow the seven roadmap stages from the presentation.

### Step 1: Data Collection
- Gather public road-accident data and create sample datasets for hospitals, beds, medicines and ambulances.
- Clean and organise every dataset with Python and Pandas.

### Step 2: Bed Management
- Track general, ICU and emergency beds (total, occupied, free).
- Raise low-availability alerts.

### Step 3: Medicine Inventory
- Track stock quantities and expiry dates.
- Raise low-stock and near-expiry alerts.

### Step 4: Accident Hotspot Analysis
- Analyse historical accident data and mark accident-prone zones on an OpenStreetMap map.

### Step 5: Ambulance Allocation
Implement the four-stage logic:

1. **Filter:** keep only ambulances that are free and in service.
2. **Rank:** order by estimated travel time to the accident, using OpenStreetMap routes.
3. **Match:** pick the nearest hospital with a free bed of the right type and facilities.
4. **Update:** mark the ambulance busy, reserve the bed and refresh the dashboard.

**Fallback:** if there is no match, widen the search radius and alert the admin.
**Staging:** park idle ambulances near hotspots.

```text
FUNCTION allocate_ambulance(accident_location):
    candidates = ambulances WHERE free AND in_service
    rank candidates BY estimated_travel_time(accident_location)   # OpenStreetMap routes
    hospital = nearest hospital WITH free bed of right type AND right facilities
    IF no hospital:
        widen_search_radius()
        alert_admin()
        RETURN
    mark best ambulance busy
    reserve bed at hospital
    refresh dashboard
```

### Step 6: Web Application Integration
- Combine all modules into one app with maps, stats and alerts.
- Add role-based logins (see Section 6).

### Step 7: Testing and Deployment
- Run emergency scenarios, including no-match cases.
- Go live (a single-hospital pilot is recommended).

The presentation does not say which steps are already complete.

---

## 5. Open Decisions

| Decision | Detail |
| --- | --- |
| Web framework | HTML/CSS/JS versus Streamlit. Slide 8 and its notes disagree. |
| Final database | The slide names PostgreSQL, but the notes ask to confirm it. |
| Hospital "nearest" metric | Distance or travel time is not defined. |
| Radius widening | Increments and retry limits are not defined. |
| Role permissions | Read versus write rights are not defined. |

---

## 6. Users and Access Control

| Role | Manages |
| --- | --- |
| **Admin (Director)** | Adds or removes anyone's access; controls the whole system |
| **Pharmacy** | Medicine stock, blood bank |
| **Reception** | Beds and ventilators, doctors |
| **Manager** | Ambulances |

---

## 7. Database

The presentation says the prototype uses **four simple tables: beds, medicines, ambulances and users**, and that a hospital ID should be added to every record to serve many hospitals later. The exact columns are not specified.

**(Suggested)** starting point, to be adjusted by the team:

```sql
-- Suggested only; not taken from the presentation.
CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    hospital_id INT,
    ward_type TEXT,          -- general / ICU / emergency
    total INT,
    occupied INT,
    last_updated TIMESTAMP
);

CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    hospital_id INT,
    name TEXT,
    quantity INT,
    expiry_date DATE,
    last_updated TIMESTAMP
);

CREATE TABLE ambulances (
    id SERIAL PRIMARY KEY,
    hospital_id INT,
    status TEXT,             -- free / busy
    in_service BOOLEAN,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    last_updated TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    role TEXT                -- admin / pharmacy / reception / manager
);
```

Doctors, ventilators and blood bank data are also managed by the roles above, so you may need extra tables or columns. **(Needs confirmation)**

---

## 8. Suggested Project Structure

**(Suggested)** Not from the presentation.

```text
smart-hospital/
├── data/              # public accident data and sample datasets
├── scripts/           # Python and Pandas cleaning scripts
├── app/               # web application
├── dashboard/         # Power BI file
├── requirements.txt
└── README.md
```

---

## 9. Demo Scenario (Highway Accident)

Rehearse this path with sample data:

1. Accident reported near `[location]`: the map pins the spot and flags a known hotspot.
2. Dispatcher opens the allocation view: free ambulances are ranked by travel time.
3. Dispatcher confirms the top ambulance: a hospital with a free ICU or emergency bed is matched.
4. Pharmacy checks critical supplies: blood and medicine stock are shown, with alerts.
5. Admin reviews the dashboard: beds, ambulances and stock update instantly.

**Expected result:** bed counts change, an ambulance turns busy and a stock alert fires.

Replace `[location]` with a real hotspot from your dataset. Also prepare a second scenario where no ambulance or bed is available, to show the fallback.

---

## 10. Risks to Plan For

- **Stale data:** provide easy update forms and last-updated stamps.
- **Traffic changes:** refresh travel-time estimates often.
- **Privacy:** store no patient identities.
- **Adoption:** start with a single-hospital pilot.

---

## 11. Future Work

These are not part of the current build:

- Accident-risk prediction with machine learning (by time and weather)
- Live GPS tracking of ambulances
- Instant SMS or app alerts
- A mobile app for ambulance crews
- Scaling: hospital ID on every record, a cloud database, hosted routing, and new modules such as blood bank or oxygen

---

## 12. Reference Sources

Named in the presentation's notes (only the URL fragments given there are listed):

- EMRI 108 overview: `thebetterindia.com/187773/gvk-emri-108-ambulance-emergency-healthcare-service-india`
- e-RaktKosh: `vajiramandravi.com/current-affairs/e-raktkosh`
- Karnataka 108 command centre: Deccan Herald (no URL given)
- AIIMS casualty dashboard: Tribune India (no URL given)
- StanPlus: YourStory, June 2021 (no URL given)
