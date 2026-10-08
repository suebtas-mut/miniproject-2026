-- ==================================================================
--  01_schema.sql  —  ORACLE 19c  (รองรับ 21c XE ด้วย)
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  Task      : T-007 (Sprint 1) — เจ้าของ: นายเก่งกาญ เชี่ยวชาญ
--  แหล่งอ้างอิง (ตามลำดับความสำคัญ):
--    1) docs/chapter-17-fullstack.md ข้อ 17.4.3  — DDL ต้นทาง (authoritative)
--    2) docs/report/chapter-08-data-dictionary.md ข้อ 8.9 — COMMENT ON ฉบับเต็ม
--    3) docs/diagrams/er/er-03..05-physical-*.puml — Physical ER
--
--  สิ่งที่ไฟล์นี้สร้าง:
--    ตาราง 21 · คอลัมน์ 110 · Sequence 1 · Index 8 (ดัชนีที่ 9 ตาม 8.8 ถูกตัดเพราะซ้ำ)
--    Constraint 78 = PK 21 + UNIQUE 18 + CHECK 12 + FK 27 (CASCADE 10 / RESTRICT 17)
--    COMMENT ON 131 = TABLE 21 + COLUMN 110
--
--  วิธีรัน (SQL*Plus / SQLcl)
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @01_schema.sql
--    หรือ  sqlplus / as sysdba @01_schema.sql
--
--  ⚠ เงื่อนไขก่อนรัน
--    1) ฐานข้อมูลต้องสร้างด้วย Character Set = AL32UTF8
--       เพราะ COMMENT ON ด้านล่างเป็นภาษาไทย ถ้าเป็นชุดอักขระอื่นจะเพี้ยน
--       ตรวจด้วย: SELECT value FROM nls_database_parameters
--                  WHERE parameter = 'NLS_CHARACTERSET';
--    2) Q14 (ยังค้างรออาจารย์ยืนยัน) — Requirement ระบุ Oracle 19c
--       แต่เครื่องนี้ติดตั้ง 21c XE ได้เท่านั้น
--       → ไฟล์นี้ใช้ได้ทั้งสองเวอร์ชัน เพราะทุกฟีเจอร์ที่ใช้
--         (IDENTITY, VARCHAR2(n CHAR), CHECK, COMMENT ON) มีตั้งแต่ 12c เป็นต้นมา
--    3) รันบนสคีมาที่ยังไม่มีตารางอยู่แล้ว (user_tables = 0)
--       ถ้ารันซ้ำให้รัน 99_drop_schema.sql ก่อน
-- ==================================================================


-- ==================================================================
--  กลุ่ม MASTER : บุคคลและสิทธิ์  (8 ตาราง / 35 คอลัมน์)
-- ==================================================================

CREATE TABLE department (
  dept_id    NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  dept_name  VARCHAR2(120 CHAR) NOT NULL,
  created_at TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_department            PRIMARY KEY (dept_id),
  CONSTRAINT uq_department_name      UNIQUE (dept_name)
);

CREATE TABLE job_position (
  position_id   NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  position_name VARCHAR2(120 CHAR) NOT NULL,
  CONSTRAINT pk_job_position  PRIMARY KEY (position_id),
  CONSTRAINT uq_position_name UNIQUE (position_name)
);

CREATE TABLE employee (
  emp_id        NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  emp_code      VARCHAR2(20 CHAR)  NOT NULL,
  first_name    VARCHAR2(80 CHAR)  NOT NULL,
  last_name     VARCHAR2(80 CHAR)  NOT NULL,
  phone         VARCHAR2(20 CHAR),
  email         VARCHAR2(120 CHAR),
  dept_id       NUMBER(10),
  position_id   NUMBER(10),
  username      VARCHAR2(50 CHAR)  NOT NULL,
  password_hash VARCHAR2(200 CHAR) NOT NULL,   -- bcrypt
  is_active     NUMBER(1)      DEFAULT 1 NOT NULL,
  created_at    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_employee        PRIMARY KEY (emp_id),
  CONSTRAINT uq_employee_code   UNIQUE (emp_code),
  CONSTRAINT uq_employee_user   UNIQUE (username),
  CONSTRAINT ck_employee_active CHECK (is_active IN (0,1)),
  CONSTRAINT fk_employee_dept     FOREIGN KEY (dept_id)     REFERENCES department(dept_id),
  CONSTRAINT fk_employee_position FOREIGN KEY (position_id) REFERENCES job_position(position_id)
);

CREATE TABLE app_role (            -- 'role' เป็นคำสงวนของ Oracle
  role_id     NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  role_name   VARCHAR2(50 CHAR)  NOT NULL,
  description VARCHAR2(255 CHAR),
  is_active   NUMBER(1)      DEFAULT 1 NOT NULL,
  CONSTRAINT pk_app_role        PRIMARY KEY (role_id),
  CONSTRAINT uq_app_role        UNIQUE (role_name),
  CONSTRAINT ck_app_role_active CHECK (is_active IN (0,1))
);

CREATE TABLE permission (
  perm_id    NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  perm_code  VARCHAR2(80 CHAR)  NOT NULL,   -- เช่น 'ROUTE.EDIT'
  perm_name  VARCHAR2(120 CHAR) NOT NULL,
  module     VARCHAR2(50 CHAR)  NOT NULL,   -- master | front | booking | driver | report
  screen_key VARCHAR2(80 CHAR),              -- รหัสหน้าจอ ใช้สร้าง Dynamic Menu
  sort_no    NUMBER(5)       DEFAULT 0 NOT NULL,
  CONSTRAINT pk_permission  PRIMARY KEY (perm_id),
  CONSTRAINT uq_perm_code   UNIQUE (perm_code)
);

CREATE TABLE role_permission (
  role_id NUMBER(10) NOT NULL,
  perm_id NUMBER(10) NOT NULL,
  CONSTRAINT pk_role_perm PRIMARY KEY (role_id, perm_id),
  CONSTRAINT fk_rp_role   FOREIGN KEY (role_id) REFERENCES app_role(role_id)   ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm   FOREIGN KEY (perm_id) REFERENCES permission(perm_id) ON DELETE CASCADE
);

CREATE TABLE employee_role (
  emp_id  NUMBER(10) NOT NULL,
  role_id NUMBER(10) NOT NULL,
  CONSTRAINT pk_emp_role PRIMARY KEY (emp_id, role_id),
  CONSTRAINT fk_er_emp   FOREIGN KEY (emp_id)  REFERENCES employee(emp_id)  ON DELETE CASCADE,
  CONSTRAINT fk_er_role  FOREIGN KEY (role_id) REFERENCES app_role(role_id) ON DELETE CASCADE
);

CREATE TABLE token_blacklist (
  -- PK ประกาศแบบ inline ตาม 17.4.3 ชื่อ constraint จึงเป็นชื่อระบบของ Oracle (SYS_Cxxxxx)
  jti         VARCHAR2(64 CHAR) PRIMARY KEY,
  emp_id      NUMBER(10)  NOT NULL,
  expires_at  TIMESTAMP   NOT NULL,
  revoked_at  TIMESTAMP   DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_tb_emp FOREIGN KEY (emp_id) REFERENCES employee(emp_id) ON DELETE CASCADE
);


-- ==================================================================
--  กลุ่ม FRONT : เส้นทาง / รอบเวลา / ยานพาหนะ  (9 ตาราง / 41 คอลัมน์)
-- ==================================================================

CREATE TABLE stop (
  stop_id    NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  stop_name  VARCHAR2(150 CHAR) NOT NULL,   -- เช่น 'มหาวิทยาลัยเทคโนโลยีมหานคร'
  address    VARCHAR2(255 CHAR),
  latitude   NUMBER(10,7),
  longitude  NUMBER(10,7),
  is_active  NUMBER(1)      DEFAULT 1 NOT NULL,
  CONSTRAINT pk_stop        PRIMARY KEY (stop_id),
  CONSTRAINT uq_stop_name   UNIQUE (stop_name),
  CONSTRAINT ck_stop_active CHECK (is_active IN (0,1))
);

CREATE TABLE route (
  route_id      NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  route_name    VARCHAR2(120 CHAR) NOT NULL,
  total_minutes NUMBER(5)      DEFAULT 0 NOT NULL,   -- BR-01: Service คำนวณจาก route_stop
  description   VARCHAR2(255 CHAR),
  is_active     NUMBER(1)      DEFAULT 1 NOT NULL,
  CONSTRAINT pk_route     PRIMARY KEY (route_id),
  CONSTRAINT ck_route_min CHECK (total_minutes >= 0),
  CONSTRAINT ck_route_act CHECK (is_active IN (0,1))
);

CREATE TABLE route_stop (
  route_id       NUMBER(10) NOT NULL,
  stop_id        NUMBER(10) NOT NULL,
  stop_seq       NUMBER(5)  NOT NULL,    -- ลำดับจุดจอด 1..n
  travel_minutes NUMBER(5)  NOT NULL,    -- นาทีจากจุดก่อนหน้าถึงจุดนี้
  CONSTRAINT pk_route_stop    PRIMARY KEY (route_id, stop_seq),
  CONSTRAINT uq_route_stop_uk UNIQUE (route_id, stop_id),  -- BR-03 จุดจอดซ้ำในเส้นทางเดียวกันไม่ได้
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_stop  FOREIGN KEY (stop_id)  REFERENCES stop(stop_id),
  CONSTRAINT ck_rs_min   CHECK (travel_minutes >= 0)
);

CREATE TABLE vehicle_type (
  vtype_id   NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  vtype_name VARCHAR2(80 CHAR) NOT NULL,   -- 'รถตู้ 9 ที่นั่ง'
  capacity   NUMBER(5)      NOT NULL,      -- BR-07 ที่นั่งสูงสุดของรถชนิดนี้
  CONSTRAINT pk_vtype     PRIMARY KEY (vtype_id),
  CONSTRAINT uq_vtype     UNIQUE (vtype_name),
  CONSTRAINT ck_vtype_cap CHECK (capacity > 0)
);

CREATE TABLE vehicle (
  veh_id    NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  plate_no  VARCHAR2(20 CHAR) NOT NULL,    -- ทะเบียน เช่น 'สย 2591'
  vtype_id  NUMBER(10)     NOT NULL,
  is_active NUMBER(1)      DEFAULT 1 NOT NULL,
  CONSTRAINT pk_vehicle      PRIMARY KEY (veh_id),
  CONSTRAINT uq_vehicle_plate UNIQUE (plate_no),
  CONSTRAINT fk_vehicle_type  FOREIGN KEY (vtype_id) REFERENCES vehicle_type(vtype_id),
  CONSTRAINT ck_vehicle_act   CHECK (is_active IN (0,1))
);

-- schedule : เก็บทั้ง service_date (DATE) และ depart_at (TIMESTAMP เต็ม)
--            เพราะ Oracle ไม่มีชนิด TIME ต้องบวกนาทีได้ตรง (หลักการข้อ 1 ของ 17.4.3)
CREATE TABLE schedule (
  sched_id     NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  route_id     NUMBER(10)     NOT NULL,
  service_date DATE           NOT NULL,   -- วันที่ให้บริการ
  depart_at    TIMESTAMP      NOT NULL,   -- วัน+เวลาออกจากจุดเริ่มต้น (เช่น 2568-01-01 09:30)
  is_active    NUMBER(1)      DEFAULT 1 NOT NULL,
  CONSTRAINT pk_schedule     PRIMARY KEY (sched_id),
  CONSTRAINT uq_route_depart UNIQUE (route_id, depart_at),
  CONSTRAINT fk_schedule_route FOREIGN KEY (route_id) REFERENCES route(route_id),
  CONSTRAINT ck_schedule_act  CHECK (is_active IN (0,1))
);

CREATE TABLE schedule_stop (
  sched_stop_id NUMBER(10) GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  sched_id      NUMBER(10)  NOT NULL,
  stop_id       NUMBER(10)  NOT NULL,
  stop_seq      NUMBER(5)   NOT NULL,
  arrive_at     TIMESTAMP   NOT NULL,   -- BR-02: depart_at + NUMTODSINTERVAL(SUM(travel_minutes),'MINUTE')
  dwell_minutes NUMBER(5)   DEFAULT 0 NOT NULL,
  CONSTRAINT pk_sched_stop PRIMARY KEY (sched_stop_id),
  CONSTRAINT uq_sched_seq  UNIQUE (sched_id, stop_seq),
  CONSTRAINT fk_ss_sched   FOREIGN KEY (sched_id) REFERENCES schedule(sched_id) ON DELETE CASCADE,
  CONSTRAINT fk_ss_stop    FOREIGN KEY (stop_id)  REFERENCES stop(stop_id)
);

CREATE TABLE driver_assign (
  assign_id NUMBER(10) GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  sched_id  NUMBER(10) NOT NULL,
  emp_id    NUMBER(10) NOT NULL,   -- ต้องเป็นพนักงานที่มี role = DRIVER (ตรวจที่ Service)
  assign_at TIMESTAMP  DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_driver_assign PRIMARY KEY (assign_id),
  CONSTRAINT uq_driver_sched  UNIQUE (sched_id, emp_id),   -- BR-04 อนุญาตให้มีคนขับสำรอง
  CONSTRAINT fk_da_sched FOREIGN KEY (sched_id) REFERENCES schedule(sched_id) ON DELETE CASCADE,
  CONSTRAINT fk_da_emp   FOREIGN KEY (emp_id)   REFERENCES employee(emp_id)
);

CREATE TABLE vehicle_assign (
  assign_id NUMBER(10) GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  sched_id  NUMBER(10) NOT NULL,
  veh_id    NUMBER(10) NOT NULL,
  assign_at TIMESTAMP  DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_vehicle_assign PRIMARY KEY (assign_id),
  CONSTRAINT uq_vehicle_sched  UNIQUE (sched_id, veh_id),   -- BR-04
  CONSTRAINT fk_va_sched FOREIGN KEY (sched_id) REFERENCES schedule(sched_id) ON DELETE CASCADE,
  CONSTRAINT fk_va_veh   FOREIGN KEY (veh_id)   REFERENCES vehicle(veh_id)
);


-- ==================================================================
--  กลุ่ม BOOKING  (1 ตาราง / 11 คอลัมน์)
-- ==================================================================

-- เลขที่เอกสาร 'BK68000001' แยกจากรหัสอัตโนมัติตรง ๆ (ข้อ 17.4.4)
-- ใช้ seq_booking_code.NEXTVAL ตอน INSERT
CREATE SEQUENCE seq_booking_code START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE booking (
  booking_id      NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  booking_code    VARCHAR2(20 CHAR) NOT NULL,   -- เช่น 'BK68000001'
  cust_id         NUMBER(10)     NOT NULL,
  sched_id        NUMBER(10)     NOT NULL,
  board_stop_id   NUMBER(10)     NOT NULL,
  alight_stop_id  NUMBER(10)     NOT NULL,
  seats           NUMBER(3)      DEFAULT 1 NOT NULL,
  status          VARCHAR2(20 CHAR) DEFAULT 'reserved' NOT NULL,
  book_time       TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  qr_token        VARCHAR2(64 CHAR) NOT NULL,
  cancel_time     TIMESTAMP,
  CONSTRAINT pk_booking      PRIMARY KEY (booking_id),
  CONSTRAINT uq_booking_code UNIQUE (booking_code),
  CONSTRAINT uq_booking_qr   UNIQUE (qr_token),
  CONSTRAINT ck_booking_seats CHECK (seats BETWEEN 1 AND 4),              -- BR-06
  CONSTRAINT ck_booking_status CHECK (
      status IN ('reserved','checked_in','completed','cancelled','no_show')),
  CONSTRAINT fk_bk_cust   FOREIGN KEY (cust_id)        REFERENCES employee(emp_id),
  CONSTRAINT fk_bk_sched  FOREIGN KEY (sched_id)       REFERENCES schedule(sched_id),
  CONSTRAINT fk_bk_board  FOREIGN KEY (board_stop_id)  REFERENCES stop(stop_id),
  CONSTRAINT fk_bk_alight FOREIGN KEY (alight_stop_id) REFERENCES stop(stop_id)
);


-- ==================================================================
--  กลุ่ม TRIP : ข้อมูลสำหรับรายงาน  (2 ตาราง / 15 คอลัมน์)
--  "ห้ามตัดออก" — รายงาน R1 นับคนขึ้น/ลงจริงจากตารางนี้
-- ==================================================================

CREATE TABLE trip (
  trip_id    NUMBER(10) GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  sched_id   NUMBER(10) NOT NULL,
  driver_id  NUMBER(10) NOT NULL,   -- เก็บซ้ำจาก driver_assign เพราะอาจเปลี่ยนคนขับสำรองได้
  veh_id     NUMBER(10) NOT NULL,   -- เก็บซ้ำจาก vehicle_assign ในรอบนั้น
  start_time TIMESTAMP,
  end_time   TIMESTAMP,
  status     VARCHAR2(20 CHAR) DEFAULT 'running' NOT NULL,
  CONSTRAINT pk_trip       PRIMARY KEY (trip_id),
  CONSTRAINT uq_trip_sched UNIQUE (sched_id),         -- 1 รอบ = 1 trip / กันกดเริ่มซ้ำ (UC-23)
  CONSTRAINT ck_trip_status CHECK (status IN ('running','completed')),
  CONSTRAINT fk_tr_sched  FOREIGN KEY (sched_id)  REFERENCES schedule(sched_id),
  CONSTRAINT fk_tr_driver FOREIGN KEY (driver_id) REFERENCES employee(emp_id),
  CONSTRAINT fk_tr_veh    FOREIGN KEY (veh_id)    REFERENCES vehicle(veh_id)
);

CREATE TABLE trip_passenger (
  trip_passenger_id NUMBER(10) GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  trip_id           NUMBER(10) NOT NULL,
  booking_id        NUMBER(10) NOT NULL,
  checkin_time      TIMESTAMP,   -- BR-09: ต้องตรง trip ที่กำลังเดิน
  checkin_stop_id   NUMBER(10),
  board_seq         NUMBER(5),    -- จุดจอดที่ขึ้นจริง  (ใช้ทำรายงาน R1/R5)
  alight_seq        NUMBER(5),    -- จุดจอดที่ลงจริง
  alight_time       TIMESTAMP,
  CONSTRAINT pk_trip_passenger PRIMARY KEY (trip_passenger_id),
  CONSTRAINT uq_trip_booking    UNIQUE (trip_id, booking_id),
  CONSTRAINT fk_tp_trip    FOREIGN KEY (trip_id)    REFERENCES trip(trip_id)        ON DELETE CASCADE,
  CONSTRAINT fk_tp_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id),
  CONSTRAINT fk_tp_stop    FOREIGN KEY (checkin_stop_id) REFERENCES stop(stop_id)
);


-- ==================================================================
--  กลุ่ม AUDIT  (1 ตาราง / 8 คอลัมน์)  —  T-042 Sprint 9
--  เก็บ log ทุก write request (POST/PUT/PATCH/DELETE) ผ่าน middleware/audit.js
--  · ไม่เก็บ request body / header / token — กัน secret รั่วลงตาราง
--  · ไม่ทำ FK → employee เพราะ audit ต้องอยู่แม้ลบพนักงานออกจากระบบ
-- ==================================================================
CREATE TABLE audit_log (
  audit_id    NUMBER(10)     GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  method      VARCHAR2(10 CHAR)  NOT NULL,   -- POST | PUT | PATCH | DELETE
  path        VARCHAR2(500 CHAR) NOT NULL,   -- originalUrl (ค่า query ของ token/password ถูก mask แล้ว)
  status_code NUMBER(3),                     -- HTTP status ที่ตอบกลับ
  duration_ms NUMBER(10),                    -- เวลาประมวลผล (มิลลิวินาที)
  emp_id      NUMBER(10),                    -- รหัสผู้ใช้จาก JWT (NULL = ยังไม่ Login) — ไม่ทำ FK
  ip          VARCHAR2(45 CHAR),             -- รองรับ IPv6 (45 ตัวอักษร)
  created_at  TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_audit_log PRIMARY KEY (audit_id)
);


-- ==================================================================
--  Index  (8 ดัชนี — จาก 9 รายการในข้อ 8.8 ตัดออก 1 รายการที่ซ้ำ)
--  หมายเหตุ: 17.4.3 เขียนกำกับว่า "สร้างหลัง Seed เพื่อให้ Insert เร็ว"
--  ที่นี่สร้างไว้ในไฟล์เดียวกันเพื่อความครบถ้วนของสคีมา
--  ถ้าต้องการทำตามคำแนะนำเดิม ให้ลบหัวข้อนี้ออกแล้วย้ายไป 02_seed.sql
-- ==================================================================

CREATE INDEX ix_booking_sched_status ON booking        (sched_id, status);
CREATE INDEX ix_booking_book_time   ON booking        (book_time);
CREATE INDEX ix_booking_cust        ON booking        (cust_id, book_time);
CREATE INDEX ix_sched_route_date    ON schedule       (route_id, service_date);
-- ⚠ ดัชนีข้อ 5 ของ 8.8 (ix_schedstop_sched_seq) ถูกตัดออก
--   สาเหตุ: constraint uq_sched_seq UNIQUE (sched_id, stop_seq) สร้าง unique index
--   บนคอลัมน์ชุดเดียวกันอยู่แล้ว ถ้าสร้างซ้ำ Oracle จะขึ้น
--   ORA-01408: such column list already indexed
--   วัตถุประสงค์ของดัชนีตัวนั้น ("ดึงตารางเวลาเดินทางเรียงตามลำดับ")
--   จึงถูก uq_sched_seq รับหน้าที่แทนได้ครบถ้วนอยู่แล้ว
--   → ดูหมายเหตุการแก้ไขใน docs/reviews/recommend-from-review-day1.md
CREATE INDEX ix_tp_trip             ON trip_passenger (trip_id);
CREATE INDEX ix_tp_booking          ON trip_passenger (booking_id);
CREATE INDEX ix_da_emp              ON driver_assign  (emp_id, sched_id);
CREATE INDEX ix_va_veh              ON vehicle_assign (veh_id, sched_id);


-- ==================================================================
--  COMMENT ON TABLE  —  ครบ 21 ตาราง  (ข้อ 8.9)
-- ==================================================================
COMMENT ON TABLE  department          IS 'แผนก/หน่วยงานในสำนักงาน';
COMMENT ON TABLE  job_position        IS 'ตำแหน่งงานของพนักงาน';
COMMENT ON TABLE  employee            IS 'พนักงาน/ผู้ใช้งานระบบทุกบทบาท';
COMMENT ON TABLE  app_role            IS 'บทบาท/กลุ่มสิทธิ์ (Admin, Staff, Driver, Customer)';
COMMENT ON TABLE  permission          IS 'สิทธิ์รายหน้าจอ/ฟังก์ชัน เพื่อทำ Dynamic RBAC';
COMMENT ON TABLE  role_permission     IS 'สิทธิ์ที่แต่ละบทบาทได้รับ (Dynamic RBAC)';
COMMENT ON TABLE  employee_role       IS 'บทบาทที่พนักงานแต่ละคนได้รับ';
COMMENT ON TABLE  token_blacklist     IS 'รายการ JWT ที่ถูกเพิกถอนแล้ว';
COMMENT ON TABLE  stop                IS 'จุดจอดของระบบ';
COMMENT ON TABLE  route               IS 'เส้นทางเดินรถ';
COMMENT ON TABLE  route_stop          IS 'จุดจอดในแต่ละเส้นทาง + นาทีที่ใช้เดินทางถึงจุดนั้น';
COMMENT ON TABLE  vehicle_type        IS 'ประเภทยานพาหนะและจำนวนที่นั่ง';
COMMENT ON TABLE  vehicle             IS 'ทะเบียนยานพาหนะ';
COMMENT ON TABLE  schedule            IS 'รอบเวลาการเดินรถ (depart_at เก็บวัน+เวลาเต็ม)';
COMMENT ON TABLE  schedule_stop       IS 'เวลาที่รถถึงแต่ละจุดจอดในแต่ละรอบ (คำนวณอัตโนมัติ)';
COMMENT ON TABLE  driver_assign       IS 'การจัดคู่คนขับกับรอบเวลา';
COMMENT ON TABLE  vehicle_assign      IS 'การจัดคู่ยานพาหนะกับรอบเวลา';
COMMENT ON TABLE  booking             IS 'การจองรถของผู้ใช้บริการ มี 5 สถานะ';
COMMENT ON TABLE  trip                IS 'การเดินรถจริงในแต่ละรอบ (คนขับกดเริ่ม/ปิด)';
COMMENT ON TABLE  trip_passenger      IS 'รายละเอียดผู้โดยสารรายคนต่อรอบ — จำเป็นสำหรับรายงาน 1,2,3,5';
COMMENT ON TABLE  audit_log           IS 'บันทึกการเปลี่ยนแปลงข้อมูลทุก write request (T-042) — ไม่เก็บ secret';


-- ==================================================================
--  COMMENT ON COLUMN  —  กลุ่ม MASTER  (35 คอลัมน์)
-- ==================================================================
COMMENT ON COLUMN department.dept_id       IS 'รหัสแผนก เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN department.dept_name     IS 'ชื่อแผนก ห้ามซ้ำ';
COMMENT ON COLUMN department.created_at    IS 'วันเวลาที่สร้างแผนก';

COMMENT ON COLUMN job_position.position_id   IS 'รหัสตำแหน่งงาน เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN job_position.position_name IS 'ชื่อตำแหน่งงาน ห้ามซ้ำ';

COMMENT ON COLUMN employee.emp_id        IS 'รหัสพนักงาน เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN employee.emp_code      IS 'รหัสพนักงาน';
COMMENT ON COLUMN employee.first_name    IS 'ชื่อ';
COMMENT ON COLUMN employee.last_name     IS 'นามสกุล';
COMMENT ON COLUMN employee.phone         IS 'เบอร์โทรศัพท์';
COMMENT ON COLUMN employee.email         IS 'อีเมล';
COMMENT ON COLUMN employee.dept_id       IS 'รหัสแผนกที่สังกัด (NULL ได้สำหรับลูกค้าภายนอก)';
COMMENT ON COLUMN employee.position_id   IS 'รหัสตำแหน่งงาน';
COMMENT ON COLUMN employee.username      IS 'ชื่อผู้ใช้สำหรับ Login ห้ามซ้ำ';
COMMENT ON COLUMN employee.password_hash IS 'รหัสผ่านแบบ hash (bcrypt) — ห้ามเก็บ plaintext';
COMMENT ON COLUMN employee.is_active     IS '1 = ใช้งานอยู่, 0 = ปิดใช้งาน';
COMMENT ON COLUMN employee.created_at    IS 'วันเวลาที่สร้างพนักงาน';

COMMENT ON COLUMN app_role.role_id     IS 'รหัสบทบาท';
COMMENT ON COLUMN app_role.role_name   IS 'ชื่อบทบาท เช่น ADMIN, STAFF, DRIVER, CUSTOMER';
COMMENT ON COLUMN app_role.description IS 'คำอธิบายบทบาท';
COMMENT ON COLUMN app_role.is_active   IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN permission.perm_id     IS 'รหัสสิทธิ์';
COMMENT ON COLUMN permission.perm_code   IS 'รหัสสิทธิ์ เช่น ROUTE.EDIT';
COMMENT ON COLUMN permission.perm_name   IS 'ชื่อสิทธิ์ที่แสดงผล';
COMMENT ON COLUMN permission.module      IS 'โมดูล: master | front | booking | driver | report';
COMMENT ON COLUMN permission.screen_key  IS 'รหัสหน้าจอ ใช้สร้าง Dynamic Menu';
COMMENT ON COLUMN permission.sort_no     IS 'ลำดับการแสดงผลเมนู (เลขยิ่งน้อยยิ่งขึ้นก่อน)';

COMMENT ON COLUMN role_permission.role_id IS 'รหัสบทบาท (FK -> app_role.role_id)';
COMMENT ON COLUMN role_permission.perm_id IS 'รหัสสิทธิ์ (FK -> permission.perm_id)';

COMMENT ON COLUMN employee_role.emp_id  IS 'รหัสพนักงาน (FK -> employee.emp_id)';
COMMENT ON COLUMN employee_role.role_id IS 'รหัสบทบาท (FK -> app_role.role_id)';

COMMENT ON COLUMN token_blacklist.jti        IS 'JWT ID ของ Token ที่ถูกเพิกถอน';
COMMENT ON COLUMN token_blacklist.emp_id     IS 'รหัสเจ้าของ Token (FK -> employee.emp_id)';
COMMENT ON COLUMN token_blacklist.expires_at IS 'เวลาที่ Token หมดอายุ';
COMMENT ON COLUMN token_blacklist.revoked_at IS 'เวลาที่เพิกถอน Token';


-- ==================================================================
--  COMMENT ON COLUMN  —  กลุ่ม FRONT  (41 คอลัมน์)
-- ==================================================================
COMMENT ON COLUMN stop.stop_id    IS 'รหัสจุดจอด';
COMMENT ON COLUMN stop.stop_name  IS 'ชื่อจุดจอด เช่น มหาวิทยาลัยเทคโนโลยีมหานคร';
COMMENT ON COLUMN stop.address    IS 'ที่อยู่เต็ม';
COMMENT ON COLUMN stop.latitude   IS 'ละติจูด (NUMBER(10,7))';
COMMENT ON COLUMN stop.longitude  IS 'ลองจิจูด (NUMBER(10,7))';
COMMENT ON COLUMN stop.is_active  IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN route.route_id      IS 'รหัสเส้นทาง';
COMMENT ON COLUMN route.route_name    IS 'ชื่อเส้นทาง';
COMMENT ON COLUMN route.total_minutes IS 'นาทีรวมทั้งเส้นทาง (BR-01: SUM ของ route_stop.travel_minutes)';
COMMENT ON COLUMN route.description   IS 'คำอธิบายเส้นทาง';
COMMENT ON COLUMN route.is_active     IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN route_stop.route_id       IS 'รหัสเส้นทาง (FK -> route.route_id)';
COMMENT ON COLUMN route_stop.stop_id        IS 'รหัสจุดจอด (FK -> stop.stop_id) — BR-03 ห้ามซ้ำในเส้นทางเดียวกัน';
COMMENT ON COLUMN route_stop.stop_seq       IS 'ลำดับจุดจอด 1..n';
COMMENT ON COLUMN route_stop.travel_minutes IS 'นาทีจากจุดก่อนหน้าถึงจุดนี้';

COMMENT ON COLUMN vehicle_type.vtype_id   IS 'รหัสประเภทรถ';
COMMENT ON COLUMN vehicle_type.vtype_name IS 'ชื่อประเภทรถ เช่น รถตู้ 9 ที่นั่ง';
COMMENT ON COLUMN vehicle_type.capacity   IS 'จำนวนที่นั่งรวม';

COMMENT ON COLUMN vehicle.veh_id    IS 'รหัสยานพาหนะ';
COMMENT ON COLUMN vehicle.plate_no  IS 'ทะเบียนรถ เช่น สย 2591';
COMMENT ON COLUMN vehicle.vtype_id  IS 'รหัสประเภทรถ (FK -> vehicle_type.vtype_id)';
COMMENT ON COLUMN vehicle.is_active IS '1 = เปิดใช้, 0 = ปิดใช้';

COMMENT ON COLUMN schedule.sched_id     IS 'รหัสรอบเวลา';
COMMENT ON COLUMN schedule.route_id     IS 'รหัสเส้นทาง (FK -> route.route_id)';
COMMENT ON COLUMN schedule.service_date IS 'วันที่ให้บริการ';
COMMENT ON COLUMN schedule.depart_at    IS 'วัน+เวลาออกจากจุดเริ่มต้น เช่น 2568-01-01 09:30';
COMMENT ON COLUMN schedule.is_active    IS '1 = เปิดจอง, 0 = ปิดรอบ';

COMMENT ON COLUMN schedule_stop.sched_stop_id IS 'รหัสเวลาที่ถึงจุดจอด';
COMMENT ON COLUMN schedule_stop.sched_id      IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN schedule_stop.stop_id       IS 'รหัสจุดจอด (FK -> stop.stop_id)';
COMMENT ON COLUMN schedule_stop.stop_seq      IS 'ลำดับจุดจอดในรอบนี้';
COMMENT ON COLUMN schedule_stop.arrive_at     IS 'เวลาถึงจุดจอด (BR-02: depart_at + SUM(travel_minutes))';
COMMENT ON COLUMN schedule_stop.dwell_minutes IS 'นาทีที่รถหยุดรับ-ส่งที่จุดนี้';

COMMENT ON COLUMN driver_assign.assign_id IS 'รหัสการจัดคู่คนขับ';
COMMENT ON COLUMN driver_assign.sched_id  IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN driver_assign.emp_id    IS 'รหัสพนักงานคนขับ (FK -> employee.emp_id) ต้องมี role = DRIVER';
COMMENT ON COLUMN driver_assign.assign_at IS 'เวลาที่มอบหมาย';

COMMENT ON COLUMN vehicle_assign.assign_id IS 'รหัสการจัดคู่ยานพาหนะ';
COMMENT ON COLUMN vehicle_assign.sched_id  IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN vehicle_assign.veh_id    IS 'รหัสยานพาหนะ (FK -> vehicle.veh_id)';
COMMENT ON COLUMN vehicle_assign.assign_at IS 'เวลาที่มอบหมาย';


-- ==================================================================
--  COMMENT ON COLUMN  —  กลุ่ม BOOKING + TRIP  (11 + 15 = 26 คอลัมน์)
-- ==================================================================
COMMENT ON COLUMN booking.booking_id     IS 'รหัสการจอง';
COMMENT ON COLUMN booking.booking_code   IS 'เลขที่เอกสาร เช่น BK68000001 (จาก seq_booking_code.NEXTVAL)';
COMMENT ON COLUMN booking.cust_id        IS 'รหัสผู้จอง (FK -> employee.emp_id)';
COMMENT ON COLUMN booking.sched_id       IS 'รหัสรอบเวลา (FK -> schedule.sched_id)';
COMMENT ON COLUMN booking.board_stop_id  IS 'รหัสจุดขึ้นรถ (FK -> stop.stop_id)';
COMMENT ON COLUMN booking.alight_stop_id IS 'รหัสจุดลงรถ (FK -> stop.stop_id)';
COMMENT ON COLUMN booking.seats          IS 'จำนวนที่นั่งที่จอง (BR-06: 1-4 ที่นั่ง)';
COMMENT ON COLUMN booking.status         IS 'reserved | checked_in | completed | cancelled | no_show';
COMMENT ON COLUMN booking.book_time      IS 'เวลาที่จอง';
COMMENT ON COLUMN booking.qr_token       IS 'Token ฝังใน QR Code (BR-09: ต้องตรงรอบเดินรถที่กำลังวิ่ง)';
COMMENT ON COLUMN booking.cancel_time    IS 'เวลาที่ยกเลิก (NULL = ยังไม่ยกเลิก)';

COMMENT ON COLUMN trip.trip_id    IS 'รหัสการเดินรถ';
COMMENT ON COLUMN trip.sched_id   IS 'รหัสรอบเวลา (FK -> schedule.sched_id) — 1 รอบ = 1 trip';
COMMENT ON COLUMN trip.driver_id  IS 'รหัสคนขับที่เดินรถจริง (FK -> employee.emp_id)';
COMMENT ON COLUMN trip.veh_id     IS 'รหัสยานพาหนะที่ใช้จริง (FK -> vehicle.veh_id)';
COMMENT ON COLUMN trip.start_time IS 'เวลาออกจริง (NULL = ยังไม่ออก)';
COMMENT ON COLUMN trip.end_time   IS 'เวลากลับถึงจุดปลายจริง';
COMMENT ON COLUMN trip.status     IS 'running | completed';

COMMENT ON COLUMN trip_passenger.trip_passenger_id IS 'รหัสรายการผู้โดยสาร';
COMMENT ON COLUMN trip_passenger.trip_id           IS 'รหัสการเดินรถ (FK -> trip.trip_id)';
COMMENT ON COLUMN trip_passenger.booking_id        IS 'รหัสการจอง (FK -> booking.booking_id)';
COMMENT ON COLUMN trip_passenger.checkin_time      IS 'เวลาที่ยืนยันตั๋ว (สแกน QR)';
COMMENT ON COLUMN trip_passenger.checkin_stop_id   IS 'รหัสจุดที่ขึ้นรถจริง (FK -> stop.stop_id)';
COMMENT ON COLUMN trip_passenger.board_seq         IS 'จุดจอดที่ขึ้นจริง (ใช้ทำรายงาน R1/R5)';
COMMENT ON COLUMN trip_passenger.alight_seq        IS 'จุดจอดที่ลงจริง';
COMMENT ON COLUMN trip_passenger.alight_time       IS 'เวลาที่ลงรถจริง';


-- ==================================================================
--  COMMENT ON COLUMN  —  กลุ่ม AUDIT  (8 คอลัมน์ — T-042)
-- ==================================================================
COMMENT ON COLUMN audit_log.audit_id    IS 'รหัสแถว log เลขกำเนิดอัตโนมัติ';
COMMENT ON COLUMN audit_log.method      IS 'HTTP method ที่เป็นการเขียนข้อมูล (POST/PUT/PATCH/DELETE)';
COMMENT ON COLUMN audit_log.path        IS 'URI ของคำขอ (ค่า query ของ token/password ถูก mask เป็น ***)';
COMMENT ON COLUMN audit_log.status_code IS 'HTTP status ที่ตอบกลับ';
COMMENT ON COLUMN audit_log.duration_ms IS 'เวลาประมวลผลคำขอ (มิลลิวินาที)';
COMMENT ON COLUMN audit_log.emp_id      IS 'รหัสผู้ใช้จาก JWT (NULL = ยังไม่ Login) — ไม่ทำ FK เพื่อให้ log อยู่แม้ลบพนักงาน';
COMMENT ON COLUMN audit_log.ip          IS 'IP ของผู้เรียก (รองรับ IPv6)';
COMMENT ON COLUMN audit_log.created_at  IS 'เวลาที่บันทึก log';


-- ==================================================================
--  ตรวจสอบผลหลังรัน
--  ค่าที่คาดหวัง:  TABLE 21 / COLUMN 110 / SEQUENCE 1 / PK 21 / UK 18
--                CHECK 12 / FK 27 / CASCADE 10 / IX_CUSTOM 8
--                T_COMMENT 21 / C_COMMENT 110
-- ==================================================================
-- ==================================================================
--  ตรวจสอบผลหลังรัน  (STATUS ต้องเป็น PASS ทุกแถว)
-- ==================================================================
COLUMN object_type FORMAT A12
COLUMN result       FORMAT A8
WITH actual AS (
  SELECT 'TABLE'      AS object_type, 21 AS expected,
         (SELECT COUNT(*) FROM user_tables WHERE table_name NOT LIKE 'BIN$%') AS got FROM dual
  UNION ALL SELECT 'COLUMN',    110,
         (SELECT COUNT(*) FROM user_tab_columns) FROM dual
  UNION ALL SELECT 'SEQUENCE',    1,
         (SELECT COUNT(*) FROM user_sequences WHERE sequence_name NOT LIKE 'ISEQ$%') FROM dual
  UNION ALL SELECT 'PK',         21,
         (SELECT COUNT(*) FROM user_constraints WHERE constraint_type = 'P') FROM dual
  UNION ALL SELECT 'UK',         18,
         (SELECT COUNT(*) FROM user_constraints WHERE constraint_type = 'U') FROM dual
  UNION ALL SELECT 'CHECK',      12,
         -- ต้องกรองเฉพาะชื่อ CK_ เพราะ Oracle เก็บ NOT NULL เป็น constraint
         -- ชนิด 'C' ด้วย (ชื่อ SYS_C...) — ในสคีมานี้จะได้ 83 ตัว
         (SELECT COUNT(*) FROM user_constraints
          WHERE constraint_type = 'C' AND constraint_name LIKE 'CK\_%' ESCAPE '\') FROM dual
  UNION ALL SELECT 'FK',         27,
         (SELECT COUNT(*) FROM user_constraints WHERE constraint_type = 'R') FROM dual
  UNION ALL SELECT 'CASCADE',    10,
         (SELECT COUNT(*) FROM user_constraints
          WHERE constraint_type = 'R' AND delete_rule = 'CASCADE') FROM dual
  UNION ALL SELECT 'RESTRICT',   17,
         (SELECT COUNT(*) FROM user_constraints
          WHERE constraint_type = 'R' AND delete_rule = 'NO ACTION') FROM dual
  UNION ALL SELECT 'IX_CUSTOM',   8,
         (SELECT COUNT(*) FROM user_indexes WHERE index_name LIKE 'IX\_%' ESCAPE '\') FROM dual
  UNION ALL SELECT 'T_COMMENT',  21,
         (SELECT COUNT(*) FROM user_tab_comments WHERE comments IS NOT NULL) FROM dual
  UNION ALL SELECT 'C_COMMENT', 110,
         (SELECT COUNT(*) FROM user_col_comments WHERE comments IS NOT NULL) FROM dual
  UNION ALL SELECT 'INVALID_OBJ', 0,
         (SELECT COUNT(*) FROM user_objects WHERE status <> 'VALID') FROM dual
)
SELECT object_type, expected, got AS actual,
       CASE WHEN got = expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM actual
ORDER BY object_type;

-- ต้องขึ้น 'no rows selected' (ถ้ามีแถว = มี object ที่ 01_schema.sql ไม่ได้สร้าง)
SELECT object_type, object_name, status FROM user_objects WHERE status <> 'VALID';

-- ยืนยันว่า COMMENT ภาษาไทยไม่เพี้ยน
-- (ชื่อตารางใน data dictionary ถูกเก็บเป็นตัวพิมพ์ใหญ่ทั้งหมด)
-- ต้องได้ 1 แถว: แผนก/หน่วยงานในสำนักงาน  (ความยาว 23 ตัวอักษร)
SELECT comments, LENGTH(comments) AS thai_chars
FROM   user_tab_comments
WHERE  table_name = 'DEPARTMENT';

-- ปิดท้าย
COMMIT;
