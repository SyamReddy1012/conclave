-- Smart Hospital Optimization & Emergency Response System
-- PostgreSQL Schema (Production / Multi-Hospital Deployment)
-- Matches README Section 7 Specifications with multi-hospital support

-- 1. Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id VARCHAR(50) PRIMARY KEY,
    hospital_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- Government / Private
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    total_beds INT NOT NULL,
    general_beds_total INT NOT NULL,
    general_beds_occupied INT NOT NULL,
    general_beds_free INT NOT NULL,
    icu_beds_total INT NOT NULL,
    icu_beds_occupied INT NOT NULL,
    icu_beds_free INT NOT NULL,
    emergency_beds_total INT NOT NULL,
    emergency_beds_occupied INT NOT NULL,
    emergency_beds_free INT NOT NULL,
    ventilators_total INT NOT NULL,
    ventilators_in_use INT NOT NULL,
    ventilators_available INT NOT NULL,
    free_beds_percentage NUMERIC(5,2) NOT NULL,
    status VARCHAR(50) NOT NULL, -- Normal / Critical Alert
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Beds Table (README Section 7 exact schema)
CREATE TABLE IF NOT EXISTS beds (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) REFERENCES hospitals(hospital_id),
    ward_type VARCHAR(50) NOT NULL, -- general / ICU / emergency
    total INT NOT NULL,
    occupied INT NOT NULL,
    free INT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Medicines Inventory Table (README Section 7 exact schema)
CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) REFERENCES hospitals(hospital_id),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    distributor VARCHAR(100),
    quantity INT NOT NULL,
    unit_price NUMERIC(10,2),
    expiry_days_left INT,
    expiry_date DATE NOT NULL,
    status VARCHAR(50), -- ADEQUATE / LOW_STOCK / NEAR_EXPIRY / EXPIRED
    total_sales NUMERIC(12,2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ambulances Fleet Table (README Section 7 exact schema)
CREATE TABLE IF NOT EXISTS ambulances (
    id SERIAL PRIMARY KEY,
    ambulance_code VARCHAR(50) UNIQUE NOT NULL,
    hospital_id VARCHAR(50) REFERENCES hospitals(hospital_id),
    hospital_name VARCHAR(255),
    vehicle_number VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL, -- ALS / BLS / Patient Transport
    status VARCHAR(50) NOT NULL, -- free / busy / maintenance
    in_service BOOLEAN DEFAULT TRUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    driver_name VARCHAR(150),
    driver_phone VARCHAR(50),
    equipment TEXT,
    staged_hotspot_id VARCHAR(50),
    staged_hotspot_name VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Users Table (README Section 7 exact schema)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL, -- admin / pharmacy / reception / manager
    title VARCHAR(150),
    hospital_id VARCHAR(50),
    access_level TEXT
);

-- 6. Accident Hotspots Table (MoRTH / City Traffic Police High-Incident Corridors)
CREATE TABLE IF NOT EXISTS accident_hotspots (
    hotspot_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    corridor VARCHAR(150),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    risk_level VARCHAR(50) NOT NULL, -- Critical / High / Moderate
    annual_accidents INT NOT NULL,
    fatalities INT NOT NULL,
    primary_hazard TEXT,
    speed_limit_kmh INT,
    recommended_staging_point VARCHAR(255)
);

-- 7. Doctors Directory Table
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id VARCHAR(50) PRIMARY KEY,
    doctor_name VARCHAR(150) NOT NULL,
    hospital_id VARCHAR(50) REFERENCES hospitals(hospital_id),
    specialization VARCHAR(100) NOT NULL,
    experience_years INT NOT NULL,
    on_duty BOOLEAN DEFAULT TRUE,
    phone VARCHAR(50)
);

-- 8. Blood Bank Table
CREATE TABLE IF NOT EXISTS blood_bank (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) REFERENCES hospitals(hospital_id),
    blood_group VARCHAR(10) NOT NULL,
    units_available INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Emergency Dispatches Log Table
CREATE TABLE IF NOT EXISTS emergency_dispatches (
    dispatch_id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    caller_phone VARCHAR(50),
    location_name VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    required_ward VARCHAR(50),
    patient_severity VARCHAR(50),
    matched_ambulance_id VARCHAR(50),
    ambulance_code VARCHAR(50),
    eta_minutes INT,
    matched_hospital_id VARCHAR(50),
    hospital_name VARCHAR(255),
    reserved_bed_type VARCHAR(50),
    fallback_triggered BOOLEAN DEFAULT FALSE,
    search_radius_km NUMERIC(6,2),
    status VARCHAR(50),
    notes TEXT
);
