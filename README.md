# Smart Hospital Optimization & Emergency Response System

**Team TechHunters** · Innovative Conclave  
**Team Members:** N.K. Syam Sundar Reddy, K. Vishal, S. Nikhil  
> **"One live view of beds, medicines, and ambulances, so the right help reaches the right hospital faster."**  
> **Right ambulance. Right hospital. Right medicine.**

---

## 1. System Overview

The **TechHunters Smart Hospital Optimization & Emergency Response System** is a unified healthcare and emergency coordination platform. Built directly using the provided datasets (`hospitals_doctors_india.csv` and `pharma_sales.csv`), it integrates real-time hospital bed capacity tracking, pharmaceutical inventory and blood bank monitoring, road accident hotspot intelligence, and an autonomous 4-stage smart ambulance allocation engine with automatic fallback handling.

---

## 2. Architecture & Modules

The platform is structured into four core modules, complete with Role-Based Access Control (RBAC) and Power BI Desktop integration:

```
smart-hospital/
├── data/
│   ├── raw/                           # Original CSV datasets
│   │   ├── hospitals_doctors_india.csv
│   │   └── pharma_sales.csv
│   └── processed/                     # Cleaned relational datasets
│       ├── hospitals_cleaned.csv      # 200 hospitals with ward breakdowns & coordinates
│       ├── doctors_cleaned.csv        # 2,000 specialist doctors
│       ├── pharma_inventory.csv       # 2,000 drug batches with expiry tracking
│       ├── blood_bank.csv             # 400 blood units by blood group
│       ├── accident_hotspots.csv      # 17 MoRTH high-risk highway corridors
│       ├── ambulances_fleet.csv       # 49 emergency vehicles (hospital & 108 staged)
│       └── users_rbac.csv             # System users & permission profiles
├── scripts/
│   ├── clean_and_prepare_data.py      # Pandas cleaning & data preparation pipeline
│   ├── export_powerbi_data.py         # Star-schema data exporter for Power BI Desktop
│   └── inspect_data.py                # Dataset inspection utility
├── app/
│   ├── server.py                      # Multi-threaded Python HTTP & REST API server
│   ├── database.py                    # SQLite persistence layer matching PostgreSQL DDL
│   └── static/                        # Frontend Command Center
│       ├── index.html                 # Semantic HTML5 executive command center
│       ├── css/style.css              # Vanilla CSS dark glassmorphism design system
│       └── js/app.js                  # Frontend engine, Leaflet maps, Chart.js & allocation
├── dashboard/
│   ├── POWER_BI_GUIDE.md              # Comprehensive Power BI modeling & DAX guide
│   └── data/                          # Star-schema CSV exports for Power BI Desktop
│       ├── dim_hospitals.csv
│       ├── dim_doctors.csv
│       ├── dim_accident_hotspots.csv
│       ├── fact_bed_occupancy.csv
│       ├── fact_pharma_inventory.csv
│       ├── fact_ambulance_fleet.csv
│       └── fact_blood_bank.csv
├── database/
│   └── schema_postgres.sql            # PostgreSQL DDL schema matching README Section 7
├── requirements.txt                   # Pinned Python package dependencies
├── run_system.py                      # Single command platform launcher
├── start.bat                          # Windows one-click launcher
└── test_suite.py                      # 14-point automated integration test suite
```

---

## 3. Core Modules

### 🏥 Module 1: Bed Management
- **Live Ward Tracking:** Real-time monitoring of General, ICU, and Emergency beds across 200 Indian hospitals.
- **Low-Availability Alerts:** Automatically flags any hospital where free ICU beds $\le 4$, emergency beds $\le 3$, or total free capacity $< 15\%$.
- **Mechanical Ventilator Telemetry:** Tracks in-use vs. available life-support ventilators.
- **Doctor Directory:** Tracks 2,000 doctors across 8 specializations (Cardiology, Neurology, Orthopedics, Oncology, Gastroenterology, Pediatrics, Pulmonology, General Medicine) with live on-duty status.
- **Interactive Triage:** Direct "+ ICU Bed Reservation" and "- Patient Discharge" actions with real-time state persistence.

### 💊 Module 2: Medicine Inventory & Blood Bank
- **2,000 Pharmaceutical Batches:** Processed directly from `pharma_sales.csv`.
- **Automated Alerts:**
  - **EXPIRED:** Batches with negative shelf-life (action: quarantine & safe disposal).
  - **NEAR_EXPIRY:** Batches with $\le 30$ days remaining.
  - **LOW_STOCK:** Stock quantities below 50 units.
- **Safe Disposal & Restocking:** Interactive quarantine/disposal and replenishment controls.
- **Emergency Blood Bank (e-RaktKosh Sync):** Live units for O+, O-, A+, A-, B+, B-, AB+, AB- across regional trauma centers.

### 📍 Module 3: Accident Hotspots
- **17 High-Risk Highway Corridors:** MoRTH-calibrated hotspots across Mumbai, New Delhi, Noida, Bangalore, Hyderabad, Chennai, Ahmedabad, and Kochi.
- **Corridor Analytics:** Tracks annual accident counts, fatalities, primary road hazards (overspeeding, fog, blind merges), and posted speed limits.
- **Interactive Geospatial Radar:** Dark-mode OpenStreetMap (Leaflet.js) with pulsing severity rings and one-click incident triggers.

### 🚑 Module 4: 4-Stage Smart Ambulance Allocation
Implements the four-stage allocation algorithm specified in the project guide:

```text
FUNCTION allocate_ambulance(accident_location, required_ward='ICU'):
    1. FILTER:   candidates = ambulances WHERE free AND in_service
    2. RANK:     rank candidates BY estimated_travel_time(accident_location)
    3. MATCH:    hospital = nearest hospital WITH free bed of right type AND facilities
                 IF no hospital within radius:
                     widen_search_radius()
                     alert_admin()
    4. UPDATE:   mark best ambulance busy
                 reserve bed at matched hospital
                 refresh dashboard & audit log
```

- **Fallback Mode:** If no hospital bed is found within the primary 20 km search radius, the engine automatically widens the radius to 60 km and sends a priority escalation alert to the Medical Director.
- **Corridor Staging:** Staged 108 ALS (Advanced Life Support) ambulances parked directly at critical highway choke points to minimize response times.

---

## 4. Authentication & Role-Based Access Control (RBAC)

The system features a dedicated **Staff Portal Login Page** with session persistence (`localStorage` / `sessionStorage`), password visibility toggles, and 1-click demo access cards for instant evaluation:

| Role | Username | Default Password | Name / Title | Access Level |
|---|---|---|---|---|
| **Admin (Director)** | `admin` | `admin123` | Dr. N.K. Syam Sundar Reddy | Complete system oversight, dispatch override, hospital management, audit reviews. |
| **Pharmacy** | `pharmacy` | `pharmacy123` | K. Vishal, R.Ph. | Medicine stock inspection, quarantine of expired batches, restock orders, blood bank. |
| **Reception** | `reception` | `reception123` | S. Nikhil | Bed & ventilator tracking, ICU reservations, patient discharges, doctor roster. |
| **Manager (Fleet)** | `manager` | `manager123` | K. Ramesh | Ambulance tracking, 108 emergency intake, 4-stage allocation execution, hotspot staging. |

> **Quick Demo Login:** On the login page, simply click any of the 4 demo role pills to authenticate immediately with pre-filled credentials. A **Logout** button in the header returns to the portal.

---

## 5. Dual Design System: Cream, Green & White + Dark Theme

The platform supports two visual design systems with a single-click toggle in the navigation bar and on the login screen:

1. **🌿 Cream, Green & White Theme (Default):**
   - **Backgrounds:** Warm soothing ivory cream (`#faf8f2`, `#f4f0e6`) with subtle gradient depth.
   - **Cards & Surfaces:** Pure crisp hospital white (`#ffffff`) with warm stone borders (`#e6e0d3`).
   - **Green Accents:** Deep medical forest green (`#0f5132`), rich emerald green (`#198754`), vibrant pulse green (`#10b981`), and soft mint badges (`#d1e7dd`).
   - **Typography:** Deep forest slate (`#122117`, `#405245`) delivering crystal-clear readability.
   - **Maps & Charts:** Clear standard OpenStreetMap tiles and clinical green analytical charts.

2. **🌙 High-Contrast Dark Theme:**
   - Deep obsidian command-center (`#080c14`, `#0d1322`).
   - Dark glassmorphic panels with glowing green and cyan accents.
   - Inverted dark radar maps and dark-adapted analytical charts.

> The theme switcher is accessible via the **"Dark Mode / Cream & Green"** button in the header and on the login page; your preference is persisted across browser reloads.

---

## 5. Demonstration Scenarios (README Section 9)

### Scenario A: Highway Accident Simulation (One-Click)
Click the **"Run Highway Demo Scenario"** button in the header to run through the 5-phase emergency walkthrough:
1. **Phase 1:** An accident is reported on the Western Express Highway (Goregaon Flyover, Hotspot HOT-MUM-01). The map pins the site and flags the critical risk level.
2. **Phase 2:** Candidate ambulances are filtered and ranked by travel time. AMB-101 (ALS) is selected with an ETA of ~6 minutes.
3. **Phase 3:** The nearest hospital with available ICU capacity is matched and 1 ICU bed is locked in reserve. The ambulance status flips to `BUSY`.
4. **Phase 4:** Hospital pharmacy checks trauma kits and verifies O-Negative blood bank reserves.
5. **Phase 5:** Dashboard telemetry refreshes immediately with updated bed counts and an immutable entry in the Emergency Response Audit Log.

### Scenario B: Bed Shortage Fallback Simulation
Click **"Test Fallback Scenario"** to simulate an emergency in an area where local ICU beds are full. Observe the dynamic radius expansion (20 km $\rightarrow$ 60 km), overflow diversion, and high-priority Director escalation banner.

---

## 6. Power BI Desktop Integration

The system includes a dedicated **Power BI Analytics** tab and star-schema datasets ready for Power BI Desktop:

1. Open Power BI Desktop $\rightarrow$ `Get Data` $\rightarrow$ `Text/CSV`.
2. Select files from `dashboard/data/`:
   - `dim_hospitals.csv` (1 to Many with Fact tables)
   - `dim_doctors.csv`
   - `dim_accident_hotspots.csv`
   - `fact_bed_occupancy.csv`
   - `fact_pharma_inventory.csv`
   - `fact_ambulance_fleet.csv`
   - `fact_blood_bank.csv`
3. Reference `dashboard/POWER_BI_GUIDE.md` for exact DAX formulas (Bed Occupancy Rate %, ICU Utilization %, Stockout Risk Index, Average Dispatch Time).

---

## 7. How to Run the Application

### Prerequisites
- Python 3.8+ (Python 3.11 recommended)
- Dependencies: `pandas`, `numpy`, `matplotlib` (installed via `pip install -r requirements.txt`)

### Quick Start
```bash
# 1. (Optional) Run data preparation pipeline
python scripts/clean_and_prepare_data.py

# 2. Launch the Application Server
python run_system.py
```
Or double-click `start.bat` on Windows.

### Access the Web Application
Open your browser and navigate to:
```
http://127.0.0.1:8080
```

### Run Automated Integration Tests
```bash
python test_suite.py
```
*(Runs 16 automated test validations covering server health, API integrity, bed reservation lifecycles, 4-stage allocation, fallback triggers, RBAC authentication, and static asset serving).*
