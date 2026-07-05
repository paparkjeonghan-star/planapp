import React from 'react'

export type SlotType = {
  id: string
  day: number
  start: string
  end: string
  subject?: string
  category?: string
  studyType?: string
  note?: string
  completed?: boolean
  weekStart?: string
}

export default function Slot({
  slot,
  subjectName,
  onEdit
}: {
  slot: SlotType
  subjectName?: string
  onEdit: (s: SlotType) => void
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', slot.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="mb-2 cursor-move rounded border border-blue-200 bg-blue-50 p-2"
      onClick={() => onEdit(slot)}
    >
      <div className="text-sm font-medium">{subjectName || slot.subject || '자유 학습'}</div>
      <div className="text-xs text-gray-600">
        {slot.start} - {slot.end}
      </div>
    </div>
  )
}
