import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="py-20 text-center space-y-6">
      <div className="inline-flex p-4 rounded-full bg-rose-50 text-rose-500">
        <AlertCircle className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900">404 - Page Not Found</h1>
      <p className="text-slate-600 max-w-md mx-auto">
        The page you are looking for does not exist in the Logbook workspace.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Return Home
      </Link>
    </div>
  )
}
