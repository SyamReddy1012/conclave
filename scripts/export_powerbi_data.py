"""
Power BI Data Exporter & Model Generator
Exports all relational entities from the database into Power BI-ready star schema datasets.
"""

import os
import sqlite3
import pandas as pd

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(WORKSPACE_DIR, "hospital_system.db")
DASHBOARD_DIR = os.path.join(WORKSPACE_DIR, "dashboard")
DASHBOARD_DATA_DIR = os.path.join(DASHBOARD_DIR, "data")
os.makedirs(DASHBOARD_DATA_DIR, exist_ok=True)

def export_powerbi_datasets():
    print(">>> Exporting datasets for Power BI Desktop...")
    conn = sqlite3.connect(DB_PATH)

    # 1. Dim Hospitals
    df_hosp = pd.read_sql_query("""
        SELECT hospital_id AS HospitalKey, hospital_id, hospital_name, city, state, type,
               latitude, longitude, total_beds, ventilators_total
        FROM hospitals
    """, conn)
    df_hosp.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_hospitals.csv"), index=False)

    # 2. Dim Doctors
    df_doc = pd.read_sql_query("""
        SELECT doctor_id AS DoctorKey, doctor_id, doctor_name, hospital_id AS HospitalKey,
               specialization, experience_years, on_duty, phone
        FROM doctors
    """, conn)
    df_doc.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_doctors.csv"), index=False)

    # 3. Dim Hotspots
    df_hot = pd.read_sql_query("""
        SELECT hotspot_id AS HotspotKey, hotspot_id, name AS hotspot_name, corridor,
               city, state, latitude, longitude, risk_level, annual_accidents, fatalities,
               primary_hazard, speed_limit_kmh, recommended_staging_point
        FROM accident_hotspots
    """, conn)
    df_hot.to_csv(os.path.join(DASHBOARD_DATA_DIR, "dim_accident_hotspots.csv"), index=False)

    # 4. Fact Bed Occupancy
    df_beds = pd.read_sql_query("""
        SELECT b.id AS BedFactKey, b.hospital_id AS HospitalKey, h.city, h.state,
               b.ward_type, b.total AS total_beds, b.occupied AS occupied_beds,
               b.free AS free_beds,
               ROUND(CAST(b.occupied AS REAL) * 100.0 / NULLIF(b.total, 0), 2) AS occupancy_rate_pct,
               CASE WHEN b.free <= 4 THEN 1 ELSE 0 END AS is_critical_shortage,
               b.last_updated
        FROM beds b
        JOIN hospitals h ON b.hospital_id = h.hospital_id
    """, conn)
    df_beds.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_bed_occupancy.csv"), index=False)

    # 5. Fact Pharma Inventory
    df_pharma = pd.read_sql_query("""
        SELECT id AS PharmaFactKey, hospital_id AS HospitalKey, name AS drug_name,
               category, distributor, quantity, unit_price, expiry_days_left,
               expiry_date, status AS stock_status, total_sales,
               CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END AS is_expired,
               CASE WHEN status = 'NEAR_EXPIRY' THEN 1 ELSE 0 END AS is_near_expiry,
               CASE WHEN quantity < 50 THEN 1 ELSE 0 END AS is_low_stock,
               last_updated
        FROM medicines
    """, conn)
    df_pharma.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_pharma_inventory.csv"), index=False)

    # 6. Fact Ambulance Fleet
    df_amb = pd.read_sql_query("""
        SELECT id AS AmbFactKey, ambulance_code, hospital_id AS HospitalKey,
               hospital_name, vehicle_number, type AS ambulance_type, status AS fleet_status,
               in_service, latitude, longitude, driver_name, driver_phone, equipment,
               staged_hotspot_id AS HotspotKey, staged_hotspot_name, city, state, last_updated
        FROM ambulances
    """, conn)
    df_amb.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_ambulance_fleet.csv"), index=False)

    # 7. Blood Bank
    df_blood = pd.read_sql_query("""
        SELECT id AS BloodFactKey, hospital_id AS HospitalKey, blood_group,
               units_available, status, last_updated
        FROM blood_bank
    """, conn)
    df_blood.to_csv(os.path.join(DASHBOARD_DATA_DIR, "fact_blood_bank.csv"), index=False)

    conn.close()
    print(">>> Power BI star schema CSVs generated in dashboard/data/!")

if __name__ == "__main__":
    export_powerbi_datasets()
