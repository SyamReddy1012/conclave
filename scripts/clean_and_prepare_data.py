"""
Clean and Prepare Data Pipeline
Processes:
1. hospitals_doctors_india.csv -> clean hospitals, doctors, beds data
2. pharma_sales.csv -> clean inventory, near-expiry alerts, stock levels
3. Generates high-risk accident hotspots across Indian corridors
4. Generates ambulance fleet with GPS coordinates and staging
5. Generates system user accounts with role-based access
"""

import os
import json
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Set seed for reproducible enrichment
random.seed(42)
np.random.seed(42)

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_RAW_DIR = os.path.join(WORKSPACE_DIR, "data", "raw")
DATA_PROC_DIR = os.path.join(WORKSPACE_DIR, "data", "processed")
DASHBOARD_DATA_DIR = os.path.join(WORKSPACE_DIR, "dashboard", "data")

os.makedirs(DATA_RAW_DIR, exist_ok=True)
os.makedirs(DATA_PROC_DIR, exist_ok=True)
os.makedirs(DASHBOARD_DATA_DIR, exist_ok=True)

# City Coordinates & Canonical States
CITY_SPECS = {
    "Mumbai": {"lat": 19.0760, "lon": 72.8777, "state": "Maharashtra"},
    "New Delhi": {"lat": 28.6139, "lon": 77.2090, "state": "Delhi"},
    "Noida": {"lat": 28.5355, "lon": 77.3910, "state": "Uttar Pradesh"},
    "Bangalore": {"lat": 12.9716, "lon": 77.5946, "state": "Karnataka"},
    "Hyderabad": {"lat": 17.3850, "lon": 78.4867, "state": "Telangana"},
    "Chennai": {"lat": 13.0827, "lon": 80.2707, "state": "Tamil Nadu"},
    "Ahmedabad": {"lat": 23.0225, "lon": 72.5714, "state": "Gujarat"},
    "Kochi": {"lat": 9.9312, "lon": 76.2673, "state": "Kerala"}
}

def clean_hospitals_and_doctors():
    print(">>> Cleaning Hospitals, Doctors & Beds Data...")
    raw_path = os.path.join(WORKSPACE_DIR, "hospitals_doctors_india.csv")
    if not os.path.exists(raw_path):
        raw_path = os.path.join(DATA_RAW_DIR, "hospitals_doctors_india.csv")
    
    df = pd.read_csv(raw_path)
    # Save a copy in data/raw
    df.to_csv(os.path.join(DATA_RAW_DIR, "hospitals_doctors_india.csv"), index=False)

    # 1. Unique Hospitals
    hosp_df = df.drop_duplicates(subset=["HospitalID"]).copy()
    
    # Correct canonical state based on city
    hosp_df["State"] = hosp_df["City"].apply(lambda c: CITY_SPECS.get(c, {}).get("state", "India"))
    
    # Assign realistic coordinates spread across city zones
    def get_coords(row):
        city = row["City"]
        base = CITY_SPECS.get(city, {"lat": 20.5937, "lon": 78.9629})
        # Jitter within ~10-15 km radius
        lat_offset = (random.random() - 0.5) * 0.14
        lon_offset = (random.random() - 0.5) * 0.14
        return pd.Series([round(base["lat"] + lat_offset, 6), round(base["lon"] + lon_offset, 6)])

    hosp_df[["Latitude", "Longitude"]] = hosp_df.apply(get_coords, axis=1)

    # Bed Wards breakdown: General, ICU, Emergency
    # Beds = Total beds in CSV.
    # Emergency beds: ~10-15% of total beds
    # ICU beds: ICU_Beds in CSV
    # General beds: Beds - ICU_Beds - Emergency_Beds
    def calculate_beds(row):
        total = int(row["Beds"])
        icu_total = int(row["ICU_Beds"])
        emerg_total = max(15, int(total * 0.12))
        gen_total = max(20, total - icu_total - emerg_total)
        
        # Real-time occupancy calculation (70% - 95% occupancy)
        gen_occ_rate = random.uniform(0.70, 0.94)
        icu_occ_rate = random.uniform(0.65, 0.96)
        emerg_occ_rate = random.uniform(0.60, 0.95)
        vent_occ_rate = random.uniform(0.55, 0.92)

        gen_occ = int(gen_total * gen_occ_rate)
        gen_free = gen_total - gen_occ

        icu_occ = int(icu_total * icu_occ_rate)
        icu_free = icu_total - icu_occ

        emerg_occ = int(emerg_total * emerg_occ_rate)
        emerg_free = emerg_total - emerg_occ

        vent_total = int(row["Ventilators"])
        vent_in_use = int(vent_total * vent_occ_rate)
        vent_avail = vent_total - vent_in_use

        # Low availability alert condition: ICU free <= 4 or Emerg free <= 3 or Total Free < 15%
        total_free = gen_free + icu_free + emerg_free
        free_pct = (total_free / total) * 100
        low_bed_alert = (icu_free <= 4) or (emerg_free <= 3) or (free_pct < 15.0)

        return pd.Series([
            gen_total, gen_occ, gen_free,
            icu_total, icu_occ, icu_free,
            emerg_total, emerg_occ, emerg_free,
            vent_total, vent_in_use, vent_avail,
            round(free_pct, 1),
            "Critical Alert" if low_bed_alert else "Normal"
        ])

    bed_cols = [
        "General_Beds_Total", "General_Beds_Occupied", "General_Beds_Free",
        "ICU_Beds_Total", "ICU_Beds_Occupied", "ICU_Beds_Free",
        "Emergency_Beds_Total", "Emergency_Beds_Occupied", "Emergency_Beds_Free",
        "Ventilators_Total", "Ventilators_In_Use", "Ventilators_Available",
        "Free_Beds_Percentage", "Bed_Availability_Status"
    ]
    
    hosp_df[bed_cols] = hosp_df.apply(calculate_beds, axis=1)

    # Save Clean Hospitals
    clean_hosp_cols = [
        "HospitalID", "HospitalName", "City", "State", "Type", "Latitude", "Longitude",
        "Beds", "General_Beds_Total", "General_Beds_Occupied", "General_Beds_Free",
        "ICU_Beds_Total", "ICU_Beds_Occupied", "ICU_Beds_Free",
        "Emergency_Beds_Total", "Emergency_Beds_Occupied", "Emergency_Beds_Free",
        "Ventilators_Total", "Ventilators_In_Use", "Ventilators_Available",
        "Free_Beds_Percentage", "Bed_Availability_Status"
    ]
    hospitals_clean = hosp_df[clean_hosp_cols].copy()
    hospitals_clean.to_csv(os.path.join(DATA_PROC_DIR, "hospitals_cleaned.csv"), index=False)
    hospitals_clean.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_hospitals.csv"), index=False)

    # 2. Doctors Table
    doctors_df = df[["DoctorID", "DoctorName", "HospitalID", "Specialization", "ExperienceYears"]].copy()
    doctors_df["On_Duty"] = [random.choice([True, True, True, False]) for _ in range(len(doctors_df))]
    doctors_df["Phone"] = [f"+91 98{random.randint(10000000, 99999999)}" for _ in range(len(doctors_df))]
    doctors_df.to_csv(os.path.join(DATA_PROC_DIR, "doctors_cleaned.csv"), index=False)
    doctors_df.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_doctors.csv"), index=False)

    print(f"-> Hospitals cleaned: {len(hospitals_clean)} records")
    print(f"-> Doctors cleaned: {len(doctors_df)} records")
    return hospitals_clean, doctors_df


def clean_pharma_data():
    print(">>> Cleaning Pharma Inventory & Sales Data...")
    raw_path = os.path.join(WORKSPACE_DIR, "pharma_sales.csv")
    if not os.path.exists(raw_path):
        raw_path = os.path.join(DATA_RAW_DIR, "pharma_sales.csv")

    df = pd.read_csv(raw_path)
    df.to_csv(os.path.join(DATA_RAW_DIR, "pharma_sales.csv"), index=False)

    # Clean & enrich
    df["Expiry_Days_Left"] = pd.to_numeric(df["Expiry_Days_Left"], errors="coerce").fillna(0).astype(int)
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0).astype(int)
    df["Unit_Price"] = pd.to_numeric(df["Unit_Price"], errors="coerce").fillna(0.0).round(2)
    df["Total_Sales"] = pd.to_numeric(df["Total_Sales"], errors="coerce").fillna(0.0).round(2)

    # Status column: Expired / Near Expiry / Adequate Stock / Low Stock
    def get_stock_status(row):
        days = row["Expiry_Days_Left"]
        qty = row["Quantity"]
        is_exp = row["Expired_Stock"] == "Yes" or days <= 0
        if is_exp:
            return "EXPIRED"
        elif days <= 30:
            return "NEAR_EXPIRY"
        elif qty < 50:
            return "LOW_STOCK"
        else:
            return "ADEQUATE"

    df["Stock_Status"] = df.apply(get_stock_status, axis=1)

    # Calculate Expiry Date based on base reference date
    base_ref = datetime(2026, 10, 24)
    df["Calculated_Expiry_Date"] = df["Expiry_Days_Left"].apply(lambda d: (base_ref + timedelta(days=int(d))).strftime("%Y-%m-%d"))

    # Save to processed
    df.to_csv(os.path.join(DATA_PROC_DIR, "pharma_inventory.csv"), index=False)
    df.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_pharma_inventory.csv"), index=False)

    # Blood bank & emergency supplies
    blood_groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
    blood_data = []
    hosp_ids = [f"H{str(i).zfill(3)}" for i in range(1, 201)]
    for hid in hosp_ids[:50]: # Top 50 hospitals have direct blood banks
        for bg in blood_groups:
            units = random.randint(3, 45)
            status = "CRITICAL_LOW" if units < 8 else ("LOW" if units < 15 else "STABLE")
            blood_data.append({
                "HospitalID": hid,
                "Blood_Group": bg,
                "Units_Available": units,
                "Status": status,
                "Last_Updated": (base_ref - timedelta(hours=random.randint(1, 12))).strftime("%Y-%m-%d %H:%M")
            })
    blood_df = pd.DataFrame(blood_data)
    blood_df.to_csv(os.path.join(DATA_PROC_DIR, "blood_bank.csv"), index=False)
    blood_df.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_blood_bank.csv"), index=False)

    print(f"-> Pharma inventory: {len(df)} records (Expired: {(df['Stock_Status'] == 'EXPIRED').sum()}, Near-Expiry: {(df['Stock_Status'] == 'NEAR_EXPIRY').sum()}, Low-Stock: {(df['Stock_Status'] == 'LOW_STOCK').sum()})")
    print(f"-> Blood bank inventory: {len(blood_df)} unit records")
    return df, blood_df


def generate_accident_hotspots():
    print(">>> Generating Accident Hotspots (MoRTH / City Corridors)...")
    hotspots = [
        # Mumbai
        {
            "hotspot_id": "HOT-MUM-01",
            "name": "Western Express Highway (Goregaon - Kandivali)",
            "corridor": "WEH Corridor",
            "city": "Mumbai",
            "state": "Maharashtra",
            "latitude": 19.1663,
            "longitude": 72.8526,
            "risk_level": "Critical",
            "annual_accidents": 142,
            "fatalities": 38,
            "primary_hazard": "Overspeeding & Heavy Multi-Axle Merging",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Goregaon Flyover Base Bay"
        },
        {
            "hotspot_id": "HOT-MUM-02",
            "name": "Mumbai-Pune Expressway (Khopoli - Bhor Ghat)",
            "corridor": "Expressway Ghat Section",
            "city": "Mumbai",
            "state": "Maharashtra",
            "latitude": 18.7890,
            "longitude": 73.3420,
            "risk_level": "Critical",
            "annual_accidents": 195,
            "fatalities": 64,
            "primary_hazard": "Brake Failure on Steep Gradients & Blind Curves",
            "speed_limit_kmh": 50,
            "recommended_staging_point": "Khopoli Toll Plaza Emergency Staging"
        },
        {
            "hotspot_id": "HOT-MUM-03",
            "name": "Eastern Express Highway (Amar Mahal Junction)",
            "corridor": "EEH Chembur",
            "city": "Mumbai",
            "state": "Maharashtra",
            "latitude": 19.0688,
            "longitude": 72.8996,
            "risk_level": "High",
            "annual_accidents": 98,
            "fatalities": 22,
            "primary_hazard": "Weaving Traffic & Elevated Flyover Descent",
            "speed_limit_kmh": 70,
            "recommended_staging_point": "Chedda Nagar Police Chowki Bay"
        },

        # New Delhi & NCR
        {
            "hotspot_id": "HOT-DEL-01",
            "name": "Outer Ring Road (Mukarba Chowk)",
            "corridor": "NH-44 / Ring Road Junction",
            "city": "New Delhi",
            "state": "Delhi",
            "latitude": 28.7360,
            "longitude": 77.1610,
            "risk_level": "Critical",
            "annual_accidents": 168,
            "fatalities": 49,
            "primary_hazard": "High-speed freight entry & pedestrian jaywalking",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Mukarba Chowk Transport Hub Bay"
        },
        {
            "hotspot_id": "HOT-DEL-02",
            "name": "Delhi-Gurugram Expressway (Rajokri Border)",
            "corridor": "NH-48 Corridor",
            "city": "New Delhi",
            "state": "Delhi",
            "latitude": 28.5280,
            "longitude": 77.1040,
            "risk_level": "Critical",
            "annual_accidents": 134,
            "fatalities": 33,
            "primary_hazard": "Bottleneck merges & late-night high-velocity crashes",
            "speed_limit_kmh": 75,
            "recommended_staging_point": "Rajokri Toll Plaza Service Bay"
        },
        {
            "hotspot_id": "HOT-NOI-01",
            "name": "Noida-Greater Noida Expressway (Sector 128 Cut)",
            "corridor": "Noida Expressway",
            "city": "Noida",
            "state": "Uttar Pradesh",
            "latitude": 28.5220,
            "longitude": 77.3680,
            "risk_level": "High",
            "annual_accidents": 112,
            "fatalities": 29,
            "primary_hazard": "Sudden lane changes & dense winter fog collisions",
            "speed_limit_kmh": 80,
            "recommended_staging_point": "Advant Navis Staging Bay"
        },

        # Bangalore
        {
            "hotspot_id": "HOT-BLR-01",
            "name": "Hosur Road Elevated Tollway (Electronic City Phase 1)",
            "corridor": "NH-44 Hosur Road",
            "city": "Bangalore",
            "state": "Karnataka",
            "latitude": 12.8520,
            "longitude": 77.6650,
            "risk_level": "Critical",
            "annual_accidents": 155,
            "fatalities": 41,
            "primary_hazard": "Two-wheeler skidding & high speed straight stretch",
            "speed_limit_kmh": 80,
            "recommended_staging_point": "Electronic City Toll Booth Stand"
        },
        {
            "hotspot_id": "HOT-BLR-02",
            "name": "Outer Ring Road (Marathahalli - Bellandur Junction)",
            "corridor": "ORR IT Corridor",
            "city": "Bangalore",
            "state": "Karnataka",
            "latitude": 12.9360,
            "longitude": 77.6880,
            "risk_level": "High",
            "annual_accidents": 105,
            "fatalities": 24,
            "primary_hazard": "Bus rapid maneuvers & heavy commercial truck traffic",
            "speed_limit_kmh": 50,
            "recommended_staging_point": "Kadubeesanahalli Underpass Bay"
        },
        {
            "hotspot_id": "HOT-BLR-03",
            "name": "Bellary Road (Hebbal Flyover Loops)",
            "corridor": "Airport Highway",
            "city": "Bangalore",
            "state": "Karnataka",
            "latitude": 13.0380,
            "longitude": 77.5910,
            "risk_level": "High",
            "annual_accidents": 89,
            "fatalities": 20,
            "primary_hazard": "Flyover loop merges & airport bound speeding",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Hebbal Esteem Mall Stand"
        },

        # Hyderabad
        {
            "hotspot_id": "HOT-HYD-01",
            "name": "Nehru Outer Ring Road (Gachibowli Junction)",
            "corridor": "ORR Expressway",
            "city": "Hyderabad",
            "state": "Telangana",
            "latitude": 17.4420,
            "longitude": 78.3580,
            "risk_level": "Critical",
            "annual_accidents": 147,
            "fatalities": 45,
            "primary_hazard": "120 km/h over-speeding & tire bursts",
            "speed_limit_kmh": 100,
            "recommended_staging_point": "Gachibowli Toll Plaza Ambulance Point"
        },
        {
            "hotspot_id": "HOT-HYD-02",
            "name": "PVNR Elevated Expressway (Mehdipatnam Ramp)",
            "corridor": "Airport Elevated Corridor",
            "city": "Hyderabad",
            "state": "Telangana",
            "latitude": 17.3910,
            "longitude": 78.4350,
            "risk_level": "High",
            "annual_accidents": 76,
            "fatalities": 18,
            "primary_hazard": "Narrow entry ramps & sudden vehicle stalls",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Mehdipatnam Pillar 100 Staging"
        },

        # Chennai
        {
            "hotspot_id": "HOT-CHE-01",
            "name": "Rajiv Gandhi Salai / OMR (Sholinganallur Junction)",
            "corridor": "IT Expressway (SH-49A)",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "latitude": 12.9010,
            "longitude": 80.2280,
            "risk_level": "Critical",
            "annual_accidents": 138,
            "fatalities": 37,
            "primary_hazard": "Multi-lane cross traffic & motorcycle collisions",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Sholinganallur Signal Traffic Bay"
        },
        {
            "hotspot_id": "HOT-CHE-02",
            "name": "GST Road (Chromepet - Tambaram Corridor)",
            "corridor": "Grand Southern Trunk Road",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "latitude": 12.9520,
            "longitude": 80.1420,
            "risk_level": "High",
            "annual_accidents": 121,
            "fatalities": 31,
            "primary_hazard": "Intense transit bus acceleration & pedestrian crossings",
            "speed_limit_kmh": 50,
            "recommended_staging_point": "Chromepet Flyover Service Post"
        },

        # Ahmedabad
        {
            "hotspot_id": "HOT-AHM-01",
            "name": "Sarkhej - Gandhinagar Highway (ISKCON Cross Road)",
            "corridor": "SG Highway",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "latitude": 23.0280,
            "longitude": 72.5070,
            "risk_level": "Critical",
            "annual_accidents": 150,
            "fatalities": 42,
            "primary_hazard": "Night sports car racing & grade separator merges",
            "speed_limit_kmh": 70,
            "recommended_staging_point": "ISKCON Bridge North Staging"
        },
        {
            "hotspot_id": "HOT-AHM-02",
            "name": "Sardar Patel Ring Road (Odhav Circle)",
            "corridor": "SP Ring Road",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "latitude": 23.0180,
            "longitude": 72.6680,
            "risk_level": "High",
            "annual_accidents": 94,
            "fatalities": 26,
            "primary_hazard": "Heavy tanker movements & poor nocturnal lighting",
            "speed_limit_kmh": 60,
            "recommended_staging_point": "Odhav Ring Road Toll Booth"
        },

        # Kochi
        {
            "hotspot_id": "HOT-KOC-01",
            "name": "Edappally Bypass Junction (NH-66 / NH-544)",
            "corridor": "Bypass Intersection",
            "city": "Kochi",
            "state": "Kerala",
            "latitude": 10.0260,
            "longitude": 76.3080,
            "risk_level": "Critical",
            "annual_accidents": 128,
            "fatalities": 30,
            "primary_hazard": "5-way complex convergence & container trailers",
            "speed_limit_kmh": 50,
            "recommended_staging_point": "Lulu Mall Junction Emergency Post"
        },
        {
            "hotspot_id": "HOT-KOC-02",
            "name": "Kundannoor Junction (NH-66 / Maradu)",
            "corridor": "Kochi Bypass",
            "city": "Kochi",
            "state": "Kerala",
            "latitude": 9.9320,
            "longitude": 76.3210,
            "risk_level": "High",
            "annual_accidents": 84,
            "fatalities": 19,
            "primary_hazard": "Heavy logistics trailers & monsoonal hydroplaning",
            "speed_limit_kmh": 50,
            "recommended_staging_point": "Kundannoor Flyover East Ramp"
        }
    ]

    hotspots_df = pd.DataFrame(hotspots)
    hotspots_df.to_csv(os.path.join(DATA_PROC_DIR, "accident_hotspots.csv"), index=False)
    hotspots_df.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_accident_hotspots.csv"), index=False)
    print(f"-> Accident hotspots generated: {len(hotspots_df)} high-risk corridors")
    return hotspots_df


def generate_ambulance_fleet(hospitals_clean, hotspots_df):
    print(">>> Generating Ambulance Fleet (108 EMRI + Hospital Fleet)...")
    ambulances = []
    amb_counter = 101

    # Generate 6-8 ambulances per city
    for city, specs in CITY_SPECS.items():
        city_hosp = hospitals_clean[hospitals_clean["City"] == city]
        city_hotspots = hotspots_df[hotspots_df["city"] == city]

        # 4 Hospital-based Ambulances
        for _, hosp in city_hosp.head(4).iterrows():
            amb_type = random.choice(["ALS (Advanced Life Support)", "BLS (Basic Life Support)", "Patient Transport"])
            # Status: 70% free, 25% busy, 5% maintenance
            status_choice = np.random.choice(["free", "busy", "maintenance"], p=[0.70, 0.25, 0.05])
            ambulances.append({
                "ambulance_id": f"AMB-{amb_counter}",
                "vehicle_number": f"{hosp['State'][:2].upper()} {random.randint(10,99)} {chr(random.randint(65,90))}{chr(random.randint(65,90))} {random.randint(1000, 9999)}",
                "type": amb_type,
                "status": status_choice,
                "in_service": status_choice != "maintenance",
                "hospital_id": hosp["HospitalID"],
                "hospital_name": hosp["HospitalName"],
                "city": city,
                "state": specs["state"],
                "latitude": hosp["Latitude"] + (random.random() - 0.5) * 0.02,
                "longitude": hosp["Longitude"] + (random.random() - 0.5) * 0.02,
                "driver_name": f"Pilot {random.choice(['Ramesh', 'Suresh', 'Vikram', 'Anil', 'Manish', 'Karthik', 'Praveen', 'Santosh'])}",
                "driver_phone": f"+91 91{random.randint(10000000, 99999999)}",
                "staged_hotspot_id": None,
                "staged_hotspot_name": "Hospital Base Stand",
                "equipment": "Ventilator + Defibrillator + O2 Monitor" if "ALS" in amb_type else "O2 Cylinder + Stretcher + First Aid",
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            amb_counter += 1

        # 2-3 Hotspot-Staged 108 Ambulances (Parked right near high-risk zones!)
        for _, spot in city_hotspots.iterrows():
            amb_type = "ALS (Advanced Life Support)"
            status_choice = np.random.choice(["free", "busy"], p=[0.85, 0.15])
            nearest_hosp = city_hosp.iloc[0] if len(city_hosp) > 0 else None
            ambulances.append({
                "ambulance_id": f"AMB-{amb_counter}",
                "vehicle_number": f"{specs['state'][:2].upper()} 01 G {random.randint(1000, 9999)} (108 EMRI)",
                "type": amb_type,
                "status": status_choice,
                "in_service": True,
                "hospital_id": nearest_hosp["HospitalID"] if nearest_hosp is not None else "H001",
                "hospital_name": f"108 Staging ({spot['name'][:25]})",
                "city": city,
                "state": specs["state"],
                "latitude": spot["latitude"] + (random.random() - 0.5) * 0.008,
                "longitude": spot["longitude"] + (random.random() - 0.5) * 0.008,
                "driver_name": f"Officer {random.choice(['Arun', 'Rajesh', 'Sunil', 'Ajay', 'Deepak', 'Sanjay'])}",
                "driver_phone": f"+91 108 {random.randint(1000, 9999)}",
                "staged_hotspot_id": spot["hotspot_id"],
                "staged_hotspot_name": spot["recommended_staging_point"],
                "equipment": "Full Trauma Life Support + Multi-channel ECG + Portable Ventilator",
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            amb_counter += 1

    amb_df = pd.DataFrame(ambulances)
    amb_df.to_csv(os.path.join(DATA_PROC_DIR, "ambulances_fleet.csv"), index=False)
    amb_df.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_ambulance_fleet.csv"), index=False)
    print(f"-> Ambulance fleet generated: {len(amb_df)} vehicles across 8 metropolitan cities")
    return amb_df


def generate_system_users():
    print(">>> Generating System Roles & Access Control...")
    users = [
        {
            "user_id": 1,
            "username": "admin",
            "full_name": "Dr. N.K. Syam Sundar Reddy",
            "role": "admin",
            "title": "Director & Emergency System Administrator",
            "hospital_id": "ALL",
            "access_level": "Full System Access (Read/Write/Dispatch/Override)"
        },
        {
            "user_id": 2,
            "username": "pharmacy",
            "full_name": "K. Vishal (R.Ph.)",
            "role": "pharmacy",
            "title": "Chief Pharmacist & Blood Bank Incharge",
            "hospital_id": "H001",
            "access_level": "Pharmacy & Blood Bank Management"
        },
        {
            "user_id": 3,
            "username": "reception",
            "full_name": "S. Nikhil",
            "role": "reception",
            "title": "Emergency Triage & Bed Allocation Officer",
            "hospital_id": "H001",
            "access_level": "Bed Tracking, Patient Admissions, Doctor Roster"
        },
        {
            "user_id": 4,
            "username": "manager",
            "full_name": "K. Ramesh (Dispatcher)",
            "role": "manager",
            "title": "Fleet Command & 108 Dispatch Manager",
            "hospital_id": "FLEET_108",
            "access_level": "Ambulance Routing, Allocation, Hotspot Staging"
        }
    ]
    users_df = pd.DataFrame(users)
    users_df.to_csv(os.path.join(DATA_PROC_DIR, "users_rbac.csv"), index=False)
    print(f"-> System roles generated: {len(users_df)} predefined accounts")
    return users_df


if __name__ == "__main__":
    print("=== STARTING TECHHUNTERS SMART HOSPITAL DATA PIPELINE ===")
    hosp_df, doc_df = clean_hospitals_and_doctors()
    pharma_df, blood_df = clean_pharma_data()
    hotspots_df = generate_accident_hotspots()
    amb_df = generate_ambulance_fleet(hosp_df, hotspots_df)
    users_df = generate_system_users()
    print("=== DATA PIPELINE COMPLETED SUCCESSFULLY ===")
