import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { apiCache } from "../utils/apiCache";

const FILTERS = [
  { value: "", label: "All" },
  { value: "nutritionist", label: "Nutrition" },
  { value: "fitness_trainer", label: "Fitness" },
];

const STATIC_LOCATION_LABEL = "G-13 Vostro World";
const ITEMS_PER_PAGE = 12;

export default function Marketplace() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [specialization, setSpecialization] = useState("");
  const [professionals, setProfessionals] = useState([]);
  const [filteredProfessionals, setFilteredProfessionals] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const handledPaymentRef = useRef(null);

  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const cacheKey = `professionals_${specialization}`;

      // Try to get from cache first
      let data = apiCache.get(cacheKey);

      if (!data) {
        // Cache miss, fetch from API
        const res = await api.get("/professionals/search", {
          params: specialization ? { specialization } : {},
        });
        data = res.data?.professionals || [];

        // Cache the results for 5 minutes
        apiCache.set(cacheKey, data, 300);
      }

      setProfessionals(data);
      setFilteredProfessionals(data);
      setCurrentPage(1);
    } catch (error) {
      toast.error("Could not load experts.");
      setProfessionals([]);
      setFilteredProfessionals([]);
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
      console.log("Fetching professional details for:", professionalId);
      const res = await api.get(`/professionals/${professionalId}`);
      console.log("Professional response:", res.data);

      if (res.data) {
        setSelectedProfessional(res.data);
        const firstSlotId = res.data?.available_slots?.[0]?.slot_id || "";
        setSelectedSlotId(firstSlotId);
        console.log("Selected professional with slots:", firstSlotId);
      }
    } catch (err) {
      console.error("Error loading professional:", err);
      console.error("Error details:", err.response?.data || err.message);
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
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
            Book trusted professionals for personalized guidance.
          </p>
          {confirmingPayment && (
            <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 6 }}>
              Finalizing your Stripe payment...
            </p>
          )}
        </div>

        <div className="marketplace-filter-block" style={{ minWidth: 220 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--text-tertiary)",
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
              background: "var(--card-bg)",
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
            color: "var(--text-tertiary)",
          }}
        >
          No professionals available right now.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: "#888" }}>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, professionals.length)} of{" "}
            {professionals.length} experts
          </div>
          <div
            className="marketplace-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {professionals
              .slice(
                (currentPage - 1) * ITEMS_PER_PAGE,
                currentPage * ITEMS_PER_PAGE,
              )
              .map((p) => {
                const profName = p.user?.username || p.name || "Professional";
                const initials = profName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();
                return (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid rgba(255,107,53,0.3)",
                      background:
                        "linear-gradient(135deg, rgba(26,26,46,0.8) 0%, rgba(15,15,15,0.9) 100%)",
                      borderRadius: 14,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      minHeight: 380,
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                      "&:hover": {
                        transform: "translateY(-4px)",
                      },
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 24px rgba(255,107,53,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(255,107,53,0.3)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 16px rgba(0,0,0,0.3)";
                    }}
                  >
                    {/* Avatar & Header */}
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, var(--accent), #ffc857)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#000",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            margin: 0,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {profName}
                        </h3>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--macro-protein)",
                            margin: "4px 0 0",
                            fontWeight: 600,
                          }}
                        >
                          {formatSpecialization(p.specialization)}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#888",
                            margin: "2px 0 0",
                          }}
                        >
                          📍 {p.location || "Multiple locations"}
                        </p>
                      </div>
                    </div>

                    {/* Rating & Experience */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(255,107,53,0.1)",
                          padding: "8px 10px",
                          borderRadius: 8,
                          textAlign: "center",
                          border: "1px solid rgba(255,107,53,0.2)",
                        }}
                      >
                        <div style={{ color: "#888", fontSize: 10 }}>
                          Rating
                        </div>
                        <div style={{ color: "#ffc857", fontWeight: 700 }}>
                          ⭐ {p.average_rating ?? "-"}/5
                        </div>
                      </div>
                      <div
                        style={{
                          background: "rgba(78,201,176,0.1)",
                          padding: "8px 10px",
                          borderRadius: 8,
                          textAlign: "center",
                          border: "1px solid rgba(78,201,176,0.2)",
                        }}
                      >
                        <div style={{ color: "#888", fontSize: 10 }}>
                          Experience
                        </div>
                        <div style={{ color: "var(--macro-protein)", fontWeight: 700 }}>
                          {p.years_experience ?? 0}+ years
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        paddingTop: 10,
                      }}
                    >
                      <p
                        style={{
                          color: "#c8c8c8",
                          fontSize: 13,
                          margin: 0,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {p.bio || "Professional fitness and wellness expert"}
                      </p>
                    </div>

                    {/* Stats */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          background: "#121925",
                          padding: "8px",
                          borderRadius: 6,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ color: "#888", fontSize: 9 }}>
                          Reviews
                        </div>
                        <div style={{ color: "#fff", fontWeight: 600 }}>
                          {p.total_reviews ?? 0}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#121925",
                          padding: "8px",
                          borderRadius: 6,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ color: "#888", fontSize: 9 }}>
                          Sessions
                        </div>
                        <div style={{ color: "#fff", fontWeight: 600 }}>
                          {p.total_sessions_completed ?? 0}+
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#121925",
                          padding: "8px",
                          borderRadius: 6,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ color: "#888", fontSize: 9 }}>Price</div>
                        <div style={{ color: "#ffc857", fontWeight: 700 }}>
                          ${p.consultation_price_usd}
                        </div>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => openProfessional(p.id)}
                      style={{
                        marginTop: "auto",
                        background: "linear-gradient(135deg, var(--accent), #ffc857)",
                        border: "none",
                        color: "#000",
                        borderRadius: 10,
                        padding: "12px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 14,
                        transition: "all 0.2s ease",
                        width: "100%",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      📋 View Profile & Book
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Pagination Controls */}
          {professionals.length > ITEMS_PER_PAGE && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "8px 12px",
                  background: currentPage === 1 ? "#333" : "var(--accent)",
                  color: currentPage === 1 ? "#666" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: currentPage === 1 ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                ← Previous
              </button>

              <div style={{ display: "flex", gap: 4 }}>
                {Array.from(
                  { length: Math.ceil(professionals.length / ITEMS_PER_PAGE) },
                  (_, i) => i + 1,
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: "none",
                      background:
                        page === currentPage
                          ? "linear-gradient(135deg, var(--accent), #ffc857)"
                          : "rgba(255,107,53,0.1)",
                      color: page === currentPage ? "#000" : "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (page !== currentPage) {
                        e.target.style.background = "rgba(255,107,53,0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page !== currentPage) {
                        e.target.style.background = "rgba(255,107,53,0.1)";
                      }
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(
                      Math.ceil(professionals.length / ITEMS_PER_PAGE),
                      p + 1,
                    ),
                  )
                }
                disabled={
                  currentPage >=
                  Math.ceil(professionals.length / ITEMS_PER_PAGE)
                }
                style={{
                  padding: "8px 12px",
                  background:
                    currentPage >=
                    Math.ceil(professionals.length / ITEMS_PER_PAGE)
                      ? "#333"
                      : "var(--accent)",
                  color:
                    currentPage >=
                    Math.ceil(professionals.length / ITEMS_PER_PAGE)
                      ? "#666"
                      : "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor:
                    currentPage >=
                    Math.ceil(professionals.length / ITEMS_PER_PAGE)
                      ? "default"
                      : "pointer",
                  fontWeight: 600,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
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
                    <h2 style={{ margin: 0, fontSize: 26, color: "#fff" }}>
                      {selectedProfessional.user?.username ||
                        selectedProfessional.name ||
                        "Professional"}
                    </h2>
                    <p
                      style={{
                        marginTop: 6,
                        color: "var(--macro-protein)",
                        fontSize: 14,
                        fontWeight: 600,
                        margin: 0,
                      }}
                    >
                      {formatSpecialization(
                        selectedProfessional.specialization,
                      )}
                    </p>
                    <p style={{ marginTop: 4, color: "#aab6ca", fontSize: 12 }}>
                      {selectedProfessional.years_experience} years experience |{" "}
                      {selectedProfessional.total_sessions_completed ?? 0}+
                      sessions
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
                  <InfoItem
                    label="Location"
                    value={selectedProfessional.location || "-"}
                  />
                </div>

                <Section title="Track Record">
                  <div style={styles.metaGrid}>
                    <InfoItem
                      label="Reviews"
                      value={`${selectedProfessional.total_reviews ?? 0} clients`}
                    />
                    <InfoItem
                      label="Sessions Completed"
                      value={`${selectedProfessional.total_sessions_completed ?? 0}+`}
                    />
                    <InfoItem
                      label="Experience"
                      value={`${selectedProfessional.years_experience ?? 0} years`}
                    />
                  </div>
                </Section>

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

                <Section title="Location">
                  <Badge label={`Location: ${STATIC_LOCATION_LABEL}`} />
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
                    <p style={{ color: "var(--text-tertiary)", margin: 0 }}>
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
                    style={{
                      ...styles.actionButton,
                      ...styles.bookButton,
                      background: booking
                        ? "#555"
                        : "linear-gradient(135deg, var(--accent), #ffc857)",
                      color: booking ? "#ccc" : "#000",
                    }}
                  >
                    {booking ? "Booking..." : "💰 Book Session"}
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
    width: "min(800px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 20,
    border: "1px solid rgba(255,107,53,0.2)",
    background:
      "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(13,19,31,0.95) 100%)",
    padding: 28,
    boxShadow: "0 20px 60px rgba(255,107,53,0.1)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(255,107,53,0.15)",
  },
  closeButton: {
    border: "1px solid rgba(255,107,53,0.3)",
    borderRadius: 10,
    background: "rgba(255,107,53,0.1)",
    color: "#ffc857",
    cursor: "pointer",
    padding: "8px 16px",
    fontWeight: 600,
    fontSize: 13,
    transition: "all 0.2s ease",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  chipsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    width: "100%",
    background: "rgba(13,21,36,0.6)",
    color: "#e2e8f5",
    border: "1px solid rgba(255,107,53,0.2)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 13,
    fontFamily: "inherit",
  },
  actionRow: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    borderRadius: 12,
    padding: "12px 20px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s ease",
    flex: 1,
    minWidth: 200,
  },
  bookButton: {
    border: "none",
    background: "linear-gradient(135deg, var(--accent), #ffc857)",
    color: "#000",
  },
};

