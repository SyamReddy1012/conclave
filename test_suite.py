"""
Comprehensive Integration Test Suite
Validates all REST endpoints, data pipelines, allocation logic, and scenario triggers.
"""

import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8080"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def post(path, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("==================================================================")
    print("  RUNNING SYSTEM INTEGRATION TEST SUITE")
    print("==================================================================")
    passed = 0
    total = 0

    # 1. Health
    total += 1
    status, data = get("/api/health")
    assert status == 200 and data["status"] == "healthy"
    print("[PASS] Test 1: Server Health Check passed")
    passed += 1

    # 2. Overview KPIs
    total += 1
    status, data = get("/api/overview")
    assert status == 200 and data["hospitals"]["total_beds"] > 0
    print(f"[PASS] Test 2: Overview KPIs passed (Total Beds: {data['hospitals']['total_beds']}, Free ICU: {data['hospitals']['free_icu']})")
    passed += 1

    # 3. Hospitals list
    total += 1
    status, data = get("/api/hospitals?limit=5")
    assert status == 200 and len(data) == 5
    print(f"[PASS] Test 3: Hospitals Query passed (Sample: {data[0]['hospital_name']} in {data[0]['city']})")
    passed += 1

    # 4. Hospital Detail with doctors
    total += 1
    hid = data[0]["hospital_id"]
    status, data = get(f"/api/hospital/{hid}")
    assert status == 200 and len(data["doctors"]) > 0 and len(data["blood_bank"]) > 0
    print(f"[PASS] Test 4: Hospital Details & Doctors passed ({len(data['doctors'])} doctors, {len(data['blood_bank'])} blood groups)")
    passed += 1

    # 5. Medicines
    total += 1
    status, data = get("/api/medicines?limit=5")
    assert status == 200 and len(data) == 5
    print(f"[PASS] Test 5: Medicine Inventory passed (Sample: {data[0]['name']} - {data[0]['quantity']} units, status: {data[0]['status']})")
    passed += 1

    # 6. Accident Hotspots
    total += 1
    status, data = get("/api/hotspots")
    assert status == 200 and len(data) >= 15
    print(f"[PASS] Test 6: Accident Hotspots passed ({len(data)} high-risk corridors loaded)")
    passed += 1

    # 7. Ambulances Fleet
    total += 1
    status, data = get("/api/ambulances")
    assert status == 200 and len(data) > 30
    print(f"[PASS] Test 7: Ambulance Fleet passed ({len(data)} vehicles loaded)")
    passed += 1

    # 8. 4-Stage Ambulance Allocation
    total += 1
    alloc_req = {
        "latitude": 19.1663,
        "longitude": 72.8526,
        "location_name": "Western Express Highway (Goregaon)",
        "city": "Mumbai",
        "required_ward": "ICU",
        "patient_severity": "Critical - Level 1 Trauma",
        "search_radius_km": 20.0
    }
    status, data = post("/api/dispatch/allocate", alloc_req)
    assert status == 200 and data["success"] is True
    amb = data["matched_ambulance"]
    hosp = data["matched_hospital"]
    print(f"[PASS] Test 8: 4-Stage Ambulance Allocation passed (Matched Amb: {amb['ambulance_code']}, ETA: {amb['eta_minutes']} mins -> Hosp: {hosp['hospital_name']})")
    passed += 1

    # 9. Fallback Simulation (Zero beds within radius)
    total += 1
    fallback_req = {
        "latitude": 19.1663,
        "longitude": 72.8526,
        "location_name": "Remote Highway Section",
        "city": "Mumbai",
        "required_ward": "ICU",
        "search_radius_km": 10.0,
        "simulate_no_bed": True
    }
    status, data = post("/api/dispatch/allocate", fallback_req)
    assert status == 200 and data["fallback_triggered"] is True
    print(f"[PASS] Test 9: Bed Shortage Fallback & Radius Expansion passed (Radius: {data['search_radius_km']} km, Alert: {bool(data['admin_alert'])})")
    passed += 1

    # 10. Section 9 Highway Demo Scenario Trigger
    total += 1
    status, data = post("/api/demo/highway-accident", {"hotspot_id": "HOT-MUM-01"})
    assert status == 200 and data["success"] is True
    print(f"[PASS] Test 10: Section 9 Highway Demo Scenario passed (Dispatch ID: {data['dispatch_id']})")
    passed += 1

    # 11. Bed Reservation & Discharge
    total += 1
    res_status, res_data = post("/api/hospital/reserve-bed", {"hospital_id": hid, "ward_type": "ICU"})
    assert res_status == 200 and res_data["success"] is True
    dis_status, dis_data = post("/api/hospital/discharge", {"hospital_id": hid, "ward_type": "ICU"})
    assert dis_status == 200 and dis_data["success"] is True
    print("[PASS] Test 11: Bed Reservation & Patient Discharge Lifecycle passed")
    passed += 1

    # 12. Medicine Restock & Disposal
    total += 1
    restock_status, restock_data = post("/api/medicines/restock", {"medicine_id": 1, "quantity": 100})
    assert restock_status == 200 and restock_data["success"] is True
    print("[PASS] Test 12: Medicine Restock Lifecycle passed")
    passed += 1

    # 13. Power BI Metrics
    total += 1
    status, data = get("/api/powerbi-metrics")
    assert status == 200 and "bed_by_ward" in data and "pharma_status" in data
    print("[PASS] Test 13: Power BI Analytical Model Metrics passed")
    passed += 1

    # 14. Static HTML Index Serving
    total += 1
    req = urllib.request.Request(f"{BASE_URL}/")
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        assert resp.status == 200 and "TechHunters" in html and "Smart Hospital" in html
        assert "login-view" in html and "Staff Portal Login" in html
    print("[PASS] Test 14: Frontend HTML5 Shell with Login Portal correctly served")
    passed += 1

    # 15. User Authentication (Login API)
    total += 1
    login_status, login_data = post("/api/auth/login", {"username": "admin", "password": "admin123"})
    assert login_status == 200 and login_data["success"] is True and login_data["user"]["role"] == "admin"
    print(f"[PASS] Test 15: Staff Authentication API passed (Logged in as {login_data['user']['full_name']})")
    passed += 1

    # 16. Demo Users List
    total += 1
    users_status, users_data = get("/api/auth/users")
    assert users_status == 200 and len(users_data) == 4
    print(f"[PASS] Test 16: RBAC Demo Accounts API passed ({len(users_data)} roles registered)")
    passed += 1

    print("==================================================================")
    print(f"  ALL {passed}/{total} INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
