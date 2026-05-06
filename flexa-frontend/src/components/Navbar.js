import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiLogOut,
  FiActivity,
  FiGrid,
  FiTrendingUp,
  FiMenu,
  FiX,
  FiUser,
  FiEdit2,
  FiBookOpen,
  FiCamera,
  FiVideo,
  FiBriefcase,
} from "react-icons/fi";
import { TbRobot } from "react-icons/tb";
import FlexaVideoIntro from "./FlexaVideoIntro";

const NAV_LINKS = [
  { to: "/dashboard", label: "Home", icon: <FiGrid /> },
  { to: "/workouts", label: "Workout", icon: <FiActivity /> },
  { to: "/diet-planner", label: "Diet", icon: <FiBookOpen /> },
  { to: "/calorie-estimator", label: "Calories", icon: <FiCamera /> },
  { to: "/posture-tracker", label: "Posture", icon: <FiVideo /> },
  { to: "/chatbot", label: "FLEXA", icon: <TbRobot /> },
  { to: "/progress", label: "Report", icon: <FiTrendingUp /> },
  { to: "/marketplace", label: "Experts", icon: <FiBriefcase /> },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [showFLEXAIntro, setShowFLEXAIntro] = useState(false);
  const avatarRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  const handleFLEXAClick = (e) => {
    e.preventDefault();
    closeMenu();
    if (!localStorage.getItem("flexa_video_intro_done")) {
      setShowFLEXAIntro(true);
    } else {
      navigate("/chatbot");
    }
  };

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const profilePicture = user?.profile?.profile_picture;
  const displayName =
    user?.profile?.username || user?.email?.split("@")[0] || "User";

  const AvatarCircle = ({ size = 36 }) =>
    profilePicture ? (
      <img
        src={profilePicture}
        alt={displayName}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "3px solid var(--accent)",
          display: "block",
          boxShadow: "0 0 10px rgba(255,107,53,0.3)",
        }}
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(255,107,53,0.15)",
          border: "2px solid var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 10px rgba(255,107,53,0.2)",
        }}
      >
        <FiUser size={Math.floor(size * 0.45)} color="var(--accent)" />
      </div>
    );

  return (
    <>
      <nav style={styles.nav}>
        <div style={styles.inner}>
          {/* Logo */}
          <Link to="/dashboard" style={styles.logo} onClick={closeMenu}>
            FLEXA
          </Link>

          {/* Desktop Links */}
          <div style={styles.links} className="nav-desktop-links">
            {NAV_LINKS.map(({ to, label, icon }) =>
              to === "/chatbot" ? (
                <button
                  key={to}
                  onClick={handleFLEXAClick}
                  style={{
                    ...styles.link,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    ...(location.pathname === to ? styles.activeLink : {}),
                  }}
                >
                  {icon} {label}
                </button>
              ) : (
                <Link
                  key={to}
                  to={to}
                  style={{
                    ...styles.link,
                    ...(location.pathname === to ? styles.activeLink : {}),
                  }}
                >
                  {icon} {label}
                </Link>
              ),
            )}
          </div>

          {/* Right side – avatar dropdown */}
          <div style={styles.right}>
            <div
              ref={avatarRef}
              style={{ position: "relative" }}
              className="nav-email-desktop"
            >
              <button
                onClick={() => setAvatarOpen((o) => !o)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 30,
                }}
                title={displayName}
              >
                <AvatarCircle size={34} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </span>
              </button>

              {avatarOpen && (
                <div style={styles.avatarDropdown}>
                  <div style={styles.avatarDropdownHeader}>
                    <AvatarCircle size={42} />
                    <div>
                      <p
                        style={{
                          color: "var(--accent)",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {displayName}
                      </p>
                      <p style={{ color: "#616161", fontSize: 12 }}>
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <div style={styles.avatarDropdownDivider} />
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      navigate("/profile");
                    }}
                    style={styles.avatarDropdownItem}
                  >
                    <FiEdit2 size={14} /> Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{ ...styles.avatarDropdownItem, color: "#ef5350" }}
                  >
                    <FiLogOut size={14} /> Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={styles.hamburger}
              className="nav-hamburger"
              aria-label="Toggle menu"
            >
              {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div style={styles.drawer} className="nav-drawer">
          <div style={styles.drawerUser}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AvatarCircle size={42} />
              <div>
                <p
                  style={{
                    color: "var(--accent)",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {displayName}
                </p>
                <p style={{ color: "#616161", fontSize: 12 }}>{user?.email}</p>
              </div>
            </div>
          </div>
          <div style={styles.drawerDivider} />
          {NAV_LINKS.map(({ to, label, icon }) =>
            to === "/chatbot" ? (
              <button
                key={to}
                onClick={handleFLEXAClick}
                style={{
                  ...styles.drawerLink,
                  background: "none",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  ...(location.pathname === to ? styles.drawerLinkActive : {}),
                }}
              >
                <span style={{ opacity: 0.7 }}>{icon}</span>
                {label}
              </button>
            ) : (
              <Link
                key={to}
                to={to}
                onClick={closeMenu}
                style={{
                  ...styles.drawerLink,
                  ...(location.pathname === to ? styles.drawerLinkActive : {}),
                }}
              >
                <span style={{ opacity: 0.7 }}>{icon}</span>
                {label}
              </Link>
            ),
          )}
          <Link
            to="/profile"
            onClick={closeMenu}
            style={{
              ...styles.drawerLink,
              ...(location.pathname === "/profile"
                ? styles.drawerLinkActive
                : {}),
            }}
          >
            <span style={{ opacity: 0.7 }}>
              <FiEdit2 />
            </span>
            Edit Profile
          </Link>
          <div style={styles.drawerDivider} />
          <button onClick={handleLogout} style={styles.drawerLogout}>
            <FiLogOut size={16} /> Sign Out
          </button>
        </div>
      )}

      {/* Backdrop */}
      {menuOpen && <div style={styles.backdrop} onClick={closeMenu} />}

      {/* FLEXA intro video — shown first time FLEXA nav link is clicked */}
      <FlexaVideoIntro
        show={showFLEXAIntro}
        onClose={() => {
          setShowFLEXAIntro(false);
          navigate("/chatbot");
        }}
      />
    </>
  );
}

const styles = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 200,
    background: "var(--nav-bg)",
    borderBottom: "1px solid var(--nav-border)",
    backdropFilter: "blur(12px)",
    boxShadow: "var(--card-shadow)",
    transition: "all 0.3s ease",
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 26,
    letterSpacing: 4,
    color: "var(--accent)",
    textDecoration: "none",
    flexShrink: 0,
    transition: "color 0.3s ease",
  },
  links: { display: "flex", alignItems: "center", gap: 4 },
  link: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 16px",
    borderRadius: 20,
    color: "var(--nav-text)",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    border: "1px solid transparent",
    transition: "all 0.22s ease",
    whiteSpace: "nowrap",
    opacity: 0.8,
  },
  activeLink: {
    color: "var(--text-primary)",
    background: "var(--btn-hover)",
    border: "1px solid var(--accent)",
    fontWeight: 700,
    opacity: 1,
  },
  right: { display: "flex", alignItems: "center", gap: 12 },
  hamburger: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--accent)",
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarDropdown: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    minWidth: 220,
    background: "var(--card-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 12,
    boxShadow: "var(--card-shadow)",
    zIndex: 300,
    overflow: "hidden",
    transition: "all 0.3s ease",
  },
  avatarDropdownHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px 12px",
    borderBottom: "1px solid var(--border-light)",
  },
  avatarDropdownDivider: {
    height: 1,
    background: "var(--border-color)",
    margin: "0 0 4px",
  },
  avatarDropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
  },
  drawer: {
    position: "fixed",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 199,
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--nav-border)",
    display: "flex",
    flexDirection: "column",
    padding: "12px 0",
  },
  drawerUser: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 20px 16px",
  },
  drawerDivider: {
    height: 1,
    background: "var(--border-color)",
    margin: "4px 0",
  },
  drawerLink: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 20px",
    color: "var(--text-secondary)",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 500,
    transition: "all 0.2s ease",
  },
  drawerLinkActive: {
    color: "var(--text-primary)",
    background: "var(--btn-hover)",
    borderLeft: "3px solid var(--accent)",
  },
  drawerLogout: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 20px",
    background: "none",
    border: "none",
    color: "var(--status-error)",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s ease",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 198,
    background: "rgba(0,0,0,0.5)",
  },
};
