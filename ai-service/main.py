"""
FastAPI Isolation Forest Anomaly Detection & Phase 7 Lite Decision Support Service
"""

import os
import io
import math
from typing import List, Optional, Dict, Any, Literal
from fastapi import FastAPI, Header, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from PIL import Image

app = FastAPI(
    title="SmartMetrix AI & Advanced Decision Support Service",
    version="1.0.0",
    description="Isolation Forest anomaly detection, Photo Assist quality analysis, and Predictive Analytics"
)

# Service Token Authentication
DEFAULT_MIN_SAMPLES = int(os.getenv("AI_MIN_SAMPLES", "5"))
DEFAULT_CONTAMINATION = float(os.getenv("AI_CONTAMINATION", "0.1"))
RANDOM_STATE = 42

DISCLAIMER_TEXT = (
    "This assessment is decision support only. It does not constitute a legal determination, "
    "confirm fraud or tampering, or confirm a defect. It does not override the statutory "
    "PASS/FAIL result issued by the assigned authorized inspector."
)

class FeatureRecord(BaseModel):
    recordId: str = Field(..., description="Unique ID of the record or instrument")
    features: Dict[str, Optional[float]] = Field(..., description="Map of feature names to numeric values")

class AnomalyDetectionRequest(BaseModel):
    records: List[FeatureRecord] = Field(..., description="Batch of feature records")
    targetRecordId: Optional[str] = Field(None, description="Optional target record to highlight in results")
    minSamples: Optional[int] = Field(None, description="Minimum sample size required")
    contamination: Optional[float] = Field(None, description="Expected proportion of anomalies")

class AnomalyResultItem(BaseModel):
    recordId: str
    potentialAnomaly: bool
    anomalyScore: float = Field(..., description="Normalized anomaly score between 0.0 (normal) and 1.0 (anomalous)")
    rawScore: float = Field(..., description="Raw decision function score from Isolation Forest")
    status: Literal["POTENTIAL_ANOMALY", "NORMAL"]
    contributingFeatures: List[str]
    features: Dict[str, Optional[float]]

class ModelMetadata(BaseModel):
    algorithm: str
    version: str
    sampleCount: int
    contamination: float
    randomState: int
    featuresUsed: List[str]

class AnomalyDetectionResponse(BaseModel):
    status: Literal["SUCCESS", "INSUFFICIENT_DATA"] = Field(..., description="SUCCESS or INSUFFICIENT_DATA")
    method: Literal["ISOLATION_FOREST", "INSUFFICIENT_DATA"] = Field(..., description="Method used")
    message: str
    results: List[AnomalyResultItem]
    modelMetadata: ModelMetadata
    dataCoverage: float
    disclaimer: str

# Photo Assist Pydantic Schemas
class QualityMetrics(BaseModel):
    resolution: Dict[str, int]
    brightnessScore: float
    contrastScore: float
    sharpnessScore: float
    overallQualityScore: float

class SemanticFields(BaseModel):
    seal_intact: Literal["NOT_ASSESSED", "MANUAL_REVIEW_REQUIRED"] = "NOT_ASSESSED"
    model_plate_legible: Literal["NOT_ASSESSED", "MANUAL_REVIEW_REQUIRED"] = "MANUAL_REVIEW_REQUIRED"
    serial_number_match: Literal["NOT_ASSESSED", "MANUAL_REVIEW_REQUIRED"] = "NOT_ASSESSED"
    tampering_detected: Literal["NOT_ASSESSED", "MANUAL_REVIEW_REQUIRED"] = "NOT_ASSESSED"

class PhotoAssistResponse(BaseModel):
    status: Literal["SUCCESS", "REJECTED_NON_IMAGE"] = "SUCCESS"
    qualityMetrics: QualityMetrics
    semanticFields: SemanticFields
    irregularities: List[str]
    disclaimer: str

# Predictive Analytics Pydantic Schemas
class InspectionPoint(BaseModel):
    inspectionDate: str
    inspectorResult: str
    deviationPercentage: Optional[float] = None

class PredictiveAnalysisRequest(BaseModel):
    instrumentId: str
    history: List[InspectionPoint]

class PredictiveAnalysisResponse(BaseModel):
    status: Literal["SUCCESS", "INSUFFICIENT_DATA"]
    trendDirection: Literal["IMPROVING", "STABLE", "WORSENING", "INSUFFICIENT_DATA"]
    slope: Optional[float] = None
    sampleCount: int
    evidence: List[str]
    dataCoverage: float
    attentionRecommendation: str
    disclaimer: str

def verify_token(authorization: Optional[str] = Header(None)) -> None:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )

    parts = authorization.split(" ")
    token = parts[1] if len(parts) == 2 and parts[0].lower() == "bearer" else parts[0]

    expected_token = os.getenv("AI_SERVICE_TOKEN")
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI_SERVICE_TOKEN is not configured on server"
        )
    if token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service token"
        )

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "smartmetrix-ai-service",
        "version": "1.0.0",
        "algorithm": "IsolationForest"
    }

@app.post("/detect-anomaly", response_model=AnomalyDetectionResponse)
def detect_anomaly(
    req: AnomalyDetectionRequest,
    authorization: Optional[str] = Header(None)
):
    verify_token(authorization)

    min_samples = req.minSamples if req.minSamples is not None else DEFAULT_MIN_SAMPLES
    contamination = req.contamination if req.contamination is not None else DEFAULT_CONTAMINATION

    records = req.records
    total_samples = len(records)

    if total_samples < min_samples:
        return AnomalyDetectionResponse(
            status="INSUFFICIENT_DATA",
            method="INSUFFICIENT_DATA",
            message=f"Sample count ({total_samples}) is below minimum required sample size ({min_samples}) for reliable Isolation Forest detection.",
            results=[],
            modelMetadata=ModelMetadata(
                algorithm="IsolationForest",
                version="sklearn-isolation-forest-1.6",
                sampleCount=total_samples,
                contamination=contamination,
                randomState=RANDOM_STATE,
                featuresUsed=[]
            ),
            dataCoverage=0.0,
            disclaimer=DISCLAIMER_TEXT
        )

    all_feature_keys = set()
    for r in records:
        for k in r.features.keys():
            all_feature_keys.add(k)

    sorted_keys = sorted(list(all_feature_keys))
    valid_features = []
    for k in sorted_keys:
        has_val = False
        for r in records:
            v = r.features.get(k)
            if v is not None:
                if not isinstance(v, (int, float)) or math.isnan(v) or math.isinf(v):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid numeric value (NaN, Infinity or non-numeric) in feature '{k}' for record '{r.recordId}'"
                    )
                has_val = True
        if has_val:
            valid_features.append(k)

    if not valid_features:
        return AnomalyDetectionResponse(
            status="INSUFFICIENT_DATA",
            method="INSUFFICIENT_DATA",
            message="No valid numerical features available across the records.",
            results=[],
            modelMetadata=ModelMetadata(
                algorithm="IsolationForest",
                version="sklearn-isolation-forest-1.6",
                sampleCount=total_samples,
                contamination=contamination,
                randomState=RANDOM_STATE,
                featuresUsed=[]
            ),
            dataCoverage=0.0,
            disclaimer=DISCLAIMER_TEXT
        )

    data_matrix = []
    for r in records:
        row = []
        for feat in valid_features:
            val = r.features.get(feat)
            row.append(val)
        data_matrix.append(row)

    df = pd.DataFrame(data_matrix, columns=valid_features)

    for col in valid_features:
        median_val = df[col].median()
        if pd.isna(median_val):
            median_val = 0.0
        df[col] = df[col].fillna(median_val)

    effective_contamination = max(0.01, min(0.5, contamination))

    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=effective_contamination,
        random_state=RANDOM_STATE,
        n_jobs=1
    )

    iso_forest.fit(df)

    raw_scores = iso_forest.decision_function(df)
    predictions = iso_forest.predict(df)

    min_raw = np.min(raw_scores)
    max_raw = np.max(raw_scores)

    col_medians = df.median()
    col_stds = df.std().replace(0, 1.0)

    results: List[AnomalyResultItem] = []

    for idx, r in enumerate(records):
        raw_s = float(raw_scores[idx])
        is_anomaly = bool(predictions[idx] == -1)

        if max_raw > min_raw:
            normalized_score = float(np.clip((max_raw - raw_s) / (max_raw - min_raw), 0.0, 1.0))
        else:
            normalized_score = 1.0 if is_anomaly else 0.0

        contributing = []
        for feat in valid_features:
            val = float(df.iloc[idx][feat])
            med = float(col_medians[feat])
            std = float(col_stds[feat])
            z_score = abs(val - med) / (std if std > 0 else 1.0)
            if z_score > 1.5:
                contributing.append(feat)

        if is_anomaly and not contributing and valid_features:
            best_feat = max(
                valid_features,
                key=lambda f: abs(float(df.iloc[idx][f]) - float(col_medians[f])) / (float(col_stds[f]) or 1.0)
            )
            contributing.append(best_feat)

        results.append(AnomalyResultItem(
            recordId=r.recordId,
            potentialAnomaly=is_anomaly,
            anomalyScore=round(normalized_score, 4),
            rawScore=round(raw_s, 6),
            status="POTENTIAL_ANOMALY" if is_anomaly else "NORMAL",
            contributingFeatures=contributing,
            features=r.features
        ))

    standard_features = [
        "deviationToToleranceRatio",
        "absDeviationPct",
        "passFailIndicator",
        "priorFailureRate",
        "avgDeviation",
        "inspectionCount"
    ]
    matched_count = sum(1 for f in standard_features if f in valid_features)
    data_coverage = round(matched_count / len(standard_features), 2)

    return AnomalyDetectionResponse(
        status="SUCCESS",
        method="ISOLATION_FOREST",
        message="Anomaly detection completed successfully via Isolation Forest.",
        results=results,
        modelMetadata=ModelMetadata(
            algorithm="IsolationForest",
            version="sklearn-isolation-forest-1.6",
            sampleCount=total_samples,
            contamination=effective_contamination,
            randomState=RANDOM_STATE,
            featuresUsed=valid_features
        ),
        dataCoverage=data_coverage,
        disclaimer=DISCLAIMER_TEXT
    )

# Phase 7 Lite: Photo Assist Endpoint
@app.post("/photo-assist", response_model=PhotoAssistResponse)
async def photo_assist(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    verify_token(authorization)

    contents = await file.read()
    if not contents or len(contents) == 0:
        raise HTTPException(status_code=400, detail="Invalid image format or empty file payload")

    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        # Re-open for numpy operations after verify()
        img = Image.open(io.BytesIO(contents)).convert('L')
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image format or corrupt image file")

    arr = np.array(img, dtype=np.float64)
    height, width = arr.shape

    # 1. Brightness: mean pixel intensity (0-255)
    mean_val = float(np.mean(arr))
    brightness_score = round(min(100.0, max(0.0, (mean_val / 255.0) * 100.0)), 2)

    # 2. Contrast: std dev of pixel intensity
    std_val = float(np.std(arr))
    contrast_score = round(min(100.0, max(0.0, (std_val / 128.0) * 100.0)), 2)

    # 3. Sharpness / Clarity: gradient magnitude (Sobel-like difference)
    gy, gx = np.gradient(arr)
    gnorm = np.sqrt(gx**2 + gy**2)
    sharpness_val = float(np.mean(gnorm))
    sharpness_score = round(min(100.0, max(0.0, (sharpness_val / 20.0) * 100.0)), 2)

    overall_quality = round((brightness_score * 0.3) + (contrast_score * 0.3) + (sharpness_score * 0.4), 2)

    irregularities = []
    if brightness_score < 25.0:
        irregularities.append("LOW_LIGHTING: Image appears underexposed or dark.")
    elif brightness_score > 85.0:
        irregularities.append("OVEREXPOSURE: Image appears excessively bright.")
    if contrast_score < 20.0:
        irregularities.append("LOW_CONTRAST: Image details may be washed out.")
    if sharpness_score < 15.0:
        irregularities.append("BLURRY_IMAGE: Low sharpness detected; manual re-capture suggested.")

    return PhotoAssistResponse(
        status="SUCCESS",
        qualityMetrics=QualityMetrics(
            resolution={"width": width, "height": height},
            brightnessScore=brightness_score,
            contrastScore=contrast_score,
            sharpnessScore=sharpness_score,
            overallQualityScore=overall_quality
        ),
        semanticFields=SemanticFields(
            seal_intact="NOT_ASSESSED",
            model_plate_legible="MANUAL_REVIEW_REQUIRED",
            serial_number_match="NOT_ASSESSED",
            tampering_detected="NOT_ASSESSED"
        ),
        irregularities=irregularities,
        disclaimer=DISCLAIMER_TEXT
    )

# Phase 7 Lite: Predictive Analytics Endpoint
@app.post("/predictive-analysis", response_model=PredictiveAnalysisResponse)
def predictive_analysis(
    req: PredictiveAnalysisRequest,
    authorization: Optional[str] = Header(None)
):
    verify_token(authorization)

    history = req.history
    sample_count = len(history)

    if sample_count < 2:
        return PredictiveAnalysisResponse(
            status="INSUFFICIENT_DATA",
            trendDirection="INSUFFICIENT_DATA",
            slope=None,
            sampleCount=sample_count,
            evidence=["Fewer than 2 finalized inspection records exist for predictive trend analysis."],
            dataCoverage=round(sample_count / 5.0, 2),
            attentionRecommendation="Gather more finalized inspection history before executing predictive trend calculations.",
            disclaimer=DISCLAIMER_TEXT
        )

    # Extract deviations & outcomes
    deviations = [h.deviationPercentage for h in history if h.deviationPercentage is not None]

    if len(deviations) < 2:
        return PredictiveAnalysisResponse(
            status="INSUFFICIENT_DATA",
            trendDirection="INSUFFICIENT_DATA",
            slope=None,
            sampleCount=sample_count,
            evidence=["Fewer than 2 records contain valid numeric deviation percentages."],
            dataCoverage=round(len(deviations) / 5.0, 2),
            attentionRecommendation="Ensure reference readings and deviation measurements are recorded during inspections.",
            disclaimer=DISCLAIMER_TEXT
        )

    # Compute linear slope over sequential indices
    x = np.arange(len(deviations))
    y = np.array([abs(d) for d in deviations])

    # Linear fit: y = slope * x + intercept
    slope, intercept = np.polyfit(x, y, 1)
    slope = float(round(slope, 4))

    # Interpret slope:
    # Positive slope = deviation increasing over time = WORSENING
    # Negative slope = deviation decreasing over time = IMPROVING
    # Near zero = STABLE
    if slope > 0.05:
        trend_dir = "WORSENING"
        recommendation = "Schedule proactive verification ahead of standard interval due to rising absolute deviation."
    elif slope < -0.05:
        trend_dir = "IMPROVING"
        recommendation = "Maintain routine periodic verification schedule; deviation trend is stable to improving."
    else:
        trend_dir = "STABLE"
        recommendation = "Maintain standard verification frequency."

    mean_dev = float(round(np.mean(y), 4))
    evidence = [
        f"Analyzed {len(deviations)} chronological deviation records.",
        f"Deviation trend slope: {slope:+.4f}% per inspection cycle.",
        f"Mean absolute deviation: {mean_dev}%."
    ]

    return PredictiveAnalysisResponse(
        status="SUCCESS",
        trendDirection=trend_dir,
        slope=slope,
        sampleCount=sample_count,
        evidence=evidence,
        dataCoverage=min(1.0, round(len(deviations) / 5.0, 2)),
        attentionRecommendation=recommendation,
        disclaimer=DISCLAIMER_TEXT
    )
