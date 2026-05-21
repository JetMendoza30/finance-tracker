import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { FAB } from './FAB'
import { TransactionForm } from '@/components/transactions/TransactionForm'

export function AppShell() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <main className="pb-20 max-w-lg mx-auto px-4">
        <Outlet />
      </main>
      <FAB onClick={() => setShowForm(true)} />
      <BottomNav />
      {showForm && (
        <TransactionForm onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
