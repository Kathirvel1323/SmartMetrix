import os
import io
import pytest

TEST_AI_TOKEN = "test_ai_service_token_min_32_characters_12345"
os.environ["AI_SERVICE_TOKEN"] = TEST_AI_TOKEN

from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from main import app, DISCLAIMER_TEXT

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "smartmetrix-ai-service"
    assert data["algorithm"] == "IsolationForest"

def test_unauthorized_missing_token():
    response = client.post("/detect-anomaly", json={"records": []})
    assert response.status_code == 401

def test_unauthorized_invalid_token():
    response = client.post(
        "/detect-anomaly",
        json={"records": []},
        headers={"Authorization": "Bearer wrong_token"}
    )
    assert response.status_code == 403

def test_insufficient_data():
    records = [
        {"recordId": "rec-1", "features": {"deviationToToleranceRatio": 0.5, "inspectionCount": 3}},
        {"recordId": "rec-2", "features": {"deviationToToleranceRatio": 0.6, "inspectionCount": 4}}
    ]
    response = client.post(
        "/detect-anomaly",
        json={"records": records, "minSamples": 5},
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "INSUFFICIENT_DATA"
    assert data["method"] == "INSUFFICIENT_DATA"
    assert "below minimum required sample size" in data["message"]
    assert data["disclaimer"] == DISCLAIMER_TEXT
    assert "confirmed fraud" not in data["disclaimer"].lower()

def test_reject_nan_infinity():
    from main import detect_anomaly, AnomalyDetectionRequest, FeatureRecord
    with pytest.raises(Exception) as excinfo:
        req = AnomalyDetectionRequest(
            records=[
                FeatureRecord(recordId="rec-1", features={"deviationToToleranceRatio": 0.5}),
                FeatureRecord(recordId="rec-2", features={"deviationToToleranceRatio": float("inf")}),
                FeatureRecord(recordId="rec-3", features={"deviationToToleranceRatio": 0.2}),
                FeatureRecord(recordId="rec-4", features={"deviationToToleranceRatio": 0.1}),
                FeatureRecord(recordId="rec-5", features={"deviationToToleranceRatio": 0.3}),
            ],
            minSamples=5
        )
        detect_anomaly(req, authorization=f"Bearer {TEST_AI_TOKEN}")
    assert "Invalid numeric value" in str(excinfo.value.detail)

def test_valid_isolation_forest_batch_and_determinism():
    records = [
        {"recordId": f"normal-{i}", "features": {
            "deviationToToleranceRatio": 0.15 + 0.01 * i,
            "absDeviationPct": 0.2 + 0.01 * i,
            "passFailIndicator": 0.0,
            "priorFailureRate": 0.0,
            "avgDeviation": 0.02,
            "inspectionCount": 5
        }} for i in range(9)
    ]
    records.append({
        "recordId": "outlier-1",
        "features": {
            "deviationToToleranceRatio": 25.5,
            "absDeviationPct": 30.0,
            "passFailIndicator": 1.0,
            "priorFailureRate": 0.8,
            "avgDeviation": 5.0,
            "inspectionCount": 1
        }
    })

    res1 = client.post(
        "/detect-anomaly",
        json={"records": records, "minSamples": 5, "contamination": 0.1},
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    res2 = client.post(
        "/detect-anomaly",
        json={"records": records, "minSamples": 5, "contamination": 0.1},
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )

    assert res1.status_code == 200
    assert res2.status_code == 200

    data1 = res1.json()
    data2 = res2.json()

    assert data1["status"] == "SUCCESS"
    assert data1["method"] == "ISOLATION_FOREST"
    assert len(data1["results"]) == 10
    assert data1["results"] == data2["results"]

    outlier_res = next(r for r in data1["results"] if r["recordId"] == "outlier-1")
    assert outlier_res["potentialAnomaly"] is True
    assert outlier_res["status"] == "POTENTIAL_ANOMALY"

def test_photo_assist_valid_image():
    img = Image.new('RGB', (100, 100), color=(128, 128, 128))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 50, 50], fill=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    res = client.post(
        "/photo-assist",
        files={"file": ("test.png", buf, "image/png")},
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["qualityMetrics"]["resolution"]["width"] == 100
    assert data["qualityMetrics"]["resolution"]["height"] == 100
    assert data["semanticFields"]["seal_intact"] == "NOT_ASSESSED"
    assert data["semanticFields"]["model_plate_legible"] == "MANUAL_REVIEW_REQUIRED"
    assert "disclaimer" in data

def test_photo_assist_reject_invalid_image():
    fake_buf = io.BytesIO(b"This is not a real image file payload.")
    res = client.post(
        "/photo-assist",
        files={"file": ("fake.txt", fake_buf, "text/plain")},
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    assert res.status_code == 400
    assert "Invalid image format" in res.json()["detail"]

def test_predictive_analysis_insufficient_data():
    req = {
        "instrumentId": "INST-001",
        "history": [
            {"inspectionDate": "2026-01-01", "inspectorResult": "PASS", "deviationPercentage": 0.1}
        ]
    }
    res = client.post(
        "/predictive-analysis",
        json=req,
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "INSUFFICIENT_DATA"
    assert data["trendDirection"] == "INSUFFICIENT_DATA"

def test_predictive_analysis_worsening_trend():
    req = {
        "instrumentId": "INST-002",
        "history": [
            {"inspectionDate": "2026-01-01", "inspectorResult": "PASS", "deviationPercentage": 0.1},
            {"inspectionDate": "2026-02-01", "inspectorResult": "PASS", "deviationPercentage": 0.5},
            {"inspectionDate": "2026-03-01", "inspectorResult": "FAIL", "deviationPercentage": 1.2}
        ]
    }
    res = client.post(
        "/predictive-analysis",
        json=req,
        headers={"Authorization": f"Bearer {TEST_AI_TOKEN}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["trendDirection"] == "WORSENING"
    assert data["slope"] > 0
    assert len(data["evidence"]) >= 3
