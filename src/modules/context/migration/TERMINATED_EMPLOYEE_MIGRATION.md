# 퇴사자 데이터 마이그레이션 가이드

## 📋 개요

퇴사자의 퇴사일 및 배치/이력 데이터를 정리하는 마이그레이션 서비스입니다.

## 🎯 목적

- 퇴사일이 누락되거나 잘못된 퇴사자 데이터 정정
- 퇴사자 부서 이력을 현재 이력(isCurrent)으로 설정
- 과거 부서 이력의 유효기간을 퇴사일로 종료 처리
- 불필요한 배치 데이터 정리

## 🔄 처리 프로세스

```
1. 직원 조회 (사번으로)
   └─ 퇴사 상태(TERMINATED) 확인

2. 퇴사일 업데이트
   └─ terminationDate를 예상퇴사일로 설정

3. 퇴사자 부서 이력 설정
   ├─ isCurrent = true로 설정
   ├─ effectiveStartDate = 퇴사일
   └─ effectiveEndDate = null

4. 다른 부서 이력들 종료 처리
   ├─ isCurrent = false로 설정
   └─ effectiveEndDate = 퇴사일

5. 배치 데이터 정리
   └─ 퇴사자 부서가 아닌 배치 데이터 삭제
```

## 📁 파일 구조

```
src/modules/context/migration/
├── terminated-employee-migration.service.ts  ✅ 메인 서비스
├── migration.controller.ts                   수정됨 (엔드포인트 추가)
├── migration.module.ts                        수정됨 (서비스 등록)
└── TERMINATED_EMPLOYEE_MIGRATION.md          ✅ 이 문서
```

## 🛠️ 사용 방법

### 1단계: 퇴사자 현황 조회

현재 퇴사 상태인 직원들의 배치 및 이력 상태를 먼저 확인합니다:

```http
GET /migration/terminated-employees/status
```

**응답 예시:**

```json
[
  {
    "employeeId": "uuid",
    "employeeNumber": "RM001",
    "employeeName": "홍길동",
    "terminationDate": null,  // 퇴사일 누락
    "currentDepartment": "경영지원실",  // 퇴사자 부서가 아님
    "currentDepartmentId": "uuid",
    "hasMultipleAssignments": true,  // 여러 배치 존재
    "historyCount": 2
  }
]
```

### 2단계: 퇴사자 데이터 준비

이름, 사번, 예상퇴사일 데이터를 준비합니다:

```json
{
  "employees": [
    {
      "name": "홍길동",
      "employeeNumber": "RM001",
      "expectedTerminationDate": "2025-01-15"
    },
    {
      "name": "김철수",
      "employeeNumber": "RM002",
      "expectedTerminationDate": "2025-02-28"
    }
  ]
}
```

### 3단계: 마이그레이션 실행

```http
POST /migration/terminated-employees/migrate
Content-Type: application/json

{
  "employees": [...]
}
```

### 4단계: 결과 확인

**응답 예시:**

```json
{
  "success": true,
  "totalProcessed": 2,
  "successCount": 2,
  "failedCount": 0,
  "results": [
    {
      "employeeNumber": "RM001",
      "employeeName": "홍길동",
      "success": true,
      "updates": {
        "terminationDateUpdated": true,
        "terminatedDeptHistorySetCurrent": true,
        "otherHistoriesUpdated": 1,
        "assignmentsDeleted": 2
      }
    },
    {
      "employeeNumber": "RM002",
      "employeeName": "김철수",
      "success": true,
      "updates": {
        "terminationDateUpdated": true,
        "terminatedDeptHistorySetCurrent": true,
        "otherHistoriesUpdated": 2,
        "assignmentsDeleted": 1
      }
    }
  ]
}
```

## 📊 처리 상세

### 직원(employees) 테이블 업데이트

```sql
UPDATE employees
SET "terminationDate" = '2025-01-15'
WHERE "employeeNumber" = 'RM001'
```

### 퇴사자 부서 이력 설정

```sql
UPDATE employee_department_position_history
SET 
  "isCurrent" = true,
  "effectiveStartDate" = '2025-01-15',
  "effectiveEndDate" = null
WHERE "employeeId" = 'employee-uuid'
  AND "departmentId" = 'terminated-dept-uuid'
```

### 다른 부서 이력 종료 처리

```sql
UPDATE employee_department_position_history
SET 
  "isCurrent" = false,
  "effectiveEndDate" = '2025-01-15'
WHERE "employeeId" = 'employee-uuid'
  AND "departmentId" != 'terminated-dept-uuid'
  AND "isCurrent" = true
```

### 배치 데이터 삭제

```sql
DELETE FROM employee_department_positions
WHERE "employeeId" = 'employee-uuid'
  AND "departmentId" != 'terminated-dept-uuid'
```

## ⚠️ 주의사항

### 필수 조건

1. **퇴사자 부서 존재**: `isException = true`이고 이름이 "퇴사자"인 부서가 있어야 함
2. **퇴사 상태**: 직원의 status가 `TERMINATED`여야 함
3. **트랜잭션**: 모든 작업은 트랜잭션으로 처리되어 일부 실패 시 롤백됨

### 에러 처리

다음과 같은 경우 해당 직원은 실패 처리됩니다:

- 사번에 해당하는 직원이 없는 경우
- 직원이 퇴사 상태가 아닌 경우
- 퇴사자 부서를 찾을 수 없는 경우
- 데이터베이스 오류 발생

**실패 예시:**

```json
{
  "employeeNumber": "RM999",
  "employeeName": "없는직원",
  "success": false,
  "error": "사번 RM999에 해당하는 직원을 찾을 수 없습니다."
}
```

## ✅ 검증 쿼리

### 퇴사일 확인

```sql
SELECT 
  "employeeNumber",
  name,
  status,
  "terminationDate"
FROM employees
WHERE status = 'TERMINATED'
ORDER BY "terminationDate";
```

### 이력 상태 확인

```sql
SELECT 
  e."employeeNumber",
  e.name,
  d."departmentName",
  h."isCurrent",
  h."effectiveStartDate",
  h."effectiveEndDate"
FROM employee_department_position_history h
JOIN employees e ON h."employeeId" = e.id
JOIN departments d ON h."departmentId" = d.id
WHERE e.status = 'TERMINATED'
ORDER BY e."employeeNumber", h."isCurrent" DESC, h."effectiveStartDate" DESC;
```

### 배치 상태 확인

```sql
SELECT 
  e."employeeNumber",
  e.name,
  d."departmentName",
  d."isException"
FROM employee_department_positions edp
JOIN employees e ON edp."employeeId" = e.id
JOIN departments d ON edp."departmentId" = d.id
WHERE e.status = 'TERMINATED'
ORDER BY e."employeeNumber";
```

## 📖 API 문서

### POST `/migration/terminated-employees/migrate`

**요청:**

```typescript
{
  employees: Array<{
    name: string;              // 직원 이름
    employeeNumber: string;    // 사번
    expectedTerminationDate: string;  // 퇴사일 (YYYY-MM-DD)
  }>
}
```

**응답:**

```typescript
{
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    employeeNumber: string;
    employeeName: string;
    success: boolean;
    error?: string;
    updates?: {
      terminationDateUpdated: boolean;
      terminatedDeptHistorySetCurrent: boolean;
      otherHistoriesUpdated: number;
      assignmentsDeleted: number;
    }
  }>
}
```

### GET `/migration/terminated-employees/status`

**응답:**

```typescript
Array<{
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  terminationDate: string | null;
  currentDepartment: string;
  currentDepartmentId: string;
  hasMultipleAssignments: boolean;
  historyCount: number;
}>
```

## 🚀 향후 개선 사항

- [ ] CSV 파일 업로드 기능
- [ ] 마이그레이션 미리보기 기능
- [ ] 롤백 기능 추가
- [ ] 배치 처리 성능 최적화
- [ ] 퇴사 사유 입력 지원

