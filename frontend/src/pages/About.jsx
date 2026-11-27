import { FolderTree, Code, Terminal, Layers } from 'lucide-react'

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">About Logbook</h1>
        <p className="text-slate-500 mt-1">Structure, architecture, and technology overview.</p>
      </div>

      {/* Directory Structure */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-lg">
          <FolderTree className="w-5 h-5" />
          Workspace Directory Structure
        </div>
        <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-sans text-sm overflow-x-auto leading-relaxed">
{`Logbook/
├── frontend/
│   ├── src/
│   │   ├── pages/         # Page components (Home, Dashboard, About, NotFound)
│   │   ├── components/    # Reusable UI components (Navbar, Footer)
│   │   ├── services/      # Backend API communication layer
│   │   ├── App.jsx        # Root routing and layout
│   │   ├── main.jsx       # React application entry point
│   │   └── index.css      # Tailwind CSS directives and global styles
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js     # Dev server & backend proxy config
│   └── package.json
└── backend/
    ├── src/
    │   ├── controllers/   # Request logic handlers
    │   ├── routes/        # Express route definitions
    │   ├── middleware/    # Error handlers & utilities
    │   └── server.js      # Express application setup
    ├── .env
    └── package.json`}
        </pre>
      </div>

      {/* Tech Stack Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold">
            <Code className="w-5 h-5" /> Frontend Technologies
          </div>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li>React 18 with modern functional hooks</li>
            <li>Tailwind CSS for utility-first styling</li>
            <li>React Router DOM for seamless client-side navigation</li>
            <li>Vite for instant hot module replacement (HMR)</li>
            <li>Lucide React for clean icons</li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <Terminal className="w-5 h-5" /> Backend Technologies
          </div>
          <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Node.js runtime with modern ES Modules</li>
            <li>Express.js web application framework</li>
            <li>CORS enabled for flexible cross-origin communication</li>
            <li>Dotenv for environment variable security</li>
            <li>Morgan logger and Nodemon for live auto-reloading</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
