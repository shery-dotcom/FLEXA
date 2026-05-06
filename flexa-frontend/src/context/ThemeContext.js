import React, { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Dark mode only - set on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Provide theme object for dark mode
  const theme = darkTheme;

  return (
    <ThemeContext.Provider value={{ theme }}>
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

// Dark theme (default - only theme)
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
