const config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#0F766E",
          light: "#0D9488",
          dark: "#0C5C55",
        },
        "brand-blue": "#2563EB",
        "brand-purple": "#7C3AED",
        "slate-bg": "#F8FAFC",
      },
    },
  },
  plugins: [],
};

export default config;
