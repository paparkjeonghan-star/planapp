import express from 'express';
import cors from 'cors';
import prisma from './prismaClient';
import studentsRouter from './routes/students';
import timetablesRouter from './routes/timetables';
import plansRouter from './routes/plans';
import subjectsRouter from './routes/subjects';
import sessionsRouter from './routes/sessions';
import examsRouter from './routes/exams';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/students', studentsRouter);
app.use('/api/timetables', timetablesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/exams', examsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

async function seedStudents() {
  const studentCount = await prisma.student.count();
  if (studentCount > 0) return;

  const defaultStudents = [
    { name: '박상우', grade: '고1', notes: '기본 학생' },
    { name: '이재경', grade: '고2', notes: '기본 학생' },
    { name: '박정한', grade: '고3', notes: '기본 학생' },
  ];

  for (const student of defaultStudents) {
    const exists = await prisma.student.findFirst({ where: { name: student.name } });
    if (!exists) {
      await prisma.student.create({ data: student });
    }
  }
}

async function main() {
  await seedStudents();
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Server running on ${port}`));
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
