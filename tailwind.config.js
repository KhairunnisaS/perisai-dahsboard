/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["'Poppins'", "sans-serif"],
        montserrat: ["'Montserrat'", "sans-serif"],
        sans: ["'Poppins'", "sans-serif"],
      },
      colors: {
        perisai: {
          green: "#16A08F",
          dark: "#4A5255",
          bg: "#F2F3F7",
          label: "#A7A7A7",
          border: "#D2D3D7",
          "border-light": "#DADBDD",
          "border-tab": "#D7D8DC",
          red: "#C46B71",
        },
      },
    },
  },
  plugins: [],
};
