import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A0B2E",
          deep: "#07081F",
          soft: "#151636",
        },
        pink: {
          DEFAULT: "#EC2F8A",
          bright: "#F04A9A",
          soft: "#FBD0E4",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pop: "0 12px 40px -12px rgba(236, 47, 138, 0.45)",
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
