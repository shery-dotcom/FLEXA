import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";

const FILTERS = [
  { value: "", label: "All" },
  { value: "nutritionist", label: "Nutrition" },
  { value: "fitness_trainer", label: "Fitness" },
  { value: "both", label: "Both" },
];

export default function Marketplace() {
  const [loading, setLoading] = useState(true);
  const [specialization, setSpecialization] = useState("");
  const [professionals, setProfessionals] = useState([]);

  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/professionals/search", {
        params: specialization ? { specialization } : {},
      });
      setProfessionals(res.data?.professionals || []);
    } catch {
      toast.error("Could not load experts.");
      setProfessionals([]);
    } finally {
      setLoading(false);
    }
  }, [specialization]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  const heading = useMemo(() => {
    if (!specialization) return "Professionals Marketplace";
    if (specialization === "nutritionist") return "Nutrition Experts";
    if (specialization === "fitness_trainer") return "Fitness Coaches";
    return "Nutrition + Fitness Experts";
  }, [specialization]);

  return (
    <div
      style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 40px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            {heading}
          </h1>
          <p style={{ color: "#9e9e9e", fontSize: 14 }}>
            Book trusted professionals for personalized guidance.
          </p>
        </div>

        <div style={{ minWidth: 220 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#9e9e9e",
              marginBottom: 6,
            }}
          >
            Category
          </label>
          <select
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            style={{
              width: "100%",
              background: "#111",
              color: "#d7d7d7",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-center" style={{ minHeight: 220 }}>
          <div className="spinner" />
        </div>
      ) : professionals.length === 0 ? (
        <div
          style={{
            border: "1px solid #242424",
            borderRadius: 14,
            padding: 24,
            color: "#9e9e9e",
          }}
        >
          No professionals available right now.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {professionals.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #242424",
                background: "#0f0f0f",
                borderRadius: 14,
                padding: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{p.name}</h3>
                <span style={{ color: "#D4AF37", fontWeight: 700 }}>
                  ${p.consultation_price_usd}
                </span>
              </div>
              <p style={{ color: "#bdbdbd", fontSize: 13 }}>{p.bio}</p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: 12,
                }}
              >
                <Badge label={formatSpecialization(p.specialization)} />
                <Badge label={`Rating: ${p.average_rating ?? "-"}`} />
                <Badge label={`${p.total_sessions_completed ?? 0} sessions`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ label }) {
  return (
    <span
      style={{
        border: "1px solid #2a2a2a",
        borderRadius: 999,
        padding: "4px 9px",
        color: "#d0d0d0",
      }}
    >
      {label}
    </span>
  );
}

function formatSpecialization(value) {
  if (value === "fitness_trainer") return "Fitness";
  if (value === "nutritionist") return "Nutrition";
  if (value === "both") return "Nutrition + Fitness";
  return value || "General";
}
