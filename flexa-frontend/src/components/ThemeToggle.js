import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 8px",
        borderRadius: "6px",
        transition: "all 0.3s ease",
        fontSize: 18,
        width: 36,
        height: 36,
        marginRight: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--btn-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
    </button>
  );
}

