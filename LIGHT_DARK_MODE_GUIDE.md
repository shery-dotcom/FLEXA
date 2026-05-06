# 🌓 Light and Dark Mode Guide

## Overview

Flexa now has a complete light and dark mode system that works across the entire app. Users can toggle between modes, and their preference is saved automatically.

## Features

### ✅ What's Implemented

- **Theme Toggle Button** - Sun/Moon icon in navbar (top right) for easy switching
- **Persistent User Preference** - Theme choice saved in localStorage
- **Complete Color System** - 50+ CSS variables covering all UI elements
- **Smooth Transitions** - Graceful 0.3s color transitions when switching modes
- **System Default** - Defaults to dark mode on first visit
- **Global Application** - Theme applies to all pages and components automatically

## How It Works

### For Users

1. Click the sun/moon icon in the navbar (top-right corner)
2. The entire app switches themes instantly
3. Your preference is remembered next time you visit

### For Developers

#### Theme Files

- **[src/context/ThemeContext.js](flexa-frontend/src/context/ThemeContext.js)** - React context managing theme state
- **[src/styles/theme.css](flexa-frontend/src/styles/theme.css)** - CSS custom properties for all colors
- **[src/components/ThemeToggle.js](flexa-frontend/src/components/ThemeToggle.js)** - Theme switch button
- **[src/styles/global.css](flexa-frontend/src/styles/global.css)** - Global styles using theme variables

#### Using Theme in Components

**Access current theme:**

```javascript
import { useTheme } from "../context/ThemeContext";

function MyComponent() {
  const { isDark, toggleTheme, theme } = useTheme();

  return (
    <div
      style={{
        background: theme.bg.primary,
        color: theme.text.primary,
      }}
    >
      {isDark ? "Dark Mode" : "Light Mode"}
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}
```

**Use CSS variables in styles:**

```javascript
const styles = {
  container: {
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
  },
  button: {
    background: "var(--btn-primary-bg)",
    color: "var(--btn-primary-text)",
  },
};
```

## CSS Variables Reference

### Backgrounds

```css
--bg-primary      /* Main background (white/dark) */
--bg-secondary    /* Secondary background for cards */
--bg-tertiary     /* Tertiary for nested elements */
--bg-hover        /* Hover state background */
--bg-light        /* Light variant */
```

### Text Colors

```css
--text-primary    /* Main text color */
--text-secondary  /* Secondary/muted text */
--text-tertiary   /* Very muted text */
--text-inverse    /* Opposite of primary (for contrast) */
```

### UI Elements

```css
--accent              /* Primary accent color (orange) */
--accent-light        /* Lighter shade of accent */
--accent-dark         /* Darker shade of accent */
--btn-primary-bg      /* Primary button background */
--btn-primary-text    /* Primary button text */
--btn-secondary-bg    /* Secondary button background */
--btn-hover           /* Hover state for buttons */
```

### Borders & Cards

```css
--border-color        /* Standard border color */
--border-light        /* Light/subtle border */
--card-bg            /* Card background */
--card-border        /* Card border */
--card-shadow        /* Card shadow */
```

### Status Colors

```css
--status-success    /* Success/positive (green) */
--status-warning    /* Warning (orange) */
--status-error      /* Error (red) */
--status-info       /* Info (blue) */
```

## Light Mode Colors

| Element    | Color               |
| ---------- | ------------------- |
| Background | #ffffff (white)     |
| Text       | #1a1a1a (dark gray) |
| Accent     | #ff6b35 (orange)    |
| Card BG    | #ffffff             |
| Border     | rgba(0,0,0,0.15)    |

## Dark Mode Colors

| Element    | Color                 |
| ---------- | --------------------- |
| Background | #0a0a0a (very dark)   |
| Text       | #ffffff (white)       |
| Accent     | #ff6b35 (orange)      |
| Card BG    | #111111               |
| Border     | rgba(255,255,255,0.1) |

## Migration Guide - Converting Old Components

### Before (Hardcoded Colors)

```javascript
const styles = {
  container: {
    backgroundColor: "#0a0a0a", // ❌ Hardcoded dark
    color: "#ffffff", // ❌ Hardcoded light
  },
  card: {
    background: "#111111", // ❌ Won't change with theme
    border: "1px solid #1a1a1a", // ❌ Won't change with theme
  },
};
```

### After (Theme Variables)

```javascript
const styles = {
  container: {
    backgroundColor: "var(--bg-primary)", // ✅ Respects theme
    color: "var(--text-primary)", // ✅ Respects theme
  },
  card: {
    background: "var(--card-bg)", // ✅ Changes with theme
    border: "1px solid var(--border-color)", // ✅ Changes with theme
  },
};
```

### Color Mapping Cheatsheet

| Old Color               | New Variable          |
| ----------------------- | --------------------- |
| #0a0a0a (dark bg)       | var(--bg-primary)     |
| #111111 (dark card)     | var(--card-bg)        |
| #ffffff (white text)    | var(--text-primary)   |
| #1a1a1a (dark border)   | var(--border-color)   |
| #FF6B35 (orange accent) | var(--accent)         |
| #e0e0e0 (light gray)    | var(--text-secondary) |

## Updating Pages to Use Themes

### Step 1: Remove hardcoded dark colors

Search for hex colors like: `#0a0a0a`, `#111111`, `#ffffff`

### Step 2: Replace with CSS variables

```javascript
// Find and replace:
// "#0a0a0a" → "var(--bg-primary)"
// "#ffffff" → "var(--text-primary)"
// "#111111" → "var(--card-bg)"
```

### Step 3: Import useTheme if needed

```javascript
import { useTheme } from "../context/ThemeContext";
const { theme } = useTheme();
```

## Testing the Theme

1. **Start the app:**

   ```bash
   .\run.ps1  # Backend + Frontend
   ```

2. **Go to:** http://localhost:3000

3. **Click the sun/moon icon** in the top-right navbar

4. **Check the theme changes:**
   - Background and text colors should flip
   - All pages should update instantly
   - No color should remain hardcoded

5. **Verify persistence:**
   - Refresh the page (Ctrl+R)
   - Theme preference should remain

## Browser DevTools Inspection

You can inspect the CSS variables in DevTools:

```javascript
// In browser console:
const styles = getComputedStyle(document.documentElement);
console.log(styles.getPropertyValue("--bg-primary")); // Shows current bg color
console.log(styles.getPropertyValue("--text-primary")); // Shows current text color
console.log(styles.getPropertyValue("--accent")); // Shows accent color
```

## Known Limitations

- Third-party chart libraries may need individual theming
- Images don't invert automatically (use filters if needed)
- Some animations may flash during theme switch

## Future Improvements

- [ ] Add theme sync across tabs/windows
- [ ] Add more theme presets (high contrast, etc.)
- [ ] Add theme schedule (auto-switch at sunset)
- [ ] Add per-component theme overrides
- [ ] Add color picker for custom themes

---

**Questions or issues?** Check if you're:

1. Using CSS variables instead of hardcoded colors
2. Wrapping app with ThemeProvider (done in App.js)
3. Importing theme.css in global.css (already done)
4. Refreshing the browser after changes
