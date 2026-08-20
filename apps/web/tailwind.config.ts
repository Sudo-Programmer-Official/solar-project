import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#f7f9fc",
          surface: "#ffffff",
          muted: "#f1f5f9",
          elevated: "#eef3f9",
          border: "#dbe4ef",
          text: "#122033",
          mutedText: "#64748b",
        },
        primary: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        accent: {
          400: "#67e8f9",
          500: "#22d3ee",
          600: "#0891b2",
        },
        whale: {
          50: "#fff8e7",
          100: "#fef0c7",
          200: "#fde68a",
          300: "#f5cd62",
          400: "#e7b84e",
          500: "#d4a63d",
          600: "#b8892d",
        },
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        card: "0 14px 35px rgba(15, 23, 42, 0.08)",
        lift: "0 10px 24px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "1.85rem",
      },
      spacing: {
        touch: "2.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
