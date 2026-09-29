# คู่มือติดตั้งฐานข้อมูล Oracle XE (Docker) — ฉบับสำหรับคนที่เพิ่งเริ่ม

> **Task:** T-001 · **Sprint:** 0 · **ผู้รับผิดชอบ:** นายเก่งกาญ เชี่ยวชาญ
> **อ้างอิง:** `docs/chapter-17-fullstack.md` (17.0, 17.2, 17.5.3) · `docs/chapter-18-development-plan.md` (18.6 Sprint 0)
> **ไฟล์ที่เกี่ยวข้อง:** `docker-compose.yaml` · `.env.example` · `backend/.env.example`

---

## 0. สรุปสั้น ๆ (TL;DR)

เราจะรัน Oracle ใน **Docker container** แทนการติดตั้ง Oracle ลง Windows ตรง ๆ
เหตุผล: ติดตั้งง่ายกว่ามาก, ถอนออกง่าย, ไม่กระทบเครื่อง, และทำให้ "รีเซ็ตฐานข้อมูล" ได้ใน 1 คำสั่ง

| ข้อมูล | ค่า |
|---|---|
| Docker image | `gvenzl/oracle-xe:21-slim` |
| Container name | `shuttle-oracle-xe` |
| Host | `localhost` |
| Port | `1521` |
| **Service name (สำคัญมาก)** | **`XEPDB1`** |
| User ของแอป | `SHUTTLE_APP` |
| เก็บข้อมูลถาวร | Docker volume ชื่อ `shuttle-oracle-xe-data` |

> ### 🤔 ทำไมเป็น 21c ไม่ใช่ 19c?
> เอกสารบทที่ 17 ระบุฐานข้อมูลเป็น **Oracle 19c** แต่มีหมายเหตุกำกับว่า *"ทดสอบได้ทั้ง 21c / XE"*
> เมื่อตรวจสอบจริงจาก Docker Hub (28 ก.ย. 2026) พบว่า:
>
> - `gvenzl/oracle-xe` มีเฉพาะ **21.3.0 / 18.4.0 / 11.2.0.2** — **ไม่มี 19c**
> - `oracle/database-express` (Docker Hub) — **ไม่มีอยู่จริง (404)**
> - Oracle XE 19c จริง ๆ อยู่ที่ `container-registry.oracle.com/database/xe:19.3.0` ซึ่ง **ต้องสมัคร Oracle Account + ยอมรับ license + `docker login`** ก่อน
>
> ดังนั้นทีมเลือก **XE 21c** ซึ่งเป็นตัวเดียวที่ตรงตามเอกสาร (XE = Express Edition) และติดตั้งง่ายที่สุด
> **DDL/SQL ที่เก่งกาญจะเขียนใน T-007 ใช้ได้กับทั้ง 19c และ 21c** (ไม่มี syntax ที่ต่างกันในสิ่งที่โจทย์ใช้)

---

## 1. สิ่งที่ต้องมีก่อน (Prerequisites)

### 1.1 ตรวจว่ามี Docker Desktop แล้วหรือยัง

เปิด **PowerShell** แล้วพิมพ์:

```powershell
docker version
```

- ถ้าเห็นทั้ง `Client` และ `Server` → พร้อมแล้ว ข้ามไปข้อ 1.2
- ถ้าขึ้น `error during connect ... the system cannot find the file specified` → **Docker Desktop ยังไม่ได้เปิด** ให้เปิดโปรแกรม Docker Desktop แล้วรอจนไอคอนปลาเขียว

> ถ้ายังไม่มี Docker Desktop เลย → ดาวน์โหลดจาก <https://www.docker.com/products/docker-desktop/> แล้วติดตั้ง (เลือก Windows 64-bit)
> **ต้องเปิดใช้งาน WSL 2** ระหว่างติดตั้ง (ตัวติดตั้งจะถามให้ restart เครื่อง)

### 1.2 ตั้งหน่วยความจำให้ Docker (สำคัญมาก)

Oracle XE ต้องการ RAM **อย่างน้อย 2 GB** (แนะนำ 4 GB) และดิสก์ประมาณ **10 GB**

1. คลิกขวาไอคอน Docker Desktop บน taskbar (ทางขวาล่าง) → **Settings**
2. ไปแท็บ **Resources** → ตั้ง **Memory = 4 GB** (ถ้าเครื่องมี RAM 8 GB ขึ้นไป)
3. ตั้ง **Disk image size = 20 GB** (ขั้นต่ำ 10 GB)
4. กด **Apply & restart**

> ⏳ **ครั้งแรกจะใช้เวลานาน** — ต้องดาวน์โหลด image ประมาณ 1.4 GB และสร้างฐานข้อมูลครั้งแรกประมาณ **5–15 นาที**
> ครั้งที่ 2 เปิดเร็วมาก (ไม่กี่วินาที) เพราะมี volume เก็บข้อมูลไว้แล้ว

---

## 2. ตั้งค่ารหัสผ่าน (Password Setup)

> ⛔ **กฎเหล็กของโปรเจกต์ (AR-03):** รหัสผ่านจริง **ห้ามขึ้น Git** เด็ดขาด
> เราจึงเก็บรหัสผ่านไว้ในไฟล์ `.env` ซึ่งถูก `.gitignore` ไว้แล้ว
> ไฟล์ตัวอย่างสำหรับคนอื่นคือ `.env.example` (ตัวนี้**ขึ้น Git ได้** เพราะไม่มีรหัสจริง)

### 2.1 กฎของรหัสผ่าน Oracle 12.2+

รหัสผ่านที่ Oracle รับได้ต้องมี **ครบทั้ง 4 ข้อ**:

| ข้อ | ต้องมี |
|---|---|
| 1 | ยาวอย่างน้อย **8 ตัวอักษร** |
| 2 | ตัวอักษรใหญ่ **A-Z** อย่างน้อย 1 |
| 3 | ตัวอักษรเล็ก **a-z** อย่างน้อย 1 |
| 4 | ตัวเลข **0-9** อย่างน้อย 1 |

> ถ้าไม่ครบ container จะ **error ทันทีตอน start** และขึ้นว่า `DPY-0024` หรือ `password is too simple`
> 💡 ถ้าอยากได้รหัสผ่านยาก ๆ ให้รัน: `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`
> ⚠️ ถ้าใช้ตัวสุ่ม อาจได้อักขระ `/ + =` ซึ่งทำให้เขียนใน connect string ยาก แนะนำให้**พิมพ์เอง**แทน

### 2.2 สร้างไฟล์ `.env`

ในโฟลเดอร์รากโปรเจกต์ (ที่ที่มีไฟล์ `docker-compose.yaml`) รัน:

```powershell
copy .env.example .env
notepad .env
```

แก้ไฟล์ `.env` ให้เป็นแบบนี้ (**เปลี่ยนรหัสผ่านเป็นของคุณเอง**):

```ini
ORACLE_PASSWORD=<รหัสผ่านของ SYS/SYSTEM ตามกฎข้อ 2.1>
APP_USER=SHUTTLE_APP
APP_USER_PASSWORD=<รหัสผ่านของ APP_USER ตามกฎข้อ 2.1>
```

ตัวอย่างรูปแบบ (ห้ามใช้ตัวนี้จริง — เป็นแค่ตัวอย่าง):

```ini
ORACLE_PASSWORD=Xy7#OracleDev
APP_USER=SHUTTLE_APP
APP_USER_PASSWORD=Xy7#ShuttleDev
```

### 2.3 ⚠️ ต้องแจ้งรหัสผ่านให้ทีมรู้

`SHUTTLE_APP` คือ user ที่ **Backend (เก่งกาญ) และเครื่องของสุขสรร** จะใช้เชื่อมต่อ
→ **ค่า `APP_USER` และ `APP_USER_PASSWORD` ต้องตรงกันทุกเครื่องในทีม**
→ และต้องตรงกับ `DB_USER` / `DB_PASS` ในไฟล์ `backend/.env` (ดูข้อ 6)

> ถ้าเปลี่ยนรหัสผ่านภายหลัง → ต้อง **รีเซ็ตฐานข้อมูลใหม่ทั้งหมด** (ดูข้อ 8.3) เพราะรหัสผ่านถูกตั้งค่าตอนสร้างฐานข้อมูลครั้งแรกเท่านั้น

---

## 3. เริ่มฐานข้อมูล

### 3.1 สั่ง start

```powershell
docker compose up -d
```

คำสั่งนี้จะ: ดาวน์โหลด image (ครั้งแรกประมาณ 1.4 GB) → สร้าง container → เริ่มสร้างฐานข้อมูล

### 3.2 ดู log เพื่อรอให้เสร็จ

```powershell
docker compose logs -f oracle-xe
```

**รอจนกว่าจะเห็นข้อความนี้** (ใช้เวลา 5–15 นาทีครั้งแรก):

```
#########################
DATABASE IS READY TO USE!
#########################
```

กด `Ctrl + C` เพื่อออกจากการดู log (ไม่ปิด container)

> ตารางด้านเวลาโดยประมาณ:
> | ขั้นตอน | เวลา |
> |---|---|
> | ดาวน์โหลด image | 3–15 นาที (ขึ้นกับอินเทอร์เน็ต) |
> | สร้างฐานข้อมูลครั้งแรก | 3–10 นาที |
> | เปิดครั้งถัดไป (มี volume แล้ว) | 20–60 วินาที |

### 3.3 ตรวจสถานะ

```powershell
docker compose ps
```

ผลลัพธ์ที่ถูกต้อง — คอลัมน์ `STATUS` ต้องขึ้น `(healthy)`:

```
NAME                 IMAGE                        STATUS                  PORTS
shuttle-oracle-xe    gvenzl/oracle-xe:21-slim     Up 2 minutes (healthy)  0.0.0.0:1521->1521/tcp
```

---

## 4. ทดสอบเชื่อมต่อ (Verification) — สำคัญที่สุด

> ✅ **DoD ของ T-001** คือ *"`sqlplus` เชื่อมต่อ Oracle ได้"*
> เราไม่ต้องติดตั้ง Oracle Client บน Windows เพราะ **image มี `sqlplus` มาให้ใน container แล้ว**

### 4.1 วิธีที่ 1 — ใช้ `sqlplus` ใน container (แนะนำ ไม่ต้องติดตั้งอะไรเพิ่ม)

เปิด shell ใน container แบบ interactive:

```powershell
docker exec -it shuttle-oracle-xe bash
```

จะเห็น prompt `bash-5.1$` แล้วพิมพ์:

```bash
sqlplus -s SHUTTLE_APP/"<APP_USER_PASSWORD ของคุณ>"@//localhost/XEPDB1
```

> ถ้ารหัสผ่านมีอักขระพิเศษ (เช่น `#` `!` `$`) ให้ครอบด้วย `"` เสมอ
> ถ้าเชื่อมต่อสำเร็จจะเห็น:

```
Connected to:
Oracle Database 21c Express Edition Release 21.0.0.0.0 - Production
Version 21.0.0.0.0

SQL>
```

พิมพ์คำสั่งตรวจสอบ:

```sql
SELECT banner FROM v$version;
SELECT name, open_mode FROM v$pdbs;
SELECT COUNT(*) AS table_count FROM user_tables;
EXIT;
```

`table_count` ตอนนี้ควรเป็น **0** (ยังไม่ได้รัน `01_schema.sql`)

### 4.2 วิธีที่ 2 — รันคำสั่งเดียวไม่ต้องเข้า shell (เหมาะกับการเช็คอัตโนมัติ)

```powershell
"SELECT value FROM v$version WHERE ROWNUM = 1; EXIT;" | docker exec -i shuttle-oracle-xe sqlplus -s SHUTTLE_APP/YourPass123@//localhost/XEPDB1
```

> ⚠️ เปลี่ยน `YourPass123` เป็นรหัสผ่านจริงของคุณ
> ⚠️ เครื่องหมาย `$` ใน `v$version` ต้องพิมพ์ตามนี้ ไม่งั้น PowerShell จะพยายามอ่านเป็นตัวแปร

### 4.3 วิธีที่ 3 — เชื่อมต่อจาก Node.js (ตรวจว่า Backend จะต่อได้จริง)

> ตรวจสอบว่า `node-oracledb` แบบ **Thin mode** (ไม่ต้องติดตั้ง Oracle Client) เชื่อมต่อได้จริง

```powershell
cd backend
npm install oracledb dotenv
```

สร้างไฟล์ชั่วคราว `backend/test-db.js`:

```javascript
require('dotenv').config();
const oracledb = require('oracledb');

(async () => {
  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE_NAME}`
  });
  const r = await conn.execute('SELECT banner FROM v$version WHERE ROWNUM = 1');
  console.log('CONNECT OK ->', r.rows[0].BANNER);
  await conn.close();
})().catch(e => { console.error('CONNECT FAILED ->', e.message); process.exit(1); });
```

รัน: `node test-db.js` (ต้องมีไฟล์ `backend/.env` ตามข้อ 6 ก่อน)
ลบทิ้งหลังทดสอบเสร็จ: `Remove-Item test-db.js`

---

## 5. สร้าง User เพิ่มเติม (ถ้าจำเป็น)

ถ้าภายหลังต้องการ user เพิ่ม (เช่น user สำหรับ read-only report) โดย **ไม่ต้องรีเซ็ตฐานข้อมูล**:

```powershell
docker exec -it shuttle-oracle-xe createAppUser REPORT_READONLY ReportOnly2026#1
```

- User จะถูกสร้างใน PDB `XEPDB1` และได้สิทธิ์ `CONNECT` + `RESOURCE` อัตโนมัติ

> ตรวจสอบรายชื่อ user ทั้งหมด:
> ```powershell
> "SELECT username FROM dba_users ORDER BY username; EXIT;" | docker exec -i shuttle-oracle-xe sqlplus -s SYSTEM/"<ORACLE_PASSWORD ของคุณ>"@//localhost/XEPDB1
> ```

---

## 6. เชื่อม Backend เข้ากับฐานข้อมูล

### 6.1 สร้าง `backend/.env`

```powershell
cd backend
copy .env.example .env
notepad .env
```

แก้ 2 บรรทัดนี้ให้ตรงกับ `.env` ระดับ root:

```ini
DB_USER=SHUTTLE_APP
DB_PASS=<APP_USER_PASSWORD เดียวกับใน .env ระดับ root>
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE_NAME=XEPDB1
```

> 🔑 **จุดที่คนพลาดบ่อยที่สุด — เรื่อง SID กับ Service Name**
> - `XEPDB1` คือ **Service Name** ของ **Pluggable Database** (PDB) → ใช้ตัวนี้
> - `XE` คือ **SID** ของ **Container Database (CDB$ROOT)** → เชื่อมได้ แต่จะไม่เจอตารางของแอป
> - `node-oracledb` จะตีความส่วนหลัง `/` เป็น **Service Name** → ต้องใส่ `XEPDB1`
> - ถ้าใส่ผิดจะได้ error `DPY-6003: SID "..." is not registered with the listener`

### 6.2 ตรวจว่าไฟล์ถูก ignore แล้ว

```powershell
git status --short
```

**ต้องไม่เห็น `backend/.env` หรือ `.env` ในรายการ** ถ้าเห็น → หยุดและแจ้งทันที เพราะเสี่ยง commit รหัสผ่านขึ้น Git

---

## 7. วิธีรัน `01_schema.sql` ในอนาคต (เตรียมไว้ล่วงหน้า)

> `database/01_schema.sql` คือ DDL ของ Oracle ซึ่งจะเขียนใน **T-007 (Sprint 1)**
> วิธีรันที่ถูกต้องคือ **รันด้วย user ของแอป (`SHUTTLE_APP`)** ไม่ใช่ `SYSTEM` เพราะ DDL ใน 17.4.3 สร้างตารางทั้งหมดใน schema ของ user

### วิธีที่ 1 — copy ไฟล์เข้า container แล้วรันด้วย `@` (แนะนำ)

```powershell
docker cp database/01_schema.sql shuttle-oracle-xe:/tmp/01_schema.sql
docker exec -it shuttle-oracle-xe sqlplus -s SHUTTLE_APP/"<APP_USER_PASSWORD>"@//localhost/XEPDB1 @/tmp/01_schema.sql
```

> ถ้า script ไม่มี `EXIT;` ท้ายไฟล์ ให้เติมเองก่อนรัน

### วิธีที่ 2 — ส่งท่อจาก PowerShell (ไม่ต้อง copy ไฟล์)

```powershell
Get-Content database/01_schema.sql -Raw | docker exec -i shuttle-oracle-xe sqlplus -s SHUTTLE_APP/"<APP_USER_PASSWORD>"@//localhost/XEPDB1
```

### วิธีที่ 3 — ใส่ไฟล์ SQL ไว้ใน container ตั้งแต่แรก (init script)

ถ้าต้องการให้ฐานข้อมูลถูกสร้างพร้อมตารางตั้งแต่ครั้งแรกที่รัน container
ให้ mount โฟลเดอร์ `database/` เข้า path `initdb` ของ container:

```yaml
    volumes:
      - oracle-xe-data:/opt/oracle/oradata
      - ./database:/container-entrypoint-initdb.d:ro   # เพิ่มบรรทัดนี้
```

> ⚠️ **ข้อควรระวังสำคัญ**
> - init script จะถูกรัน **เฉพาะครั้งแรกที่สร้างฐานข้อมูล** เท่านั้น (แก้ไฟล์ทีหลังจะไม่มีผล ต้องรีเซ็ต)
> - script จะถูกรัน **ในฐานะ SYS ของ instance `XE`** ไม่ใช่ใน `SHUTTLE_APP`
>   → ต้องเริ่มไฟล์ด้วย `ALTER SESSION SET CONTAINER=XEPDB1;` แล้วจึงเชื่อมต่อเป็น `SHUTTLE_APP` เพื่อสร้างตาราง
> - ถ้าไฟล์ `.sql` มีวันนำหน้าเป็นตัวเลข (`01_`, `02_`, ...) Docker จะรันตามลำดับชื่อไฟล์

### 7.1 ตรวจว่า DDL สำเร็จ

```powershell
"SELECT table_name FROM user_tables ORDER BY table_name; EXIT;" | docker exec -i shuttle-oracle-xe sqlplus -s SHUTTLE_APP/<APP_USER_PASSWORD>@//localhost/XEPDB1
```

ต้องได้ 19 ตาราง ตาม 17.4.1: `department`, `job_position`, `employee`, `app_role`, `permission`, `role_permission`, `employee_role`, `token_blacklist`, `stop`, `route`, `route_stop`, `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign`, `booking`, `trip`, `trip_passenger`

---

## 8. คำสั่งใช้งานบ่อย ๆ / แก้ปัญหา

### 8.1 คำสั่งที่ใช้ทุกวัน

| ความต้องการ | คำสั่ง |
|---|---|
| เปิดฐานข้อมูล | `docker compose up -d` |
| ดู log | `docker compose logs -f oracle-xe` |
| ดูสถานะ | `docker compose ps` |
| เข้า shell ใน container | `docker exec -it shuttle-oracle-xe bash` |
| เข้า sqlplus เป็น user แอป | `docker exec -it shuttle-oracle-xe sqlplus -s SHUTTLE_APP/<รหัสผ่าน>@//localhost/XEPDB1` |
| ปิด (เก็บข้อมูลไว้) | `docker compose stop` |
| ปิดถาวร (เก็บข้อมูลไว้) | `docker compose down` |
| ⛔ **ลบข้อมูลทิ้งทั้งหมด** | `docker compose down -v` |

> ⚠️ `docker compose down -v` = **ลบฐานข้อมูลทั้งหมดถาวร** ข้อมูลทุกอย่างหาย
> ใช้เฉพาะเวลาจะเริ่มใหม่จริง ๆ เช่น หลังเปลี่ยนรหัสผ่าน

### 8.2 แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| `error during connect ... The system cannot find the file specified` | Docker Desktop ยังไม่ได้เปิด → เปิดแล้วรอจนไอคอนปลาเขียว |
| `Ports are not available: 1521` | มีอย่างอื่นใช้ port 1521 → `netstat -ano \| findstr :1521` แล้วปิดมัน หรือเปลี่ยนเป็น `"1522:1521"` ใน `docker-compose.yaml` (แล้วแก้ `DB_PORT=1522` ใน `backend/.env` ด้วย) |
| Container เปิดแต่ STATUS เป็น `starting` ค้างนาน | ยังไม่เสร็จ — ครั้งแรกใช้เวลานาน ให้ดู log และรออย่างน้อย 5–15 นาที |
| `DPY-0024: a password is too simple` | รหัสผ่านไม่ผ่านกฎข้อ 2.1 → แก้ใน `.env` แล้วทำ **ข้อ 8.3** |
| `DPY-6003: SID "..." is not registered with the listener` | ใส่ SID ผิด → ต้องใช้ **Service name** คือ `XEPDB1` (ดูข้อ 6.1) |
| `container is unhealthy` | `docker compose logs oracle-xe` แล้วอ่านบรรทัด error ท้าย ๆ |
| เครื่องค้าง / แรมเต็ม | เพิ่ม RAM ใน Docker Desktop เป็น 4 GB (ข้อ 1.2) |
| `docker compose` ไม่รู้จักคำสั่ง | Docker Desktop เวอร์ชันเก่า → ใช้ `docker-compose` (ติดตั้งแบบเดิม) แทน |

### 8.3 เปลี่ยนรหัสผ่าน (ต้องลบฐานข้อมูลใหม่ทั้งหมด)

รหัสผ่านถูกตั้งค่าตอนสร้างฐานข้อมูลครั้งแรกเท่านั้น **แก้ `.env` แล้ว restart ไม่ได้ผล**

```powershell
docker compose down -v
docker compose up -d
```

> ⏔ ต้องแน่ใจว่าไม่มีข้อมูลที่ต้องการเก็บไว้ก่อนรัน (ในโปรเจกต์เราใช้ seed data จาก `database/*.sql` เสมอ จึงรีเซ็ตได้โดยไม่เสียหาย)

### 8.4 ถ้าต้องการ reset เฉพาะรหัสผ่าน SYS/SYSTEM โดยไม่ลบข้อมูล

```powershell
docker exec -it shuttle-oracle-xe resetPassword <รหัสผ่านใหม่>
```

---

## 9. ✅ Definition of Done ของ T-001 (เช็กก่อนบอกว่าเสร็จ)

เช็กตามนี้ทีละข้อ ถ้าข้อไหนยังไม่ผ่าน **ห้ามบอกว่างานเสร็จ**

- [ ] `docker compose ps` แสดง `Up (healthy)`
- [ ] log แสดง `DATABASE IS READY TO USE!`
- [ ] `sqlplus` เข้า `SHUTTLE_APP` ที่ `//localhost/XEPDB1` ได้
- [ ] `SELECT banner FROM v$version` คืนค่า `Oracle Database 21c Express Edition`
- [ ] `SELECT COUNT(*) FROM user_tables` คืนค่า `0` (ยังไม่ได้รัน DDL)
- [ ] `git status` **ไม่แสดง** ไฟล์ `.env` ใด ๆ
- [ ] เพื่อน (สุขสรร) รัน `docker compose up -d` บนเครื่องตัวเองแล้วเชื่อมต่อได้ด้วย user/password ชุดเดียวกัน

---

## 10. สรุปข้อมูลสำหรับนำไปใส่รายงาน / สอบอาจารย์

> **ระบบใช้ฐานข้อมูล Oracle Database 21c Express Edition (XE) รันบน Docker container**
> เป็นฐานข้อมูลแบบ Relational ที่รองรับ Transaction, Locking, Analytic Functions (`OVER/PARTITION BY`),
> `PIVOT`, `ROLLUP`, `LISTAGG`, `FORALL` และ PL/SQL ซึ่งเป็นความสามารถทั้งหมดที่ระบบรายงาน R1 / R4 / R6 ต้องใช้

**สิ่งที่ตรวจสอบแล้วว่าไม่มี 19c ให้ใช้ง่าย:**
`gvenzl/oracle-xe` มีเฉพาะ 21.3.0 / 18.4.0 / 11.2.0.2 · `oracle/database-express` ไม่มีบน Docker Hub ·
Oracle XE 19c ต้องดึงจาก Oracle Container Registry และต้องสมัครบัญชี Oracle พร้อมยอมรับสัญญาอนุญาต
→ จึงเลือก **XE 21c** ซึ่งสอดคล้องกับเอกสารข้อ 17.0 ที่ระบุ *"ทดสอบได้ทั้ง 21c / XE"*

---

## แหล่งอ้างอิง

- Docker Hub — gvenzl/oracle-xe: <https://hub.docker.com/r/gvenzl/oracle-xe>
- Oracle Docs — เชื่อมต่อ Oracle Database XE (service name `XEPDB1`): <https://docs.oracle.com/en/database/oracle/oracle-database/21/xeinw/connecting-oracle-database-xe.html>
- เอกสารโปรเจกต์ — `docs/chapter-17-fullstack.md` ข้อ 17.0 / 17.2 / 17.5.3
