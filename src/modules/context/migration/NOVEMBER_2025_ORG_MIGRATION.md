# 2025년 11월 조직도 이력 마이그레이션 가이드

## 📋 개요

11월과 12월 조직도를 비교하여 변경된 직원들의 11월 이력을 자동으로 생성하는 마이그레이션 서비스입니다.

## 🎯 목적

-   조직개편 전(11월) 조직도 데이터를 이력으로 보존
-   변경된 직원만 11월 이력 생성 (효율적 처리)
-   12월 이력의 시작일을 2025-12-01로 정확히 설정

## 🔄 프로세스

```
1. 11월 조직도 데이터 로드
   └─ 사진 데이터를 코드로 매핑

2. 12월 현재 이력 데이터 로드
   └─ DB에서 현재(isCurrent=true) 이력 조회

3. 비교 및 분석
   ├─ 부서 변경 여부
   ├─ 직책 변경 여부
   ├─ 직급 변경 여부
   └─ 관리자 여부 변경

4. 변경된 직원만 처리
   ├─ 11월 이력 생성
   │  ├─ effectiveStartDate: 입사일
   │  ├─ effectiveEndDate: 2025-11-30
   │  └─ isCurrent: false
   │
   └─ 12월 이력 수정
      ├─ effectiveStartDate: 2025-12-01로 변경
      └─ assignmentReason: "2025년 12월 조직개편"
```

## 📁 파일 구조

```
src/modules/context/migration/
├── organization-history-migration.service.ts  ✅ 마이그레이션 실행 서비스
├── organization-history-viewer.service.ts     ✅ 조직도 조회 서비스
├── november-2025-loader.helper.ts            ✅ 11월 데이터 로더
├── november-2025-validator.helper.ts         ✅ 11월 데이터 검증
├── november-2025-org-data.json               ✅ 11월 조직도 원본 데이터
├── dto/
│   └── november-org-data.dto.ts              ✅ DTO
├── migration.controller.ts                    수정됨 (엔드포인트 추가)
├── migration.module.ts                        수정됨 (서비스 등록)
└── NOVEMBER_2025_ORG_MIGRATION.md            ✅ 이 문서
```

## 🛠️ 사용 방법

### 1단계: 11월 조직도 데이터 입력

`organization-history-migration.service.ts` 파일의 `load11월조직도데이터()` 메서드에 데이터를 입력합니다:

```typescript
async load11월조직도데이터(): Promise<November2025OrgData[]> {
    const november2025Data: November2025OrgData[] = [
        // 경영지원실
        {
            employeeId: '직원UUID',
            employeeName: '남경호',
            departmentName: '경영지원실',
            departmentId: '부서UUID',
            positionId: '직책UUID',
            rankId: '직급UUID',
            isManager: true,
        },
        {
            employeeId: '직원UUID',
            employeeName: '이봉은',
            departmentName: '경영지원실',
            departmentId: '부서UUID',
            positionId: '직책UUID',
            rankId: '직급UUID',
            isManager: false,
        },
        // ... 나머지 직원 데이터
    ];

    return november2025Data;
}
```

### 2단계: API 호출

Swagger UI 또는 HTTP 클라이언트로 API를 호출합니다:

```http
POST /migration/november-2025-org-history
Content-Type: application/json
```

### 3단계: 결과 확인

응답 예시:

```json
{
    "success": true,
    "totalProcessed": 50,
    "changedCount": 15,
    "createdCount": 15,
    "updatedCount": 15,
    "errors": []
}
```

## 📊 11월 조직도 데이터 매핑

### 조직 구조

```
대표이사
├── 경영지원실
│   ├── 경영지원실 (남경호, 이봉은, 박태연, 정재일, ...)
│   └── 사업개발실 (이재용, 이서연, ...)
│
├── 연구기술본부
│   ├── PM실 (박세준, 조준현, ...)
│   ├── 시스템파트 (아베드, 람태하얀, 정성훈, ...)
│   ├── ES파트 (전옥림, 김민호, ...)
│   ├── EC파트 (최옥지, 이민수, 김도형, ...)
│   ├── IP파트 (권순영, 서상준, 이승기, ...)
│   ├── RF파트 (당현규, 홍영경, 유경준, ...)
│   └── EP파트 (권순규, 허세영, 김형중, ...)
│
├── 연구개발본부
│   ├── 전략파트 (신준석, 유대영, 고선후, ...)
│   ├── ME파트 (김동현1, 김대영, 김경진, ...)
│   ├── SO파트 (박철수, 정혜진, 김종식, ...)
│   └── WEB파트 (조민경, 이화영, 유승훈, ...)
│
└── 지상기술사업부
    └── 기반기술사업부 (모현민, 김기홍, ...)
```

### 헬퍼 함수 사용

직원 이름과 부서 이름으로 ID를 찾을 수 있습니다:

```typescript
// 직원 ID 찾기
const employeeId = await this.find직원IDByName('남경호');

// 부서 ID 찾기
const departmentId = await this.find부서IDByName('경영지원실');
```

## ⚠️ 주의사항

1. **데이터 정확성**

    - 11월 조직도 데이터를 정확히 입력해야 합니다
    - employeeId, departmentId, positionId, rankId는 UUID 형식이어야 합니다

2. **트랜잭션**

    - 전체 프로세스는 하나의 트랜잭션으로 처리됩니다
    - 실패 시 자동으로 롤백됩니다

3. **재실행**

    - 이미 11월 이력이 생성된 경우 중복 생성될 수 있습니다
    - 재실행 전에 기존 11월 이력을 삭제하거나 확인하세요

4. **백업**
    - 실행 전 데이터베이스 백업을 권장합니다

## 🔍 디버깅

로그 확인:

```
[OrganizationHistoryMigrationService] 11월 조직도 이력 마이그레이션 시작
[OrganizationHistoryMigrationService] 11월 조직도 데이터 50건 로드 완료
[OrganizationHistoryMigrationService] 12월 현재 이력 데이터 50건 로드 완료
[OrganizationHistoryMigrationService] 비교 완료: 전체 50건 중 변경됨 15건
[OrganizationHistoryMigrationService] 변경된 직원 15건 처리 시작
[OrganizationHistoryMigrationService] 이력 변경사항 적용 완료: 생성 15건, 수정 15건, 실패 0건
```

## 📝 예제: 11월 데이터 매핑 스크립트

```typescript
// 11월 조직도 전체 데이터 예시
const november2025Data = [
    // 경영지원실
    { employeeName: '남경호', departmentName: '경영지원실', isManager: true },
    { employeeName: '이봉은', departmentName: '경영지원실', isManager: false },
    { employeeName: '박태연', departmentName: '경영지원실', isManager: false },

    // 사업개발실
    { employeeName: '이재용', departmentName: '사업개발실', isManager: false },
    { employeeName: '이서연', departmentName: '사업개발실', isManager: false },

    // PM실
    { employeeName: '박세준', departmentName: 'PM실', isManager: false },
    { employeeName: '조준현', departmentName: 'PM실', isManager: false },

    // ... 나머지 데이터
];

// UUID 매핑 자동화 (옵션)
for (const data of november2025Data) {
    data.employeeId = await this.find직원IDByName(data.employeeName);
    data.departmentId = await this.find부서IDByName(data.departmentName);
    // positionId, rankId도 매핑 필요
}
```

## ✅ 완료 후 검증

SQL 쿼리로 결과 확인:

```sql
-- 11월 이력 확인 (2025-11-30 종료)
SELECT
    e.name,
    d."departmentName",
    h."effectiveStartDate",
    h."effectiveEndDate",
    h."assignmentReason"
FROM employee_department_position_history h
JOIN employees e ON h."employeeId" = e.id
JOIN departments d ON h."departmentId" = d.id
WHERE h."effectiveEndDate" = '2025-11-30'
ORDER BY e.name;

-- 12월 이력 확인 (2025-12-01 시작)
SELECT
    e.name,
    d."departmentName",
    h."effectiveStartDate",
    h."isCurrent",
    h."assignmentReason"
FROM employee_department_position_history h
JOIN employees e ON h."employeeId" = e.id
JOIN departments d ON h."departmentId" = d.id
WHERE h."effectiveStartDate" = '2025-12-01'
  AND h."isCurrent" = true
ORDER BY e.name;
```

## 📖 조직도 이력 조회 API

### 11월 조직도 조회

11월 조직도를 계층구조로 조회합니다 (조직개편 이전):

```http
GET /migration/org-history/november
```

**응답 예시:**

```json
{
    "effectiveDate": "2025-11-30",
    "description": "2025년 11월 조직도 (조직개편 이전)",
    "totalDepartments": 15,
    "totalEmployees": 73,
    "organization": {
        "departmentId": "uuid",
        "departmentCode": "ROOT",
        "departmentName": "루미르 주식회사",
        "departmentType": "COMPANY",
        "level": 0,
        "parentDepartmentId": null,
        "employees": [],
        "children": [
            {
                "departmentId": "uuid",
                "departmentCode": "MGT",
                "departmentName": "경영지원본부",
                "departmentType": "DIVISION",
                "level": 1,
                "parentDepartmentId": "uuid",
                "employees": [
                    {
                        "employeeId": "uuid",
                        "employeeNumber": "RM001",
                        "employeeName": "남경호",
                        "positionTitle": "실장",
                        "positionCode": "HEAD",
                        "rankName": "이사",
                        "rankCode": "DIR",
                        "isManager": true
                    }
                ],
                "children": []
            }
        ]
    }
}
```

### 12월 조직도 조회

12월 조직도를 계층구조로 조회합니다 (조직개편 이후):

```http
GET /migration/org-history/december
```

**응답 형식:** 11월과 동일한 구조

### 11월-12월 변화 내역 조회

부서 또는 직책이 변경된 직원 목록을 조회합니다:

```http
GET /migration/org-history/changes
```

**응답 예시:**

```json
{
    "totalChanges": 15,
    "departmentChanges": 12,
    "positionChanges": 5,
    "bothChanges": 2,
    "changes": [
        {
            "employeeId": "uuid",
            "employeeNumber": "RM002",
            "employeeName": "이봉은",
            "changeType": "BOTH_CHANGE",
            "november": {
                "departmentName": "경영지원실",
                "departmentCode": "MGT01",
                "positionTitle": "실장",
                "positionCode": "HEAD",
                "rankName": "이사",
                "isManager": true
            },
            "december": {
                "departmentName": "경영지원본부",
                "departmentCode": "MGT",
                "positionTitle": "본부장",
                "positionCode": "GM",
                "rankName": "이사",
                "isManager": true
            }
        }
    ]
}
```

**변화 타입:**

-   `DEPARTMENT_CHANGE`: 부서만 변경
-   `POSITION_CHANGE`: 직책만 변경
-   `BOTH_CHANGE`: 부서와 직책 모두 변경

## 🚀 향후 개선 사항

-   [ ] CSV/Excel 파일로부터 자동 로드
-   [ ] UI에서 11월 데이터 입력 기능
-   [ ] 이력 비교 결과 미리보기
-   [ ] 롤백 기능 추가
-   [ ] 배치 처리 성능 최적화
