import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { BudgetPage } from '@/pages/BudgetPage'
import { TaxPage } from '@/pages/TaxPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useTheme } from '@/hooks/useTheme'
import { seedDatabase } from '@/db/seed'

function AppContent() {
  useTheme()

  useEffect(() => {
    seedDatabase()
  }, [])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="tax" element={<TaxPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
