/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Headings  → Urbanist
        heading: ['Urbanist', 'sans-serif'],
        // Subheadings / body → DM Sans (closest freely available match to Product Sans)
        subheading: ['"DM Sans"', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
