-- ==================================================================
--  02_seed_master.sql  —  กลุ่ม MASTER : บุคคลและสิทธิ์
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  Task      : T-008 (Sprint 2) — เจ้าของ: นายเก่งกาญ เชี่ยวชาญ
--  แหล่งข้อมูล: PDF หน้า 3, 6, 9, 10 (ตัวอย่างคนขับ/รถ)
--             + docs/report/chapter-08-data-dictionary.md ข้อ 8.3
--
--  ตารางที่ใส่: 8 = department · job_position · employee · app_role
--                    · permission · role_permission · employee_role
--
--  วิธีรัน
--    ต้องรัน 01_schema.sql มาก่อน
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @02_seed_master.sql
--
--  ⚠ ถ้าเคยรันแล้วต้องการ re-seed
--    ใช้ 99_drop_schema.sql แล้วรัน 01 -> 02 -> 03 ตามลำดับใหม่
--    เพราะ 01_schema.sql ใช้ GENERATED ALWAYS AS IDENTITY
--    การ INSERT ซ้ำจะชน uq_employee_code / uq_employee_user
-- ==================================================================


-- ==================================================================
--  1) department  —  3 แผนก
--  ⚠ ASM-02 : ชื่อแผนกไม่มีใน PDF → เป็นสมมติฐานของทีม
--     (โครงสร้างคือจริงตาม 8.3.1 · ชื่อเป็นตัวอย่างที่ Admin แก้ได้ภายหลัง)
-- ==================================================================
INSERT INTO department (dept_name) VALUES ('ฝ่ายบริหาร');
INSERT INTO department (dept_name) VALUES ('ฝ่ายจัดการรถขนส่ง');
INSERT INTO department (dept_name) VALUES ('ฝ่ายสารสนเทศ');


-- ==================================================================
--  2) job_position  —  4 ตำแหน่ง
--  อ้างอิง 8.3.2 ระบุตัวอย่างไว้ว่า "พนักงานขับรถ ผู้ดูแลระบบ ลูกค้า"
-- ==================================================================
INSERT INTO job_position (position_name) VALUES ('ผู้ดูแลระบบ');
INSERT INTO job_position (position_name) VALUES ('พนักงานธุรการ');
INSERT INTO job_position (position_name) VALUES ('พนักงานขับรถ');
INSERT INTO job_position (position_name) VALUES ('ลูกค้า');


-- ==================================================================
--  3) app_role  —  4 บทบาท
--  อ้างอิง: 01_schema.sql บรรทัด COMMENT app_role.role_name
--           "เช่น ADMIN, STAFF, DRIVER, CUSTOMER"
-- ==================================================================
INSERT INTO app_role (role_name, description) VALUES ('ADMIN',    'ผู้ดูแลระบบ — เข้าถึงทุกหน้าจอและจัดการสิทธิ์');
INSERT INTO app_role (role_name, description) VALUES ('STAFF',   'พนักงานสำนักงาน — จัดการข้อมูลหลักและดูรายงาน');
INSERT INTO app_role (role_name, description) VALUES ('DRIVER',   'คนขับรถ — เริ่ม/ปิดรอบเดินรถและสแกน QR');
INSERT INTO app_role (role_name, description) VALUES ('CUSTOMER', 'ผู้ใช้บริการ — จอง ตรวจสถานะ และยกเลิกรถ');


-- ==================================================================
-- 4) permission  —  22 สิทธิ์ แบ่งตาม module (8.3.5)
--     นับ: master 5 + front 4 + booking 3 + driver 3 + report 7 = 22
--  module ตาม COMMENT: master | front | booking | driver | report
--  screen_key ใช้สร้าง Dynamic Menu (P-05 : ห้าม hardcode สิทธิ์ในโค้ด)
-- ==================================================================
-- ---- module = master ----
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('EMP.VIEW',    'ดูข้อมูลพนักงาน',        'master', 'EMP_LIST',      10);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('EMP.EDIT',    'เพิ่ม/แก้/ปิดพนักงาน',      'master', 'EMP_FORM',      11);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('DEPT.EDIT',   'จัดการแผนก',             'master', 'DEPT_LIST',     12);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('POS.EDIT',    'จัดการตำแหน่ง',          'master', 'POS_LIST',      13);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('ROLE.EDIT',   'จัดการบทบาทและสิทธิ์',     'master', 'ROLE_MATRIX',   14);
-- ---- module = front ----
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('ROUTE.VIEW',  'ดูเส้นทางและรอบเวลา',     'front',  'ROUTE_LIST',    20);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('ROUTE.EDIT',  'จัดการเส้นทาง/จุดจอด',    'front',  'ROUTE_FORM',    21);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('VEH.EDIT',    'จัดการยานพาหนะ',         'front',  'VEH_LIST',      22);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('SCHED.EDIT',  'จัดการตารางเวลาเดินรถ',  'front',  'SCHED_GRID',    23);
-- ---- module = booking ----
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('BK.CREATE',   'จองรถ',                  'booking', 'BK_FORM',       30);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('BK.VIEW',     'ดูรายการจองของฉัน',      'booking', 'BK_LIST',       31);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('BK.CANCEL',   'ยกเลิกการจอง',           'booking', 'BK_LIST',       32);
-- ---- module = driver ----
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('TRIP.START',  'กดเริ่มเดินรถ',          'driver',  'DRIVER_HOME',   40);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('TRIP.END',    'กดปิดรอบเดินรถ',         'driver',  'DRIVER_HOME',   41);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('QR.SCAN',     'สแกน QR ยืนยันตั๋ว',      'driver',  'DRIVER_SCAN',   42);
-- ---- module = report ----
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R1',      'รายงาน 1 จำนวนคนขึ้น-ลง',      'report',  'RPT_R1',       50);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R2',      'รายงาน 2 สรุปรอบเวลา',        'report',  'RPT_R2',       51);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R3',      'รายงาน 3 ผู้โดยสารประจำรถ',    'report',  'RPT_R3',       52);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R4',      'รายงาน 4 สรุปยอดผู้ใช้รายวันรายเส้นทาง', 'report', 'RPT_R4',       53);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R5',      'รายงาน 5 จุดจอดที่มีผู้โดยสาร',   'report',  'RPT_R5',       54);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R6',      'รายงาน 6 สถิติคนขับ',         'report',  'RPT_R6',       55);
INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no) VALUES ('RPT.R7',      'รายงาน 7 สถิติยานพาหนะ',     'report',  'RPT_R7',       56);


-- ==================================================================
--  5) role_permission  —  จับคู่บทบาท ↔ สิทธิ์ (Dynamic RBAC)
--     ใช้ INSERT ... SELECT เพื่อไม่ hardcode perm_id
-- ==================================================================
-- ADMIN : ทุกสิทธิ์ 24 รายการ
INSERT INTO role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM   app_role r CROSS JOIN permission p
WHERE  r.role_name = 'ADMIN';

-- STAFF : ดู/แก้ master ได้ ยกเว้น ROLE.EDIT (สิทธิ์ระดับสูงสุด)
--        + front ทั้งหมด + booking ทั้งหมด + report ทั้งหมด
INSERT INTO role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM   app_role r, permission p
WHERE  r.role_name = 'STAFF'
AND    (   (p.module IN ('master','front','booking','report') AND p.perm_code <> 'ROLE.EDIT')
        OR p.module = 'driver' AND p.perm_code = 'TRIP.START' );

-- DRIVER : ดูเส้นทาง + ขับรถ + ดูรายงาน 3 (ผู้โดยสารประจำรถของตัวเอง)
INSERT INTO role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM   app_role r, permission p
WHERE  r.role_name = 'DRIVER'
AND    (   p.module = 'driver'
        OR p.perm_code = 'ROUTE.VIEW'
        OR p.perm_code = 'RPT.R3' );

-- CUSTOMER : จอง/ดู/ยกเลิก + ดูเส้นทาง
INSERT INTO role_permission (role_id, perm_id)
SELECT r.role_id, p.perm_id
FROM   app_role r, permission p
WHERE  r.role_name = 'CUSTOMER'
AND    (   p.module = 'booking'
        OR p.perm_code = 'ROUTE.VIEW' );


-- ==================================================================
--  6) employee  —  15 คน (1 admin + 2 staff + 6 driver + 6 customer)
-- ------------------------------------------------------------------
--  🔐 password_hash
--     ค่าทั้งหมดเป็น PLACEHOLDER รูปแบบ bcrypt ที่ "ล็อกเกินไว้" โดยเจตนา
--     เพราะยังไม่มี bcrypt library ในเครื่อง (T-011 จะเป็นผู้สร้าง hash จริง)
--     → ทุกบัญชีจะ Login ไม่ได้จนกว่าจะถูกแทนที่
--     → เลือกแบบนี้เพราะ "login ไม่ได้" ปลอดภัยกว่า "login ได้ด้วยรหัสเดาได้"
--     วิธีสร้าง hash จริง:  npm i bcrypt && node -e "console.log(require('bcrypt').hashSync('รหัส',10))"
-- ==================================================================
-- ---- ผู้ดูแลระบบ 1 คน ----
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP001', 'ธนกฤต', 'วงศ์ไทย',  '081-234-5001', 'thana.korn@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายสารสนเทศ'),
        (SELECT position_id FROM job_position WHERE position_name = 'ผู้ดูแลระบบ'),  'admin',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORADMINUSER000000');

-- ---- พนักงานสำนักงาน 2 คน ----
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP002', 'ปิยะพร', 'แสงทอง',   '081-234-5002', 'piya.sorn@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายบริหาร'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานธุรการ'), 'ppiya',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORSTAFFUSER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP003', 'กมลวรรณ', 'ศรีสุข',   '081-234-5003', 'kamol.sri@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายบริหาร'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานธุรการ'), 'kamol',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORSTAFFUSER00000');

-- ---- คนขับ 6 คน · ชื่อตาม PDF หน้า 9 (R6) ----
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP004', 'สมชาย',   'ใจดี',     '081-234-5004', 'somchai@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'somchai',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP005', 'สมหมาย',  'ใจรัก',    '081-234-5005', 'sommai@shuttle.local',   (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'sommai',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP006', 'สมควร',   'ใจงาม',    '081-234-5006', 'somkuan@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'somkuan', '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP007', 'อารีรัตน์', 'ศรีสุข',  '081-234-5007', 'aree@shuttle.local',    (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'aree',    '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP008', 'วรพล',    'เทพทอง',   '081-234-5008', 'worapong@shuttle.local',(SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'worapong','$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                       dept_id, position_id, username,   password_hash)
VALUES ('EMP009', 'นันทนา',  'ใจตรง',   '081-234-5009', 'nantana@shuttle.local',  (SELECT dept_id FROM department     WHERE dept_name     = 'ฝ่ายจัดการรถขนส่ง'),
        (SELECT position_id FROM job_position WHERE position_name = 'พนักงานขับรถ'), 'nantana', '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORDRIVER00000000');

-- ---- ลูกค้า 6 คน ----
-- ⚠ Q-F(b) : PDF หน้า 6 ใช้ชื่อ "คนขับ" ซ้ำกับผู้จอง (สมชาย/สมหมาย/สมควร)
--     ถ้าใช้ชื่อซ้ำจริง รายงาน R3 (ผู้โดยสารประจำรถ) จะเพี้ยน
--     → ที่นี่ใช้ "ชื่อสมมติคนละชุด" ตาม AR-03 และบันทึกไว้ท้ายไฟล์
--     → ยังต้องยืนยันกับอาจารย์ว่าจะใช้ชื่อจริงจาก PDF หรือชื่อสมมติ
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP010', 'สุดารัตน์', 'พงษ์ไพบูลย์', '081-234-5010', 'suda@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'suda',  '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP011', 'ธนวัฒน์', 'ศรีสุข',  '081-234-5011', 'thanawat@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'thana','$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP012', 'อภิชาติ', 'ใจดี',    '081-234-5012', 'aphichart@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'aphichart','$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP013', 'มนัสนันท์', 'ทองดี',  '081-234-5013', 'manat@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'manat', '$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP014', 'ศิริพร',  'ใจสม',    '081-234-5014', 'siriporn@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'siriporn','$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');
INSERT INTO employee (emp_code, first_name, last_name, phone,   email,                    dept_id, position_id, username,   password_hash)
VALUES ('EMP015', 'ธีรพงษ์', 'เลิศชู',  '081-234-5015', 'teeraphong@shuttle.local', NULL,
        (SELECT position_id FROM job_position WHERE position_name = 'ลูกค้า'), 'teeraphong','$2b$10$SEEDPLACEHOLDERSUPPLIEDBYT011FORCUSTOMER00000');


-- ==================================================================
--  7) employee_role  —  ผูกพนักงาน 15 คน → บทบาท
--     ผู้ดูแลระบบ/พนักงาน 1 บทบาท · คนขับ DRIVER · ลูกค้า CUSTOMER
-- ==================================================================
INSERT INTO employee_role (emp_id, role_id)
SELECT e.emp_id, r.role_id
FROM   employee e, app_role r
WHERE  r.role_name = 'ADMIN'
AND    e.username  = 'admin';

INSERT INTO employee_role (emp_id, role_id)
SELECT e.emp_id, r.role_id
FROM   employee e, app_role r
WHERE  r.role_name = 'STAFF'
AND    e.username IN ('ppiya', 'kamol');

INSERT INTO employee_role (emp_id, role_id)
SELECT e.emp_id, r.role_id
FROM   employee e, app_role r
WHERE  r.role_name = 'DRIVER'
AND    e.username IN ('somchai','sommai','somkuan','aree','worapong','nantana');

INSERT INTO employee_role (emp_id, role_id)
SELECT e.emp_id, r.role_id
FROM   employee e, app_role r
WHERE  r.role_name = 'CUSTOMER'
AND    e.username IN ('suda','thana','aphichart','manat','siriporn','teeraphong');


-- ==================================================================
--  ตรวจสอบผลหลังรัน  (STATUS ต้องเป็น PASS ทุกแถว)
-- ==================================================================
COLUMN object_type FORMAT A16
COLUMN result       FORMAT A8
COLUMN expected_txt FORMAT A30
WITH actual AS (
  SELECT 'DEPARTMENT'    AS object_type, 3 AS expected,
         (SELECT COUNT(*) FROM department) AS got FROM dual
  UNION ALL SELECT 'JOB_POSITION',  4,
         (SELECT COUNT(*) FROM job_position) FROM dual
  UNION ALL SELECT 'EMPLOYEE',      15,
         (SELECT COUNT(*) FROM employee) FROM dual
  UNION ALL SELECT 'APP_ROLE',      4,
         (SELECT COUNT(*) FROM app_role) FROM dual
UNION ALL SELECT 'PERMISSION',    22,
          (SELECT COUNT(*) FROM permission) FROM dual
-- ADMIN ควรได้ 22 (ทุกสิทธิ์)
  UNION ALL SELECT 'RP_ADMIN',      22,
          (SELECT COUNT(*) FROM role_permission rp JOIN app_role r ON r.role_id = rp.role_id
           WHERE r.role_name = 'ADMIN') FROM dual
-- STAFF ได้ 19 = master 4 (ไม่รวม ROLE.EDIT) + front 4 + booking 3 + report 7 + TRIP.START 1
  UNION ALL SELECT 'RP_STAFF',      19,
          (SELECT COUNT(*) FROM role_permission rp JOIN app_role r ON r.role_id = rp.role_id
           WHERE r.role_name = 'STAFF') FROM dual
  UNION ALL SELECT 'RP_DRIVER',     5,
         (SELECT COUNT(*) FROM role_permission rp JOIN app_role r ON r.role_id = rp.role_id
          WHERE r.role_name = 'DRIVER') FROM dual
  UNION ALL SELECT 'RP_CUSTOMER',   4,
         (SELECT COUNT(*) FROM role_permission rp JOIN app_role r ON r.role_id = rp.role_id
          WHERE r.role_name = 'CUSTOMER') FROM dual
  -- พนักงาน 15 คนต้องผูกบทบาทครบทุกคน (ไม่มีคนไร้บทบาท)
  UNION ALL SELECT 'EMP_NO_ROLE',   0,
         (SELECT COUNT(*) FROM employee e
          WHERE NOT EXISTS (SELECT 1 FROM employee_role er WHERE er.emp_id = e.emp_id)) FROM dual
  -- ลูกค้าต้องไม่มีแผนก (8.3.5 : dept_id NULL ได้สำหรับลูกค้าภายนอก)
  UNION ALL SELECT 'CUST_WITH_DEPT',0,
         (SELECT COUNT(*) FROM employee e JOIN job_position p ON p.position_id = e.position_id
          WHERE p.position_name = 'ลูกค้า' AND e.dept_id IS NOT NULL) FROM dual
  -- password_hash ต้องไม่ใช่ plaintext (R-04)
  UNION ALL SELECT 'PLAIN_PWD',     0,
         (SELECT COUNT(*) FROM employee
          WHERE LENGTH(password_hash) < 40 OR password_hash NOT LIKE '$2%') FROM dual
)
SELECT object_type, expected, got AS actual,
       CASE WHEN got = expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM actual
ORDER BY object_type;

COMMIT;
