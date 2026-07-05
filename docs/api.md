API 명세 초안

인증
- Supabase Auth 또는 JWT 기반 인증 사용
- 역할: `admin`, `teacher`, `student`

엔드포인트(REST)

- `POST /api/auth/signin` - 로그인 (외부/내부)
- `GET /api/users` - 사용자 목록 (admin)
- `GET /api/students` - 학생 목록 (teacher/admin)
- `POST /api/students` - 학생 생성
- `GET /api/students/:id` - 학생 상세

- `GET /api/timetables?studentId=&weekStart=` - 시간표 조회
- `POST /api/timetables` - 시간표 생성/업데이트
- `DELETE /api/timetables/:id`

- `GET /api/subjects?studentId=` - 과목 목록
- `POST /api/subjects` - 과목 생성/수정

- `GET /api/plans?studentId=&weekStart=` - 플랜 조회
- `POST /api/plans` - 수동 플랜 생성
- `POST /api/plans/generate` - 자동 플랜 생성 (주중 시간표 기준)
- `PUT /api/plans/:id` - 플랜 수정
- `DELETE /api/plans/:id`

- `GET /api/sessions?planId=` - 공부 세션 조회
- `POST /api/sessions` - 세션 생성/수정

- `GET /api/templates` - 템플릿 목록
- `POST /api/templates` - 템플릿 저장

- `GET /api/export?studentId=&weekStart=&format=csv|xlsx` - 플랜 내보내기

실시간
- Supabase Realtime 또는 WebSocket을 통해 시간표/플랜 변경을 구독

자동 생성 로직(POST /api/plans/generate)
- 입력: `studentId`, `weekStart`, 옵션(우선순위 가중치, 최소 세션 길이 등)
- 동작: 시간표의 `study` 슬롯을 파싱하여 과목별 목표시간을 슬롯에 배분
- 출력: 생성된 `Plan`과 `StudySession` 목록

보안
- 학생 데이터는 권한 검사 후 반환
- 민감정보(이메일, 노트 등)에 대한 접근 제어

비고
- 초기 프로토타입은 REST로 시작하고, 필요시 GraphQL로 확장
- 배치/백그라운드 작업(정기 생성, 알림)은 별도 worker/process로 구성
