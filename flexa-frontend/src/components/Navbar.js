import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiLogOut,
  FiActivity,
  FiGrid,
  FiTrendingUp,
  FiTarget,
  FiMenu,
  FiX,
  FiUser,
} from "react-icons/fi";

const NAV_LINKS = [
  { to: "/dashboard", label: "Home", icon: <FiGrid /> },
  { to: "/progress", label: "Report", icon: <FiTrendingUp /> },
  { to: "/workouts", label: "Workout", icon: <FiActivity /> },
  { to: "/goal-setup", label: "Goals", icon: <FiTarget /> },
];

const MOBILE_EXTRA = [{ to: "/profile", label: "Profile", icon: <FiUser /> }];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

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
            {NAV_LINKS.map(({ to, label, icon }) => (
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
            ))}
          </div>

          {/* Right side */}
          <div style={styles.right}>
            <Link
              to="/profile"
              className="nav-email-desktop"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 8,
                background:
                  location.pathname === "/profile"
                    ? "rgba(212,175,55,0.12)"
                    : "transparent",
                border: "1px solid",
                borderColor:
                  location.pathname === "/profile"
                    ? "rgba(212,175,55,0.4)"
                    : "#242424",
                color: location.pathname === "/profile" ? "#D4AF37" : "#9e9e9e",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              <FiUser size={14} />
              {user?.profile?.username || user?.email?.split("@")[0]}
            </Link>
            <button
              onClick={handleLogout}
              style={styles.logoutBtn}
              title="Logout"
              className="nav-logout-desktop"
            >
              <FiLogOut size={18} />
            </button>

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
            <Link
              to="/profile"
              onClick={closeMenu}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(212,175,55,0.15)",
                  border: "2px solid rgba(212,175,55,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FiUser size={18} color="#D4AF37" />
              </div>
              <div>
                <p style={{ color: "#D4AF37", fontWeight: 700, fontSize: 14 }}>
                  {user?.profile?.username || user?.email?.split("@")[0]}
                </p>
                <p style={{ color: "#616161", fontSize: 12 }}>{user?.email}</p>
              </div>
            </Link>
          </div>
          <div style={styles.drawerDivider} />
          {[...NAV_LINKS, ...MOBILE_EXTRA].map(({ to, label, icon }) => (
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
          ))}
          <div style={styles.drawerDivider} />
          <button onClick={handleLogout} style={styles.drawerLogout}>
            <FiLogOut size={16} /> Sign Out
          </button>
        </div>
      )}

      {/* Backdrop */}
      {menuOpen && <div style={styles.backdrop} onClick={closeMenu} />}
    </>
  );
}

const styles = {
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 200,
    background: "rgba(10,10,10,0.97)",
    borderBottom: "1px solid #1a1a1a",
    backdropFilter: "blur(12px)",
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
    color: "#D4AF37",
    textDecoration: "none",
    flexShrink: 0,
  },
  links: { display: "flex", alignItems: "center", gap: 4 },
  link: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 16px",
    borderRadius: 20,
    color: "#9e9e9e",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  activeLink: {
    color: "#0a0a0a",
    background: "linear-gradient(135deg, #D4AF37, #a08c29)",
    fontWeight: 700,
  },
  right: { display: "flex", alignItems: "center", gap: 12 },
  email: { fontSize: 13, color: "#9e9e9e", fontWeight: 500 },
  logoutBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9e9e9e",
    display: "flex",
    alignItems: "center",
    padding: 6,
    borderRadius: 6,
    transition: "all 0.2s",
  },
  hamburger: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#D4AF37",
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  drawer: {
    position: "fixed",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 199,
    background: "#111",
    borderBottom: "1px solid #242424",
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
    background: "#1a1a1a",
    margin: "4px 0",
  },
  drawerLink: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 20px",
    color: "#9e9e9e",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 500,
    transition: "all 0.2s",
  },
  drawerLinkActive: {
    color: "#D4AF37",
    background: "rgba(212,175,55,0.07)",
    borderLeft: "3px solid #D4AF37",
  },
  drawerLogout: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 20px",
    background: "none",
    border: "none",
    color: "#ef5350",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 198,
    background: "rgba(0,0,0,0.5)",
  },
};
