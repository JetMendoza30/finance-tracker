import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-slate-300 dark:text-slate-600 mb-3">{icon}</div>
      <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400">{title}</h3>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{description}</p>
    </div>
  )
}
