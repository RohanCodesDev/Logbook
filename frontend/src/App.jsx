import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectWorkspace from './pages/ProjectWorkspace'
import CrewDirectory from './pages/CrewDirectory'
import Agreements from './pages/Agreements'
import AgreementDetail from './pages/AgreementDetail'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/projects"     element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectWorkspace />} />
        <Route path="/crew"         element={<CrewDirectory />} />
        <Route path="/agreements"     element={<Agreements />} />
        <Route path="/agreements/:id" element={<AgreementDetail />} />
        <Route path="/reports"        element={<Reports />} />
        <Route path="/settings"     element={<Settings />} />
        <Route path="*"             element={<NotFound />} />
      </Routes>
    </AppLayout>
  )
}

export default App
