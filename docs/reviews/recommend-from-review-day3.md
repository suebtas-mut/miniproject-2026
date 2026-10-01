# Recommendations from Review Day 3 (2026-09-30) — Sprint 2 Close + Sprint 3 Planning

> **Review Date:** 2026-09-30 (Wednesday) · วันที่ปิด Sprint 2  
> **Review Status:** ✅ **PR #5 Approved for Merge** — RPT.R4 gap fixed · OpenAPI PASS · Seed 22 permissions complete  
> **Next Sprint:** Sprint 3 (Backend Skeleton + T-011 Password Fix) — เริ่มต้นวันพฤหัสบดี 2026-10-01

---

## 🎯 Sprint 2 Closure Review

### ✅ Deliverables Accepted

| Task | Status | Notes |
|---|---|---|
| **T-008** | ✅ PASS 20/22 | Seed master + front · 21 perms (now 22 with R4) · BR-01/02/04 verified |
| **T-009** | ✅ ACCEPT 3/5 DoD | Mockup 15 screens · 4 roles · Figma scaffold complete · PNG/ClickUp deferred to Sprint 3 |
| **T-014** | ✅ PASS | OpenAPI 65 endpoint · UC 30/30 · Validator script runnable · RPT.R4 documented & seeded |
| **Sprint Report** | ✅ COMPLETE | `sprint-02-report.md` · `retro/sprint-02.md` · SP delivered 15/10 |
| **Sprint 1 Backfill** | ✅ COMPLETE | Retroactive `sprint-01-report.md` + `retro/sprint-01.md` · Closed documentation gap |

---

## 🔴 Critical Issues Found (Must Fix Sprint 3)

### Issue 1: `password_hash` Incorrect Length & Uniqueness [P0 - Login Blocker]

| Aspect | Finding | Impact | Fix Location |
|---|---|---|---|
| **Length** | 52–54 chars (should be 60) | bcrypt.compare() may throw → API returns 500 instead of 401 | T-011 |
| **Uniqueness** | 4 unique values for 15 users | 11 users share passwords in groups | T-011 |
| **Verification** | Checked on shuttle-oracle-xe | All 15 employees can't login | Must regenerate before Sprint 3 ends |
| **Action** | Generate 15 new bcrypt hashes (cost 10) | Each 60 chars, unique | `npm i bcrypt && node -e "...hashSync(...,10)"`|
| **Plus** | Add try/catch around bcrypt.compare | Handle malformed hash gracefully | Backend login endpoint (UC-01) |
| **Reference** | `docs/reviews/t-007-schema-peer-review-sukhsorn.md` §4 | AR-02 finding · Peer review score 20/22 | Documented |

**Action Item:** 🔴 **T-011 FIRST TASK OF SPRINT 3** · Estimated 1.5 hours (include testing)

---

### Issue 2: Permission `RPT.R4` Gap [NOW FIXED ✅]

**Status Change:** During PR #5 review, found that permission table was missing `RPT.R4`.

✅ **RESOLVED in feature branch** — RPT.R4 now seeded in `database/02_seed_master.sql`:
- Baris 83: `INSERT INTO permission ... ('RPT.R4', 'รายงาน 4 ...', 'report', 'RPT_R4', 53)`
- Total permissions: 21 → **22** ✅
- ADMIN role_permission: 21 → **22** ✅
- STAFF role_permission: 18 → **19** ✅

**Why It Matters:** UC-28 (Report Summary) references RPT.R4 · PDF specifies R1+R4+R6 as primary reports · Without this permission, R4 endpoint would be unreachable.

**Reference:** OpenAPI spec `x-permission: RPT.R4` at `/api/reports/r4` with note explaining the gap and seed fix.

---

## 🗂️ Sprint 3 Planning Recommendations

### Pre-Sprint Checklist (Before 2026-10-01)

```markdown
- [ ] Merge PR #5 into `develop` (all checks pass)
- [ ] Create feature branch `feature/sprint-3-backend-skeleton` from `develop`
- [ ] Confirm T-011 is first task (password_hash generation)
- [ ] Update Node.js from v24 → v20 LTS on both machines
- [ ] Verify all Q-B / Q-20 / Q-F questions listed for instructor follow-up
- [ ] Confirm ClickUp access request sent (for time tracking in Sprint 3)
```

### Sprint 3 Task Queue (Recommended Priority Order)

#### 1️⃣ **T-011: Password Hash Generation** [P0 - BLOCKER]
- **Depends on:** T-008 (seed)
- **Blocks:** T-012 (authentication backend)
- **DoD:**
  - Generate 15 unique bcrypt hashes (cost 10) = 60 chars each
  - Verify `count(distinct password_hash) = 15` on Oracle
  - Add try/catch in `/api/auth/login` to handle malformed hashes
  - All 15 test logins succeed with correct password
  - **Estimated:** 1.5 hours
- **Acceptance Criteria:**
  - Query result: `SELECT COUNT(DISTINCT password_hash) FROM employee` = 15
  - Query result: `SELECT MIN(LENGTH(password_hash)), MAX(LENGTH(password_hash)) FROM employee` = 60, 60
  - Login endpoint returns 401 (not 500) for invalid password

#### 2️⃣ **T-012: REST Endpoints - Auth (UC-01…UC-03)** [P1 - HIGH]
- **Depends on:** T-011 + T-014 (OpenAPI spec ready)
- **Blocks:** All other endpoints
- **Node.js Stack:** Express + node-oracledb + JWT
- **Endpoints:** 4 (login, logout, changePassword, getMe)
- **Estimated:** 3 hours (includes password verification testing)

#### 3️⃣ **T-013: REST Endpoints - Master (UC-04…UC-10)** [P1 - HIGH]
- **Depends on:** T-012 (auth middleware)
- **Blocks:** Frontend integration
- **Endpoints:** 18 (Employee, Department, Position, RBAC)
- **Key Challenge:** RBAC middleware must verify permissions from DB every request (not JWT)
- **Estimated:** 4 hours

#### 4️⃣ **T-055: REST Endpoints - Report (UC-27…UC-30)** [P1 - HIGH]
- **Depends on:** T-012 + T-014
- **Endpoints:** 5 (R1, R4, R6, R2, R3, R5, R7 + export)
- **Note:** R4 uses `PIVOT` query (example in `chapter-17`)
- **Estimated:** 3.5 hours

#### Future Tasks (Sprint 4+)
- T-010 (DFD + Diagrams)
- T-013 (Flutter setup)
- T-017…T-032 (Frontend implementation)

---

## 📋 Agile Process Improvements for Sprint 3

### From Retro Findings (Sprint 1 & 2)

| Finding | Action for Sprint 3 | Owner | Priority |
|---|---|---|---|
| **DoR "≤ 3 hours" not realistic** | Adjust estimates based on actual Sprint 2 data (T-008 4h, T-009 6.5h, T-014 3.5h) | Scrum Master | HIGH |
| **Git author uses single account** | Continue with current setup (no rewrite) · document in sprint-03-plan.md as known limitation | Both | INFO |
| **ClickUp access** | Request access BEFORE Sprint 3 planning if possible · fallback: continue logging in `docs/agile/standup/` | Team | MEDIUM |
| **Conflict in `ai-credit-log.md`** | Already fixed · continue same BOM handling + no conflict markers | Both | DONE |
| **R4 permission gap** | ✅ Fixed in seed · Verify on live DB after merge | Both | VERIFY |
| **Stand-up frequency** | Maintain daily standup (3/14 completed so far) · aim for every business day | Both | HIGH |
| **Retro documentation** | Write retro SAME DAY as sprint ends (not retroactively) | Both | HIGH |

---

## 📊 Sprint 3 Goals & Success Criteria

### Primary Goal
**Deliver Backend Skeleton for Authentication + Master Module REST APIs**  
→ Unblock frontend integration in Sprint 4

### Definition of Success
- ✅ All 4 auth endpoints (UC-01…UC-03) working with proper password verification
- ✅ T-011 fixes password_hash with 15 unique bcrypt hashes
- ✅ Dynamic RBAC middleware validates `role_permission` from DB on each request
- ✅ At least 10 endpoints tested with Postman / curl (not just code review)
- ✅ Node.js v20 LTS installed and confirmed compatible
- ✅ Sprint report + retro written BEFORE Sprint 4 starts

### Risk Mitigation
| Risk | Mitigation |
|---|---|
| Password bcrypt fails silently | Add explicit try/catch + log error code + return 401 consistently |
| RBAC lookup too slow | Cache `role_permission` for 5 min per session · benchmark |
| node-oracledb connection fails | Test connection pool during server startup · fail fast |
| Time estimate still wrong | Track actual hours in ClickUp (priority: request access) |

---

## 🔗 Reference Links & Prerequisite Docs

| Document | Purpose | Status |
|---|---|---|
| `docs/api/openapi.yaml` | Contract for all 65 endpoints | ✅ Delivered in T-014 |
| `scripts/validate-openapi.py` | Automated validator | ✅ Executable · warns on R4 gap (now fixed) |
| `database/01_schema.sql` | Oracle schema (20 tables) | ✅ 13/13 peer review PASS |
| `database/02_seed_master.sql` | Seed data (22 perms, 15 employees) | ✅ Now with RPT.R4 |
| `chapter-17-fullstack.md` §17.5 | Endpoint list + business rules | ✅ Matches OpenAPI |
| `chapter-17-fullstack.md` §17.5.1 | Response envelope format | ✅ Spec includes examples |
| `docs/diagrams/usecase/usecase-spec.md` | UC-01…UC-30 requirements | ✅ 30/30 covered by endpoints |

---

## 🚀 Sprint 3 Setup Instructions (Checklist)

### For Both Team Members
```bash
# 1. Merge PR #5 into develop (GitHub)
#    PR #5 shows "Mergeable: true" — merge via GitHub UI or:
git checkout develop
git pull origin develop
# (PR already merged via GitHub, then pull)

# 2. Create feature branch for Sprint 3
git checkout -b feature/sprint-3-backend-skeleton

# 3. Verify seed data with password fix
sqlplus shuttle_app/<password>@localhost:1521/XEPDB1
> @database/99_drop_schema.sql
> @database/01_schema.sql
> @database/02_seed_master.sql
> @database/03_seed_front.sql
> SELECT COUNT(*) FROM permission WHERE module='report'; -- Should return 7 (R1…R7 with R4)
> SELECT COUNT(DISTINCT password_hash) FROM employee; -- Should return 15

# 4. Update Node.js
nvm install 20
nvm use 20
node --version  # v20.x.x

# 5. Create Sprint 3 planning doc
touch docs/agile/sprints/sprint-03-plan.md
# (Use template from sprint-02-plan.md)
```

### For Kaengkarn (Backend)
```bash
# Install node-oracledb + Express
npm install express node-oracledb dotenv
npm install -D nodemon jest

# Create server scaffold
mkdir -p src/routes src/middleware src/utils
touch src/server.js src/middleware/auth.js src/utils/db.js

# Start with T-011: Password hash generation
node scripts/generate-bcrypt-hashes.js > /tmp/hashes.txt
# (Review output, verify 15 lines of 60-char hashes)
```

### For Sukhsorn (Frontend / Docs)
```bash
# Update Flutter mockup for Sprint 3
cd docs/mockup
# (Coordinate timing to avoid export vs edit conflicts)

# Prepare test plan for backend validation
touch docs/testing/sprint-03-postman.md
# (List test cases for all endpoints T-011/T-012/T-013/T-055)
```

---

## 📝 Files to Create/Update Before Sprint 3 Starts

| File | Type | Purpose |
|---|---|---|
| `docs/agile/sprints/sprint-03-plan.md` | 📄 NEW | Sprint goals + task breakdown + estimates |
| `docs/agile/standup/2026-10-01.md` | 📄 NEW | Day 4 standup (first of Sprint 3) |
| `scripts/generate-bcrypt-hashes.js` | 💻 NEW | Generate 15 unique bcrypt hashes for T-011 |
| `src/server.js` | 💻 NEW | Express entry point (scaffolded in T-012) |
| `docs/testing/sprint-03-postman.md` | 📄 NEW | Test cases for endpoints |
| `.env.example` | ✏️ UPDATE | Add `BCRYPT_COST=10` · `JWT_SECRET` · `DB_*` (already sanitized in Sprint 0) |

---

## ✅ Sign-Off

**Sprint 2 Closed:** 2026-09-30 · Delivered 2/3 Task + Retro/Report  
**PR #5 Status:** ✅ Ready to merge  
**Sprint 3 Kickoff:** 2026-10-01 (Thursday)  
**First Priority:** T-011 Password Hash Fix (1.5 hours) → Unblocks T-012 (Auth)

---

> 📌 **Next Steps:**
> 1. ✅ Merge PR #5 into `develop`
> 2. 🎯 Create `feature/sprint-3-backend-skeleton` branch
> 3. 🚀 Begin T-011 on 2026-10-01 morning
> 4. 📋 Keep standup + retro cadence (daily standup, retro on sprint close day)
> 5. 🔄 Update this file during Sprint 3 as new blockers emerge
