import React, { useState } from 'react'
import Planner from './components/Planner'
import PlanDetails from './components/PlanDetails'

export default function App() {
  const [currentPlan, setCurrentPlan] = useState<any>(null)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="mb-4 text-2xl font-bold">학습 플래너</h1>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Planner onPlanGenerated={setCurrentPlan} />
        </div>
        <div className="xl:col-span-1">
          <PlanDetails
            plan={currentPlan?.plan}
            sessions={currentPlan?.plan?.sessions || currentPlan?.sessions || []}
            subjectsMap={currentPlan?.subjectsMap || {}}
          />
        </div>
      </div>
    </div>
  )
}
