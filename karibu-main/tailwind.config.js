/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Karibu brand palette
        clay: {
          DEFAULT: "#B8472E",
          soft: "#F3D9CF",
        },
        forest: {
          DEFAULT: "#2A3D2B",
          soft: "#EBEFE9",
        },
        ochre: {
          DEFAULT: "#D4A341",
          soft: "#FBF4E0",
          deep: "#7A5A10",
        },
        ivory: {
          DEFAULT: "#F7F1E8",
          2: "#F1E9DB",
        },
        ink: "#1C1613",
        stone: {
          warm: "#8B8378",
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
