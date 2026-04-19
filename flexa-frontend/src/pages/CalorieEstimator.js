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

const GOLD = "#D4AF37";

const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner", "snack"];

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
  const [mealType, setMealType] = useState("lunch");
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  // ── File selection ─────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG or PNG).");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setLogged(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  };

  // ── Analyse image ──────────────────────────────────────────────────────
  const handleAnalyse = async () => {
    if (!file) {
      toast.error("Please select a food image first.");
      return;
    }
    setLoading(true);
    setLogged(false);
    try {
      const formData = new FormData();
      formData.append("image", file);

      // Do NOT set Content-Type manually — axios auto-adds boundary for FormData
      const res = await api.post(
        `/diet/upload-meal-image?portion_g=${portionG}`,
        formData,
        { headers: { "Content-Type": undefined } },
      );
      setResult(res.data);
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
              background: "rgba(212,175,55,0.02)",
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
                disabled={logging || logged}
                style={{
                  width: "100%",
                  padding: "11px 20px",
                  background: logged ? "rgba(78,201,176,0.12)" : `${GOLD}22`,
                  border: `1px solid ${logged ? "#4ec9b0" : GOLD + "55"}`,
                  borderRadius: 10,
                  color: logged ? "#4ec9b0" : GOLD,
                  cursor: logged ? "default" : "pointer",
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
