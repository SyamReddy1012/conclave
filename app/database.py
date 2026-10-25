"""
Database Layer for Smart Hospital Optimization & Emergency Response System
Provides SQLite persistence matching the PostgreSQL schema outlined in the README.
Auto-populates from data/processed files.
"""

import os
import sqlite3
import pandas as pd
from datetime import datetime

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(WORKSPACE_DIR, "hospital_system.db")
DATA_PROC_DIR = os.path.join(WORKSPACE_DIR, "data", "processed")

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 20000;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reseed=False):
    conn = get_connection()
    cur = conn.cursor()

    # Create tables
    cur.execute("""
    CREATE TABLE IF NOT EXISTS hospitals (
        hospital_id TEXT PRIMARY KEY,
        hospital_name TEXT,
        city TEXT,
        state TEXT,
        type TEXT,
        latitude REAL,
        longitude REAL,
        total_beds INTEGER,
        general_beds_total INTEGER,
        general_beds_occupied INTEGER,
        general_beds_free INTEGER,
        icu_beds_total INTEGER,
        icu_beds_occupied INTEGER,
        icu_beds_free INTEGER,
        emergency_beds_total INTEGER,
        emergency_beds_occupied INTEGER,
        emergency_beds_free INTEGER,
        ventilators_total INTEGER,
        ventilators_in_use INTEGER,
        ventilators_available INTEGER,
        free_beds_percentage REAL,
        status TEXT,
        last_updated TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS beds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        ward_type TEXT,
        total INTEGER,
        occupied INTEGER,
        free INTEGER,
        last_updated TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        name TEXT,
        category TEXT,
        distributor TEXT,
        quantity INTEGER,
        unit_price REAL,
        expiry_days_left INTEGER,
        expiry_date TEXT,
        status TEXT,
        total_sales REAL,
        last_updated TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS ambulances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ambulance_code TEXT UNIQUE,
        hospital_id TEXT,
        hospital_name TEXT,
        vehicle_number TEXT,
        type TEXT,
        status TEXT,
        in_service INTEGER,
        latitude REAL,
        longitude REAL,
        driver_name TEXT,
        driver_phone TEXT,
        equipment TEXT,
        staged_hotspot_id TEXT,
        staged_hotspot_name TEXT,
        city TEXT,
        state TEXT,
        last_updated TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        full_name TEXT,
        role TEXT,
        title TEXT,
        hospital_id TEXT,
        access_level TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS accident_hotspots (
        hotspot_id TEXT PRIMARY KEY,
        name TEXT,
        corridor TEXT,
        city TEXT,
        state TEXT,
        latitude REAL,
        longitude REAL,
        risk_level TEXT,
        annual_accidents INTEGER,
        fatalities INTEGER,
        primary_hazard TEXT,
        speed_limit_kmh INTEGER,
        recommended_staging_point TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS doctors (
        doctor_id TEXT PRIMARY KEY,
        doctor_name TEXT,
        hospital_id TEXT,
        specialization TEXT,
        experience_years INTEGER,
        on_duty INTEGER,
        phone TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS blood_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        blood_group TEXT,
        units_available INTEGER,
        status TEXT,
        last_updated TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS emergency_dispatches (
        dispatch_id TEXT PRIMARY KEY,
        timestamp TIMESTAMP,
        caller_phone TEXT,
        location_name TEXT,
        latitude REAL,
        longitude REAL,
        required_ward TEXT,
        patient_severity TEXT,
        matched_ambulance_id TEXT,
        ambulance_code TEXT,
        eta_minutes INTEGER,
        matched_hospital_id TEXT,
        hospital_name TEXT,
        reserved_bed_type TEXT,
        fallback_triggered INTEGER,
        search_radius_km REAL,
        status TEXT,
        notes TEXT
    )
    """)

    conn.commit()

    # Check if data exists
    cur.execute("SELECT COUNT(*) FROM hospitals")
    hosp_count = cur.fetchone()[0]

    if hosp_count == 0 or force_reseed:
        print(">>> Seeding database from processed data...")
        # 1. Hospitals & Beds
        hosp_csv = os.path.join(DATA_PROC_DIR, "hospitals_cleaned.csv")
        if os.path.exists(hosp_csv):
            h_df = pd.read_csv(hosp_csv)
            for _, row in h_df.iterrows():
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                INSERT OR REPLACE INTO hospitals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    str(row["HospitalID"]), str(row["HospitalName"]), str(row["City"]), str(row["State"]),
                    str(row["Type"]), float(row["Latitude"]), float(row["Longitude"]),
                    int(row["Beds"]), int(row["General_Beds_Total"]), int(row["General_Beds_Occupied"]), int(row["General_Beds_Free"]),
                    int(row["ICU_Beds_Total"]), int(row["ICU_Beds_Occupied"]), int(row["ICU_Beds_Free"]),
                    int(row["Emergency_Beds_Total"]), int(row["Emergency_Beds_Occupied"]), int(row["Emergency_Beds_Free"]),
                    int(row["Ventilators_Total"]), int(row["Ventilators_In_Use"]), int(row["Ventilators_Available"]),
                    float(row["Free_Beds_Percentage"]), str(row["Bed_Availability_Status"]), now_str
                ))

                # Also insert normalized beds rows matching README Section 7
                for ward, total_k, occ_k, free_k in [
                    ("General", "General_Beds_Total", "General_Beds_Occupied", "General_Beds_Free"),
                    ("ICU", "ICU_Beds_Total", "ICU_Beds_Occupied", "ICU_Beds_Free"),
                    ("Emergency", "Emergency_Beds_Total", "Emergency_Beds_Occupied", "Emergency_Beds_Free")
                ]:
                    cur.execute("""
                    INSERT INTO beds (hospital_id, ward_type, total, occupied, free, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        str(row["HospitalID"]), ward, int(row[total_k]), int(row[occ_k]), int(row[free_k]), now_str
                    ))

        # 2. Doctors
        doc_csv = os.path.join(DATA_PROC_DIR, "doctors_cleaned.csv")
        if os.path.exists(doc_csv):
            d_df = pd.read_csv(doc_csv)
            for _, row in d_df.iterrows():
                cur.execute("""
                INSERT OR REPLACE INTO doctors VALUES (?,?,?,?,?,?,?)
                """, (
                    str(row["DoctorID"]), str(row["DoctorName"]), str(row["HospitalID"]),
                    str(row["Specialization"]), int(row["ExperienceYears"]), 1 if row["On_Duty"] else 0, str(row["Phone"])
                ))

        # 3. Medicines
        pharma_csv = os.path.join(DATA_PROC_DIR, "pharma_inventory.csv")
        if os.path.exists(pharma_csv):
            p_df = pd.read_csv(pharma_csv)
            for i, row in p_df.iterrows():
                # Assign to hospital in round-robin fashion or region
                hid = f"H{str((i % 200) + 1).zfill(3)}"
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                INSERT INTO medicines (hospital_id, name, category, distributor, quantity, unit_price, expiry_days_left, expiry_date, status, total_sales, last_updated)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    hid, str(row["Drug_Name"]), str(row["Category"]), str(row["Distributor"]),
                    int(row["Quantity"]), float(row["Unit_Price"]), int(row["Expiry_Days_Left"]),
                    str(row["Calculated_Expiry_Date"]), str(row["Stock_Status"]), float(row["Total_Sales"]), now_str
                ))

        # 4. Accident Hotspots
        hot_csv = os.path.join(DATA_PROC_DIR, "accident_hotspots.csv")
        if os.path.exists(hot_csv):
            hot_df = pd.read_csv(hot_csv)
            for _, row in hot_df.iterrows():
                cur.execute("""
                INSERT OR REPLACE INTO accident_hotspots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    str(row["hotspot_id"]), str(row["name"]), str(row["corridor"]), str(row["city"]),
                    str(row["state"]), float(row["latitude"]), float(row["longitude"]), str(row["risk_level"]),
                    int(row["annual_accidents"]), int(row["fatalities"]), str(row["primary_hazard"]),
                    int(row["speed_limit_kmh"]), str(row["recommended_staging_point"])
                ))

        # 5. Ambulances
        amb_csv = os.path.join(DATA_PROC_DIR, "ambulances_fleet.csv")
        if os.path.exists(amb_csv):
            a_df = pd.read_csv(amb_csv)
            for _, row in a_df.iterrows():
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                INSERT OR REPLACE INTO ambulances (ambulance_code, hospital_id, hospital_name, vehicle_number, type, status, in_service, latitude, longitude, driver_name, driver_phone, equipment, staged_hotspot_id, staged_hotspot_name, city, state, last_updated)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    str(row["ambulance_id"]), str(row["hospital_id"]), str(row["hospital_name"]),
                    str(row["vehicle_number"]), str(row["type"]), str(row["status"]), 1 if row["in_service"] else 0,
                    float(row["latitude"]), float(row["longitude"]), str(row["driver_name"]),
                    str(row["driver_phone"]), str(row["equipment"]), str(row["staged_hotspot_id"]) if pd.notna(row["staged_hotspot_id"]) else None,
                    str(row["staged_hotspot_name"]), str(row["city"]), str(row["state"]), now_str
                ))

        # 6. Blood Bank
        blood_csv = os.path.join(DATA_PROC_DIR, "blood_bank.csv")
        if os.path.exists(blood_csv):
            b_df = pd.read_csv(blood_csv)
            for _, row in b_df.iterrows():
                cur.execute("""
                INSERT INTO blood_bank (hospital_id, blood_group, units_available, status, last_updated)
                VALUES (?,?,?,?,?)
                """, (
                    str(row["HospitalID"]), str(row["Blood_Group"]), int(row["Units_Available"]), str(row["Status"]), str(row["Last_Updated"])
                ))

        # 7. Users
        user_csv = os.path.join(DATA_PROC_DIR, "users_rbac.csv")
        if os.path.exists(user_csv):
            u_df = pd.read_csv(user_csv)
            for _, row in u_df.iterrows():
                cur.execute("""
                INSERT OR REPLACE INTO users (username, full_name, role, title, hospital_id, access_level)
                VALUES (?,?,?,?,?,?)
                """, (
                    str(row["username"]), str(row["full_name"]), str(row["role"]),
                    str(row["title"]), str(row["hospital_id"]), str(row["access_level"])
                ))

        conn.commit()
        print(">>> Database initialized and seeded successfully!")

    conn.close()

if __name__ == "__main__":
    init_db(force_reseed=True)
