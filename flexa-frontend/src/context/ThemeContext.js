import React, { createContext, useState, useContext, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem("flexa_theme_dark");
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default to dark mode
    return true;
  });

  useEffect(() => {
    localStorage.setItem("flexa_theme_dark", JSON.stringify(isDark));
    // Update root element class for global styles
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

// Light theme
const lightTheme = {
  bg: {
    primary: "#ffffff",
    secondary: "#f5f5f5",
    tertiary: "#e8e8e8",
  },
  text: {
    primary: "#1a1a1a",
    secondary: "#555555",
    tertiary: "#888888",
  },
  accent: "#FF6B35",
  border: "rgba(0, 0, 0, 0.15)",
  chatBubble: {
    user: {
      bg: "#FF6B35",
      text: "#ffffff",
    },
    assistant: {
      bg: "#f0f0f0",
      text: "#1a1a1a",
      border: "#e0e0e0",
    },
  },
};

// Dark theme (default)
const darkTheme = {
  bg: {
    primary: "#0a0a0a",
    secondary: "#111111",
    tertiary: "#1a1a1a",
  },
  text: {
    primary: "#ffffff",
    secondary: "#c8c8c8",
    tertiary: "#888888",
  },
  accent: "#FF6B35",
  border: "rgba(255, 255, 255, 0.1)",
  chatBubble: {
    user: {
      bg: "#FF6B35",
      text: "#000000",
    },
    assistant: {
      bg: "rgba(255, 255, 255, 0.07)",
      text: "#e8e8e8",
      border: "rgba(255, 255, 255, 0.1)",
    },
  },
};
