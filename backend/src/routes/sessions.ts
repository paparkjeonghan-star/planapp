import { Router } from 'express'
import prisma from '../prismaClient'

const router = Router()

// PUT /api/sessions/:id - update startTime and/or durationMinutes
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { startTime, durationMinutes } = req.body
  try {
    const data:any = {}
    if (startTime !== undefined) data.startTime = startTime
    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes
    const updated = await prisma.studySession.update({ where: { id }, data })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

export default router
