import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        hedera: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          400: "#6b82f8",
          600: "#4253e8",
          800: "#2b38c0",
        },
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "fade-in":   "fadeIn 0.4s ease forwards",
        "slide-up":  "slideUp 0.35s ease forwards",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
