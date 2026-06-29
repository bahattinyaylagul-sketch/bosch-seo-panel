import type { Config } from "tailwindcss";

// Bosch Aftermarket design tokens — boschaftermarket.com görünümü (sıfırdan, asset kopyası yok)
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bosch: {
          red: "#ED0007",
          "red-hover": "#B8000A",
          blue: "#007BC0",
          // supergraphic stops
          turquoise: "#18837E",
          green: "#00884A",
          purple: "#9E2896",
        },
        ink: {
          DEFAULT: "#000000", // başlık
          body: "#525252", // gövde
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F5F5F5",
          border: "#ECECEC",
        },
      },
      borderRadius: {
        // Bosch köşeleri sert tutar
        bosch: "2px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
