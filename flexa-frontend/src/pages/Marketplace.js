import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";

const FILTERS = [
  { value: "", label: "All" },
  { value: "nutritionist", label: "Nutrition" },
  { value: "fitness_trainer", label: "Fitness" },
  { value: "both", label: "Both" },
];

export default function Marketplace() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [specialization, setSpecialization] = useState("");
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const handledPaymentRef = useRef(null);

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (
      payment !== "success" ||
      !sessionId ||
      handledPaymentRef.current === sessionId
    ) {
      return;
    }

    handledPaymentRef.current = sessionId;

    (async () => {
      setConfirmingPayment(true);
      try {
        await api.post(`/professionals/${sessionId}/confirm-payment`, {});
        toast.success("Stripe payment completed and booking confirmed.");
        window.history.replaceState({}, "", "/marketplace");
        fetchProfessionals();
      } catch (err) {
        toast.error(
          err?.response?.data?.detail ||
            "Payment was received but confirmation failed.",
        );
      } finally {
        setConfirmingPayment(false);
      }
    })();
  }, [fetchProfessionals, location.search]);

  const openProfessional = useCallback(async (professionalId) => {
    setDetailLoading(true);
    setSelectedProfessional(null);
    setSelectedSlotId("");
    setBookingNotes("");
    try {
      const res = await api.get(`/professionals/${professionalId}`);
      setSelectedProfessional(res.data || null);
      const firstSlotId = res.data?.available_slots?.[0]?.slot_id || "";
      setSelectedSlotId(firstSlotId);
    } catch {
      toast.error("Could not load expert details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleBook = useCallback(async () => {
    if (!selectedProfessional?.id) return;
    if (!selectedSlotId) {
      toast.error("Please choose an available time slot first.");
      return;
    }

    const specializationType = mapSpecializationToSessionType(
      selectedProfessional.specialization,
    );

    setBooking(true);
    try {
      const res = await api.post(
        `/professionals/${selectedProfessional.id}/book`,
        {
          specialization_type: specializationType,
          notes: bookingNotes || undefined,
        },
        {
          params: { slot_id: selectedSlotId },
        },
      );

      if (res.data?.demo_mode) {
        toast("Stripe demo mode: showing presentation checkout flow.");
      }

      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
        return;
      }

      toast.success(
        `Booking created. Price: $${res.data?.price_usd ?? "-"}. Complete payment to confirm.`,
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create booking.");
    } finally {
      setBooking(false);
    }
  }, [bookingNotes, selectedProfessional, selectedSlotId]);

  const heading = useMemo(() => {
    if (!specialization) return "Professionals Marketplace";
    if (specialization === "nutritionist") return "Nutrition Experts";
    if (specialization === "fitness_trainer") return "Fitness Coaches";
    return "Nutrition + Fitness Experts";
  }, [specialization]);

  return (
    <div
      className="marketplace-page-wrap"
      style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 40px" }}
    >
      <div
        className="marketplace-toolbar"
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
          {confirmingPayment && (
            <p style={{ color: "#D4AF37", fontSize: 13, marginTop: 6 }}>
              Finalizing your Stripe payment...
            </p>
          )}
        </div>

        <div className="marketplace-filter-block" style={{ minWidth: 220 }}>
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
          className="marketplace-grid"
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
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 250,
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
              <p
                style={{
                  color: "#bdbdbd",
                  fontSize: 13,
                  margin: 0,
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 56,
                }}
              >
                {p.bio}
              </p>
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
              <button
                onClick={() => openProfessional(p.id)}
                style={{
                  marginTop: "auto",
                  background: "linear-gradient(135deg, #8a6a1f, #3b5b7d)",
                  border: "1px solid rgba(212,175,55,0.45)",
                  color: "#f7f1df",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {(detailLoading || selectedProfessional) && (
        <div
          style={styles.backdrop}
          onClick={() => setSelectedProfessional(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="loading-center" style={{ minHeight: 200 }}>
                <div className="spinner" />
              </div>
            ) : (
              <>
                <div style={styles.modalHeader}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>
                      {selectedProfessional.name}
                    </h2>
                    <p style={{ marginTop: 6, color: "#aab6ca", fontSize: 13 }}>
                      {formatSpecialization(
                        selectedProfessional.specialization,
                      )}{" "}
                      | {selectedProfessional.years_experience} years experience
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProfessional(null)}
                    style={styles.closeButton}
                  >
                    Close
                  </button>
                </div>

                <p style={{ color: "#d9dfeb", lineHeight: 1.6 }}>
                  {selectedProfessional.bio}
                </p>

                <div style={styles.metaGrid}>
                  <InfoItem
                    label="Price"
                    value={`$${selectedProfessional.consultation_price_usd}`}
                  />
                  <InfoItem
                    label="Session"
                    value={`${selectedProfessional.consultation_duration_mins} mins`}
                  />
                  <InfoItem
                    label="Rating"
                    value={selectedProfessional.average_rating ?? "-"}
                  />
                  <InfoItem
                    label="Timezone"
                    value={selectedProfessional.timezone || "-"}
                  />
                </div>

                <Section title="Certifications">
                  <div style={styles.chipsWrap}>
                    {(selectedProfessional.certifications || []).map((cert) => (
                      <Badge key={cert} label={cert} />
                    ))}
                  </div>
                </Section>

                <Section title="Languages">
                  <div style={styles.chipsWrap}>
                    {(selectedProfessional.languages || []).map((lang) => (
                      <Badge key={lang} label={lang} />
                    ))}
                  </div>
                </Section>

                <Section title="Available Slots">
                  {selectedProfessional.available_slots?.length ? (
                    <select
                      value={selectedSlotId}
                      onChange={(e) => setSelectedSlotId(e.target.value)}
                      style={styles.input}
                    >
                      {selectedProfessional.available_slots.map((slot) => (
                        <option key={slot.slot_id} value={slot.slot_id}>
                          {new Date(slot.start_time).toLocaleString()} -{" "}
                          {new Date(slot.end_time).toLocaleTimeString()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: "#9e9e9e", margin: 0 }}>
                      No slots currently available.
                    </p>
                  )}
                </Section>

                <Section title="Message for Expert (optional)">
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Share your goals, concerns, or what you want help with"
                    rows={3}
                    style={{ ...styles.input, resize: "vertical" }}
                  />
                </Section>

                <div style={styles.actionRow}>
                  <button
                    onClick={handleBook}
                    disabled={
                      booking || !selectedProfessional.available_slots?.length
                    }
                    style={{ ...styles.actionButton, ...styles.bookButton }}
                  >
                    {booking ? "Booking..." : "Book Session"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 8px", color: "#f7f1df" }}>{title}</h4>
      {children}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #283141",
        background: "#121925",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#93a3bc", fontSize: 12 }}>{label}</div>
      <div style={{ color: "#e9edf5", fontWeight: 700, marginTop: 3 }}>
        {value}
      </div>
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

function mapSpecializationToSessionType(value) {
  if (value === "nutritionist") return "nutrition";
  if (value === "fitness_trainer") return "fitness_training";
  if (value === "both") return "both";
  return "both";
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: "rgba(3,8,14,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "min(760px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 16,
    border: "1px solid #314158",
    background: "linear-gradient(180deg, #111827 0%, #0d131f 100%)",
    padding: 20,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  closeButton: {
    border: "1px solid #3f4f69",
    borderRadius: 8,
    background: "#151f31",
    color: "#dbe4f2",
    cursor: "pointer",
    padding: "8px 12px",
    fontWeight: 600,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  chipsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    width: "100%",
    background: "#0d1524",
    color: "#e2e8f5",
    border: "1px solid #2c3b52",
    borderRadius: 10,
    padding: "10px 12px",
  },
  actionRow: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  actionButton: {
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  bookButton: {
    border: "1px solid rgba(212,175,55,0.45)",
    background: "linear-gradient(135deg, #8a6a1f, #3b5b7d)",
    color: "#f7f1df",
  },
};
