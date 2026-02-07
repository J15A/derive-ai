/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f8fafc",
        panel: "#ffffff",
        ink: "#0f172a",
      },
      boxShadow: {
        soft: "0 8px 24px -16px rgba(15, 23, 42, 0.25)",
      },
    },
  },
  plugins: [],
};
