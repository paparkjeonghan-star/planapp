Backend: DB 마이그레이션 및 실행

사전조건
- Node.js 18+ 설치
- PowerShell 사용(Windows)

빠른 시작

1. 레포 루트에서 파워셸 스크립트 실행

```powershell
pwsh -File backend/setup.ps1
```

2. 서버 시작

```powershell
cd backend
npm run dev
```

설명
- `setup.ps1`은 `backend/.env`를 `.env.example`에서 복사하고 `npm install`, `npx prisma generate`, `npx prisma migrate dev`를 실행합니다.
- 기본 DB는 `backend/prisma/dev.db`(SQLite)입니다. 프로덕션에서는 `DATABASE_URL`을 Postgres로 변경하세요.
- 개발 중에는 `npm run dev`로 서버를 확인하세요. 기본 포트는 `4000`입니다.
