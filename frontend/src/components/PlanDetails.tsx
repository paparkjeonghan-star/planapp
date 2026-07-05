import React from 'react'

function getDayLabel(dateString: string) {
  const d = new Date(dateString)
  return d.toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

export default function PlanDetails({
  plan,
  sessions,
  subjectsMap
}: {
  plan: any
  sessions: any[]
  subjectsMap: Record<string, any>
}) {
  if (!plan) return null

  const totalMinutes = sessions.reduce((sum, ss: any) => sum + (ss.durationMinutes || 0), 0)
  const sortedSessions = [...sessions].sort((a: any, b: any) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (da !== db) return da - db
    return String(a.startTime || '').localeCompare(String(b.startTime || ''))
  })

  return (
    <div className="space-y-5 rounded bg-white p-4 shadow">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 text-xl font-semibold">과목별 공부 계획</h2>
          <div className="text-sm text-gray-600">이번 주 계획과 실제 세션을 비교해보세요.</div>
        </div>
        <div className="text-right text-sm text-gray-500">총 세션 {sessions.length}개</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-gray-200 p-3">
          <div className="text-sm text-gray-500">플랜 주</div>
          <div className="mt-1 font-semibold">{new Date(plan.weekStart).toLocaleDateString('ko-KR')}</div>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <div className="text-sm text-gray-500">총 학습 시간</div>
          <div className="mt-1 font-semibold">{(totalMinutes / 60).toFixed(1)}시간</div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">과목별 할당</h3>
        <div className="space-y-3">
          {(plan.allocations || []).map((alloc: any) => {
            const subject = subjectsMap[alloc.subjectId]
            const ratio = subject?.weeklyTargetHours ? Math.min(1, (alloc.hours || 0) / subject.weeklyTargetHours) : 0
            return (
              <div key={alloc.id || alloc.subjectId} className="rounded border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{subject?.name || alloc.subjectId}</div>
                    <div className="text-xs text-gray-500">목표 {subject?.weeklyTargetHours ?? '-'}시간</div>
                  </div>
                  <div className="text-sm font-semibold">{Number(alloc.hours || 0).toFixed(1)}h</div>
                </div>
                <div className="h-2 overflow-hidden rounded bg-gray-200">
                  <div className="h-full bg-blue-500" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">세션 일정</h3>
        <div className="space-y-2">
          {sortedSessions.map((ss: any) => {
            const subject = subjectsMap[ss.subjectId]
            return (
              <div key={ss.id} className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{subject?.name || ss.subjectId}</div>
                    <div className="text-xs text-gray-500">
                      {getDayLabel(ss.date)} · {ss.startTime}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{ss.durationMinutes}분</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
