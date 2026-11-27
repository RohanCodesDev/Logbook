/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Headings → Urbanist
        heading: ['Urbanist', 'sans-serif'],
        // Subheadings / body → Product Sans
        subheading: ['"Product Sans"', 'Urbanist', 'sans-serif'],
        sans: ['"Product Sans"', 'Urbanist', 'sans-serif'],
        mono: ['"Product Sans"', 'Urbanist', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
