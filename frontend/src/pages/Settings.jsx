import { useState, useEffect, useCallback } from 'react'
import { Database, Save, RefreshCw, CheckCircle2, XCircle, Building2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import InputField, { inputClass } from '../components/ui/InputField'
import { useToast } from '../components/ui/Toast'
import { useTopBar } from '../components/layout/AppLayout'
import { getBusinessProfile } from '../components/layout/Sidebar'
import { getHealth } from '../services/api'

export default function Settings() {
  const { showToast } = useToast()
  const { setTopBar, clearTopBar } = useTopBar()

  const [profile, setProfile] = useState(getBusinessProfile)
  const [health, setHealth]   = useState(null)
  const [checking, setChecking] = useState(true)

  const checkDb = useCallback(async () => {
    setChecking(true)
    try {
      const res = await getHealth()
      setHealth(res)
    } catch (err) {
      setHealth({ status: 'error', message: err.message, database: { connected: false } })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkDb() }, [checkDb])

  useEffect(() => {
    setTopBar({ title: 'Settings' })
    return () => clearTopBar()
  }, [setTopBar, clearTopBar])

  const handleSaveProfile = (e) => {
    e.preventDefault()
    localStorage.setItem('buildlogic_profile', JSON.stringify(profile))
    window.dispatchEvent(new Event('business-profile-updated'))
    showToast('Business profile saved')
  }

  const dbConnected = health?.database?.connected

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Business Profile */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Personal Business Profile</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <InputField label="Business / Workspace Name">
              <input
                type="text"
                className={inputClass}
                value={profile.businessName}
                onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                placeholder="e.g. BuildLogic Constructions"
              />
            </InputField>

            <InputField label="Tagline / Subtitle">
              <input
                type="text"
                className={inputClass}
                value={profile.subtitle}
                onChange={(e) => setProfile({ ...profile, subtitle: e.target.value })}
                placeholder="e.g. Personal Construction Log"
              />
            </InputField>

            <InputField label="Owner Name">
              <input
                type="text"
                className={inputClass}
                value={profile.ownerName}
                onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                placeholder="Your Name"
              />
            </InputField>

            <div className="pt-2">
              <Button type="submit" variant="primary">
                <Save className="w-4 h-4" />
                Save Profile
              </Button>
            </div>
          </form>
        </Card>

        {/* Cloud Database Health */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Cloud Database Status</h3>
            </div>
            <Button variant="outline" size="sm" onClick={checkDb} disabled={checking}>
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              Test
            </Button>
          </div>

          <div className="space-y-4">
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              dbConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                : 'bg-red-50/70 border-red-200 text-red-800'
            }`}>
              {dbConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {checking ? 'Checking connection...' : dbConnected ? 'Neon PostgreSQL Connected' : 'Database Disconnected'}
                </p>
                <p className="text-xs opacity-80">
                  {dbConnected
                    ? `Response latency: ${health.database.latencyMs} ms`
                    : (health?.message || 'Ensure backend server is running on port 5000')}
                </p>
              </div>
            </div>

            {dbConnected && health.database.counts && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { label: 'Projects',      value: health.database.counts.projects },
                  { label: 'Sections',      value: health.database.counts.sections },
                  { label: 'Custom Fields', value: health.database.counts.fields },
                  { label: 'Records',       value: health.database.counts.records },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <p className="text-xl font-bold text-slate-900 tabular-nums">{item.value}</p>
                    <p className="text-xs text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
