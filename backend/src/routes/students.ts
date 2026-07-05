import { Router } from 'express';
import prisma from '../prismaClient';

const router = Router();

router.get('/', async (req, res) => {
  const list = await prisma.student.findMany({ include: { subjects: true } });
  res.json(list);
});

router.post('/', async (req, res) => {
  const { name, school, grade, scores, notes } = req.body;
  const student = await prisma.student.create({ data: { name, school, grade, scores, notes } });
  res.status(201).json(student);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, school, grade, scores, notes } = req.body;

  try {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (school !== undefined) data.school = school;
    if (grade !== undefined) data.grade = grade;
    if (scores !== undefined) data.scores = scores;
    if (notes !== undefined) data.notes = notes;

    const student = await prisma.student.update({ where: { id }, data });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
