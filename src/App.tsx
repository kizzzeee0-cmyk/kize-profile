import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { AdminGuard, AdminLayout } from './components/AdminLayout'
import { AuthProvider } from './lib/AuthContext'
import { PublicDataProvider, usePublicData } from './lib/PublicDataContext'
import { ThemeProvider } from './lib/ThemeContext'
import HomePage from './pages/HomePage'
import SchedulePage from './pages/SchedulePage'
import SongbookPage from './pages/SongbookPage'
import WardrobePage from './pages/WardrobePage'
import WorkPage from './pages/WorkPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminProfilePage from './pages/admin/AdminProfilePage'
import AdminSchedulePage from './pages/admin/AdminSchedulePage'
import AdminMilestonesPage from './pages/admin/AdminMilestonesPage'
import AdminArchivePage from './pages/admin/AdminArchivePage'
import AdminNavigationPage from './pages/admin/AdminNavigationPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminSongsPage from './pages/admin/AdminSongsPage'
import AdminWardrobePage from './pages/admin/AdminWardrobePage'
import AdminUpboPage from './pages/admin/AdminUpboPage'
import AdminTextsPage from './pages/admin/AdminTextsPage'

function MetaSync() {
  const { data } = usePublicData()
  useEffect(() => {
    if (data.settings?.site_title) document.title = data.settings.site_title
    const meta = document.querySelector('meta[name="description"]')
    if (meta && data.settings?.site_description) meta.setAttribute('content', data.settings.site_description)
    if (data.settings?.favicon_url) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = data.settings.favicon_url
    }
  }, [data.settings])
  return null
}

function PublicRoute({ children }: { children: ReactNode }) {
  return <SiteLayout>{children}</SiteLayout>
}

function ProtectedAdmin({ children }: { children: ReactNode }) {
  return <AdminGuard><AdminLayout>{children}</AdminLayout></AdminGuard>
}

export default function App() {
  return <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <PublicDataProvider>
          <MetaSync />
          <Routes>
            <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
            <Route path="/schedule" element={<PublicRoute><SchedulePage /></PublicRoute>} />
            <Route path="/schedule/" element={<PublicRoute><SchedulePage /></PublicRoute>} />
            <Route path="/songs" element={<PublicRoute><SongbookPage /></PublicRoute>} />
            <Route path="/songs/" element={<PublicRoute><SongbookPage /></PublicRoute>} />
            <Route path="/roulette" element={<PublicRoute><WardrobePage /></PublicRoute>} />
            <Route path="/roulette/" element={<PublicRoute><WardrobePage /></PublicRoute>} />
            <Route path="/work" element={<PublicRoute><WorkPage /></PublicRoute>} />
            <Route path="/work/" element={<PublicRoute><WorkPage /></PublicRoute>} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<ProtectedAdmin><AdminDashboardPage /></ProtectedAdmin>} />
            <Route path="/admin/profile" element={<ProtectedAdmin><AdminProfilePage /></ProtectedAdmin>} />
            <Route path="/admin/schedule" element={<ProtectedAdmin><AdminSchedulePage /></ProtectedAdmin>} />
            <Route path="/admin/milestones" element={<ProtectedAdmin><AdminMilestonesPage /></ProtectedAdmin>} />
            <Route path="/admin/archive" element={<ProtectedAdmin><AdminArchivePage /></ProtectedAdmin>} />
            <Route path="/admin/navigation" element={<ProtectedAdmin><AdminNavigationPage /></ProtectedAdmin>} />
            <Route path="/admin/songs" element={<ProtectedAdmin><AdminSongsPage /></ProtectedAdmin>} />
            <Route path="/admin/wardrobe" element={<ProtectedAdmin><AdminWardrobePage /></ProtectedAdmin>} />
            <Route path="/admin/upbo" element={<ProtectedAdmin><AdminUpboPage /></ProtectedAdmin>} />
            <Route path="/admin/texts" element={<ProtectedAdmin><AdminTextsPage /></ProtectedAdmin>} />
            <Route path="/admin/settings" element={<ProtectedAdmin><AdminSettingsPage /></ProtectedAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PublicDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
}
