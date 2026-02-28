import { useState, useEffect } from "react";
import { FiBarChart2 } from "react-icons/fi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import api from "../api/axios";
import toast from "react-hot-toast";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #D4AF37",
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <p style={{ color: "#9e9e9e", fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p
          key={p.name}
          style={{ color: p.color, fontSize: 14, fontWeight: 600 }}
        >
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Progress() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().split("T")[0],
    weight_kg: "",
    body_fat_pct: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, summaryRes] = await Promise.all([
        api.get("/progress/logs?limit=60"),
        api.get("/progress/summary/weekly"),
      ]);
      const sortedLogs = logsRes.data.sort(
        (a, b) => new Date(a.log_date) - new Date(b.log_date),
      );
      setLogs(sortedLogs);
      setSummary(summaryRes.data);
    } catch {
      /* ok */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/progress/log", {
        ...form,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
        body_fat_pct: form.body_fat_pct
          ? parseFloat(form.body_fat_pct)
          : undefined,
      });
      toast.success("Progress logged!");
      setForm({
        log_date: new Date().toISOString().split("T")[0],
        weight_kg: "",
        body_fat_pct: "",
        notes: "",
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to log progress.");
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = logs.map((l) => ({
    date: new Date(l.log_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    Weight: l.weight_kg,
    BMI: l.bmi,
  }));

  return (
    <div className="page-content">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>
          Progress <span className="text-gold">Tracker</span>
        </h1>
        <p style={{ color: "#9e9e9e", marginTop: 6, fontSize: 14 }}>
          Track your weight, BMI, and body composition over time
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: "start", gap: 28 }}>
        {/* Left: Log form + Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Log form */}
          <div className="card-gold-border">
            <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>
              Log Today's Stats
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-input"
                  type="date"
                  name="log_date"
                  value={form.log_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid-2 progress-form-grid">
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    className="form-input"
                    type="number"
                    name="weight_kg"
                    placeholder="75.5"
                    step="0.1"
                    value={form.weight_kg}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Body Fat %</label>
                  <input
                    className="form-input"
                    type="number"
                    name="body_fat_pct"
                    placeholder="18.5"
                    step="0.1"
                    value={form.body_fat_pct}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input
                  className="form-input"
                  name="notes"
                  placeholder="Feeling great today!"
                  value={form.notes}
                  onChange={handleChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ width: "100%" }}
                disabled={submitting}
              >
                {submitting ? "Logging..." : "+ Log Progress"}
              </button>
            </form>
          </div>

          {/* Weekly summary */}
          {summary && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
                Weekly Summary
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {summary.weight_change !== undefined && (
                  <SummaryRow
                    label="Weight Change"
                    value={`${summary.weight_change > 0 ? "+" : ""}${summary.weight_change?.toFixed(1)} kg`}
                    color={summary.weight_change < 0 ? "#4caf50" : "#ef5350"}
                  />
                )}
                {summary.current_weight && (
                  <SummaryRow
                    label="Current Weight"
                    value={`${summary.current_weight} kg`}
                  />
                )}
                {summary.current_bmi && (
                  <SummaryRow label="Current BMI" value={summary.current_bmi} />
                )}
                <SummaryRow
                  label="Logs This Week"
                  value={summary.logs_count || 0}
                />
                {summary.trend && (
                  <SummaryRow
                    label="Trend"
                    value={summary.trend
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                    color={summary.trend === "on_track" ? "#4caf50" : "#D4AF37"}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 60 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <FiBarChart2 size={60} color="#9e9e9e" />
              </div>
              <h3 style={{ marginTop: 16, marginBottom: 8 }}>No Data Yet</h3>
              <p style={{ color: "#9e9e9e", fontSize: 14 }}>
                Start logging your weight to see beautiful charts.
              </p>
            </div>
          ) : (
            <>
              {/* Weight chart */}
              <div className="card">
                <h4 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
                  Weight Over Time (kg)
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#D4AF37"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#D4AF37"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      stroke="#616161"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#616161"
                      tick={{ fontSize: 11 }}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Weight"
                      stroke="#D4AF37"
                      fill="url(#goldGrad)"
                      strokeWidth={2}
                      dot={{ fill: "#D4AF37", r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* BMI chart */}
              {chartData.some((d) => d.BMI) && (
                <div className="card">
                  <h4
                    style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}
                  >
                    BMI Progress
                  </h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="date"
                        stroke="#616161"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke="#616161"
                        tick={{ fontSize: 11 }}
                        domain={["dataMin - 1", "dataMax + 1"]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {/* Normal BMI reference */}
                      <Line
                        type="monotone"
                        dataKey="BMI"
                        stroke="#A08C29"
                        strokeWidth={2}
                        dot={{ fill: "#D4AF37", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                    <BMIRef color="#4caf50" label="Normal: 18.5–24.9" />
                    <BMIRef color="#ff9800" label="Overweight: 25–29.9" />
                    <BMIRef color="#ef5350" label="Obese: ≥30" />
                  </div>
                </div>
              )}

              {/* Log table */}
              <div className="card">
                <h4 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
                  Recent Logs
                </h4>
                <div className="table-scroll" style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #242424" }}>
                        {[
                          "Date",
                          "Weight (kg)",
                          "BMI",
                          "Body Fat %",
                          "Notes",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 12px",
                              color: "#9e9e9e",
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...logs]
                        .reverse()
                        .slice(0, 10)
                        .map((l) => (
                          <tr
                            key={l.id}
                            style={{ borderBottom: "1px solid #1a1a1a" }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "#D4AF37",
                                fontWeight: 500,
                              }}
                            >
                              {new Date(l.log_date).toLocaleDateString()}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {l.weight_kg ?? "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {l.bmi?.toFixed(1) ?? "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {l.body_fat_pct ?? "—"}
                            </td>
                            <td
                              style={{ padding: "10px 12px", color: "#9e9e9e" }}
                            >
                              {l.notes || "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <span style={{ fontSize: 13, color: "#9e9e9e" }}>{label}</span>
      <span
        style={{ fontSize: 13, fontWeight: 700, color: color || "#e0e0e0" }}
      >
        {value}
      </span>
    </div>
  );
}

function BMIRef({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{ width: 10, height: 10, borderRadius: 2, background: color }}
      />
      <span style={{ fontSize: 11, color: "#9e9e9e" }}>{label}</span>
    </div>
  );
}
