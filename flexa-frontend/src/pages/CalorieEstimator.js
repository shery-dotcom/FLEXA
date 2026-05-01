import { useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FiCamera,
  FiUpload,
  FiCheckCircle,
  FiRefreshCw,
  FiPlusCircle,
  FiInfo,
} from "react-icons/fi";
import api from "../api/axios";
import FlexaGuide from "../components/FlexaGuide";

const GOLD = "#FF6B35";
const MAX_IMAGE_EDGE = 1280;
const JPEG_QUALITY = 0.9;

const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner", "snack"];

const isHeicLike = (f) => {
  const t = (f?.type || "").toLowerCase();
  const n = (f?.name || "").toLowerCase();
  return (
    t.includes("heic") ||
    t.includes("heif") ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  );
};

async function optimizeImageForInference(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image."));
      img.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(image.width, image.height),
    );
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob) return file;

    const safeName = (file.name || "meal").replace(/\.[^.]+$/, "");
    return new File([blob], `${safeName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─────────────────────────── Macro Tile ────────────────────────────────────
function MacroTile({ label, value, unit, color }) {
  return (
    <div
      style={{
        background: "#111",
        border: `1px solid ${color}22`,
        borderRadius: 12,
        padding: "14px 16px",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color }}>
        {value}
        {unit}
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────── Main Component ────────────────────────────────

export default function CalorieEstimator() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [portionG, setPortionG] = useState(150);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedPrediction, setSelectedPrediction] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  // ── File selection ─────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG or PNG).");
      return;
    }
    if (isHeicLike(f)) {
      toast.error(
        "HEIC/HEIF photos are not fully supported yet. Please upload JPG/PNG.",
      );
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB.");
      return;
    }

    try {
      const optimized = await optimizeImageForInference(f);
      setFile(optimized);
      setPreview(URL.createObjectURL(optimized));
    } catch {
      toast.error("Could not process this image. Try a clearer JPG/PNG photo.");
      return;
    }

    setResult(null);
    setSelectedPrediction("");
    setLogged(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  };

  // ── Analyse image ──────────────────────────────────────────────────────
  const handleAnalyse = async (confirmedFoodName = null) => {
    if (!file) {
      toast.error("Please select a food image first.");
      return;
    }
    setLoading(true);
    setLogged(false);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const confirmedFoodLabel =
        typeof confirmedFoodName === "string"
          ? confirmedFoodName
          : confirmedFoodName?.food_name || confirmedFoodName?.name || "";
      const confirmedParam = confirmedFoodName
        ? `&confirmed_food_name=${encodeURIComponent(confirmedFoodLabel)}`
        : "";

      // Do NOT set Content-Type manually — axios auto-adds boundary for FormData
      const res = await api.post(
        `/diet/upload-meal-image?portion_g=${portionG}${confirmedParam}`,
        formData,
        { headers: { "Content-Type": undefined } },
      );
      setResult(res.data);
      if (
        res.data?.requires_confirmation &&
        res.data?.top_predictions?.length
      ) {
        setSelectedPrediction(res.data.top_predictions[0].food_name || "");
      } else {
        setSelectedPrediction("");
      }
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
          "Analysis failed. Make sure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    setSelectedPrediction("");
    setLogged(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Log detected meal ──────────────────────────────────────────────────
  const handleLogMeal = async () => {
    if (!result) return;
    setLogging(true);
    try {
      await api.post("/diet/log-meal", {
        food_id: result.matched_food?.id || null,
        food_name: result.predicted_class,
        meal_type: mealType,
        quantity_g: portionG,
        notes: `AI estimated from image (portion: ${portionG}g)`,
      });
      setLogged(true);
      toast.success("Meal logged to your diary!");
    } catch {
      toast.error("Failed to log meal.");
    } finally {
      setLogging(false);
    }
  };

  const canLogMeal =
    !!result &&
    !result.requires_confirmation &&
    !result.low_confidence &&
    Number(result.estimated_calories || 0) > 0;

  // ──────────────────────────────────────── Render ───────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <FlexaGuide pageKey="calories" />
      <Toaster
        position="top-right"
        toastOptions={{ style: { background: "#1a1a1a", color: "#e0e0e0" } }}
      />

      <div
        style={{ maxWidth: 620, margin: "0 auto", padding: "40px 20px 80px" }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: GOLD,
              marginBottom: 6,
            }}
          >
            Calorie Estimator
          </h1>
          <p style={{ color: "#555", fontSize: 13 }}>
            Snap or upload a meal photo to estimate calories and macros quickly.
          </p>
        </div>

        {/* How it works */}
        <div
          style={{
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 28,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <FiInfo
            size={15}
            color={GOLD}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
            <strong style={{ color: "#888" }}>How it works:</strong> Upload a
            food image, set your portion size, and Flexa estimates calories and
            macros for your meal.
            <br />
            <em style={{ color: "#444" }}>
              Best results: clear lighting, one main dish in frame, and a front
              angle.
            </em>
          </div>
        </div>

        {/* Upload area */}
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${GOLD}44`,
              borderRadius: 16,
              padding: "60px 30px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 24,
              background: "rgba(255,107,53,0.02)",
              transition: "border-color .2s",
            }}
          >
            <FiCamera
              size={42}
              color={GOLD}
              style={{ opacity: 0.7, marginBottom: 14 }}
            />
            <div style={{ color: "#888", fontSize: 14 }}>
              Drag & drop a food photo here
            </div>
            <div style={{ color: "#444", fontSize: 12, marginTop: 4 }}>
              or click to browse
            </div>
            <div
              style={{
                marginTop: 16,
                display: "inline-block",
                background: `${GOLD}18`,
                border: `1px solid ${GOLD}44`,
                borderRadius: 8,
                padding: "8px 18px",
                color: GOLD,
                fontSize: 13,
              }}
            >
              <FiUpload size={13} style={{ marginRight: 6 }} /> Choose Image
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <img
              src={preview}
              alt="Food preview"
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: 14,
                border: "1px solid #222",
                background: "#0d0d0d",
              }}
            />
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Controls */}
        {file && (
          <div style={{ marginBottom: 20 }}>
            {/* Portion selector */}
            <label
              style={{
                fontSize: 12,
                color: "#888",
                display: "block",
                marginBottom: 6,
              }}
            >
              Estimated Portion Size:{" "}
              <strong style={{ color: GOLD }}>{portionG}g</strong>
            </label>
            <input
              type="range"
              min={50}
              max={800}
              step={10}
              value={portionG}
              onChange={(e) => setPortionG(Number(e.target.value))}
              style={{ width: "100%", accentColor: GOLD, marginBottom: 4 }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#444",
              }}
            >
              <span>50g (small)</span>
              <span>400g (large)</span>
              <span>800g (XL)</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {file && (
            <button
              onClick={handleReset}
              style={{
                padding: "12px 16px",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: 10,
                color: "#666",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiRefreshCw size={13} /> Reset
            </button>
          )}
          <button
            onClick={handleAnalyse}
            disabled={!file || loading}
            style={{
              flex: 1,
              padding: "13px 24px",
              background: file && !loading ? GOLD : "#1a1a1a",
              color: file && !loading ? "#000" : "#444",
              border: `1px solid ${file ? GOLD : "#333"}`,
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: file && !loading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid #00000044",
                    borderTopColor: "#000",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Analysing…
              </>
            ) : (
              <>
                <FiCamera size={16} /> Estimate Calories
              </>
            )}
          </button>
        </div>

        {/* ── Result ── */}
        {result && (
          <div
            style={{
              background: "#0d0d0d",
              border: `1px solid ${GOLD}33`,
              borderRadius: 16,
              padding: "24px 20px",
            }}
          >
            {!!result.message && (
              <div
                style={{
                  marginBottom: 14,
                  fontSize: 12,
                  color: result.requires_confirmation ? "#f6d98b" : "#8fcf9f",
                  background: result.requires_confirmation
                    ? "rgba(255,107,53,0.08)"
                    : "rgba(76,175,80,0.08)",
                  border: result.requires_confirmation
                    ? "1px solid rgba(255,107,53,0.28)"
                    : "1px solid rgba(76,175,80,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                {result.message}
              </div>
            )}

            {result.requires_confirmation &&
              Array.isArray(result.top_predictions) &&
              result.top_predictions.length > 0 && (
                <div
                  style={{
                    marginBottom: 16,
                    border: "1px solid rgba(255,107,53,0.2)",
                    borderRadius: 12,
                    padding: "12px 12px 10px",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                    Not sure about the detected food. Pick the closest option:
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    {result.top_predictions.map((p) => {
                      const active = selectedPrediction === p.food_name;
                      return (
                        <button
                          key={p.food_name}
                          onClick={() => setSelectedPrediction(p.food_name)}
                          style={{
                            padding: "7px 11px",
                            borderRadius: 18,
                            border: `1px solid ${active ? GOLD : "#2a2a2a"}`,
                            background: active ? `${GOLD}1f` : "#111",
                            color: active ? GOLD : "#a0a0a0",
                            fontSize: 12,
                            textTransform: "capitalize",
                            cursor: "pointer",
                          }}
                        >
                          {p.food_name.replace(/_/g, " ")} (
                          {Math.round((p.confidence || 0) * 100)}%)
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handleAnalyse(selectedPrediction)}
                    disabled={!selectedPrediction || loading}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${GOLD}`,
                      background: `${GOLD}22`,
                      color: GOLD,
                      fontWeight: 700,
                      cursor:
                        !selectedPrediction || loading
                          ? "not-allowed"
                          : "pointer",
                      opacity: !selectedPrediction || loading ? 0.55 : 1,
                    }}
                  >
                    Use Selected Option
                  </button>
                </div>
              )}

            {/* Predicted class */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Detected Food
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: GOLD,
                  textTransform: "capitalize",
                }}
              >
                {result.predicted_class.replace(/_/g, " ")}
              </div>
            </div>

            {/* Macros */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Nutritional Estimate ({result.portion_g}g portion)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <MacroTile
                  label="Calories"
                  value={Math.round(result.estimated_calories)}
                  unit=" kcal"
                  color={GOLD}
                />
                <MacroTile
                  label="Protein"
                  value={Math.round(result.estimated_protein_g)}
                  unit="g"
                  color="#4ec9b0"
                />
                <MacroTile
                  label="Carbs"
                  value={Math.round(result.estimated_carbs_g)}
                  unit="g"
                  color="#ce9178"
                />
                <MacroTile
                  label="Fat"
                  value={Math.round(result.estimated_fat_g)}
                  unit="g"
                  color="#dcdcaa"
                />
              </div>
            </div>

            {/* Log this meal */}
            <div
              style={{
                borderTop: "1px solid #1a1a1a",
                paddingTop: 16,
                marginTop: 8,
              }}
            >
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                Log this meal to your diary:
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                {MEAL_TYPE_OPTIONS.map((mt) => (
                  <button
                    key={mt}
                    onClick={() => setMealType(mt)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      background: mealType === mt ? `${GOLD}22` : "#111",
                      border: `1px solid ${mealType === mt ? GOLD : "#282828"}`,
                      color: mealType === mt ? GOLD : "#666",
                      cursor: "pointer",
                      fontSize: 12,
                      textTransform: "capitalize",
                    }}
                  >
                    {mt}
                  </button>
                ))}
              </div>
              <button
                onClick={handleLogMeal}
                disabled={logging || logged || !canLogMeal}
                style={{
                  width: "100%",
                  padding: "11px 20px",
                  background: logged
                    ? "rgba(78,201,176,0.12)"
                    : canLogMeal
                      ? `${GOLD}22`
                      : "#121212",
                  border: `1px solid ${logged ? "#4ec9b0" : canLogMeal ? GOLD + "55" : "#2a2a2a"}`,
                  borderRadius: 10,
                  color: logged ? "#4ec9b0" : canLogMeal ? GOLD : "#666",
                  cursor: logged || !canLogMeal ? "default" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {logged ? (
                  <>
                    <FiCheckCircle size={14} /> Logged to diary!
                  </>
                ) : logging ? (
                  "Logging…"
                ) : !canLogMeal ? (
                  "Choose a valid prediction first"
                ) : (
                  <>
                    <FiPlusCircle size={14} /> Add to {mealType} log
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tips section */}
        <div
          style={{
            marginTop: 32,
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              color: "#888",
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            📸 Tips for Better Results
          </div>
          {[
            "Use one food item per photo for highest accuracy.",
            "Good lighting and clear angles improve predictions.",
            "Adjust portion slider before estimating.",
            "If the prediction looks wrong, manually log using the Diet Planner search.",
            "AI is trained on Food-101 (101 classes) — international + Pakistani dishes map via DB.",
          ].map((tip, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: "#555",
                marginBottom: 5,
                paddingLeft: 10,
                borderLeft: "2px solid #1a1a1a",
              }}
            >
              {tip}
            </div>
          ))}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
