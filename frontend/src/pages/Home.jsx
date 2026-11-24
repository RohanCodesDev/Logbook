import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, Server, Layout, CheckCircle2 } from 'lucide-react'

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl border border-indigo-100">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" /> Fullstack Architecture Ready
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight">
          Welcome to <span className="text-indigo-600">Logbook</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          A high-performance workspace combining a React + Tailwind CSS frontend with a modular Node.js Express backend.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Open Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors border border-slate-200"
          >
            View Project Details
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
            <Layout className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">React Frontend</h2>
          <p className="mt-2 text-slate-600 leading-relaxed">
            Fast bundling with Vite, utility-first styling with Tailwind CSS, pre-configured with <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono text-sm">src/pages/</code> routing.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> React Router DOM v6
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tailwind CSS v3 with PostCSS
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Lucide React icons
            </li>
          </ul>
        </div>

        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
            <Server className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Node.js Backend</h2>
          <p className="mt-2 text-slate-600 leading-relaxed">
            Clean Express REST API with ES Modules, environment variable management, CORS protection, and live reload with Nodemon.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Express 4 REST API
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Health check & Logs endpoints
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Vite development proxy configured
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
