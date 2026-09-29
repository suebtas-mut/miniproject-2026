-- ==================================================================
--  99_drop_schema.sql  —  ลบทุก object ของ 01_schema.sql (ใช้ตอนรันซ้ำ)
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  คำเตือน: ไฟล์นี้ลบข้อมูลถาวร ห้ามรันกับฐาน production
--  วิธีใช้:
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @99_drop_schema.sql
--
--  สคริปต์นี้ idempotent: รันซ้ำได้จนสะอาดเสมอ
--  ถ้าวัตถุไม่มีอยู่จะข้ามไป ไม่ขึ้น error
--  ผลลัพธ์ที่ถูกต้อง: ไม่มี ORA- และค่าทั้ง 4 ต้องเป็น 0
-- ==================================================================
-- ------------------------------------------------------------------
--  ข้อควรรู้เรื่อง Oracle 21c (ทดสอบจริงบน shuttle-oracle-xe 21-slim)
--
--  1) ห้ามใช้ "DROP TABLE ... CASCADE CONSTRAINTS"
--     เพราะ Oracle จะทิ้ง sequence ของ GENERATED ALWAYS AS IDENTITY
--     ค้างไว้ (ชื่อขึ้นต้น ISEQ$...) และลบไม่ได้อีก ขึ้น ORA-32794
--     วิธีที่ถูกต้องคือ DROP TABLE ธรรมดา Oracle จะลบ identity
--     sequence ทิ้งให้เองอัตโนมัติ
--
--  2) ถ้าเคยลบด้วย CASCADE CONSTRAINTS จนเกิด ISEQ$ ค้าง
--     แก้ได้ทางเดียวคือ DROP USER ... CASCADE แล้วสร้าง user ใหม่
--
--  3) DROP SEQUENCE ต้องข้ามชื่อ ISEQ$% เสมอ
--
--  4) ห้ามเขียนคอมเมนต์ต่อท้ายคำสั่งในบรรทัดเดียวกันหลังเครื่องหมาย ;
--     SQL*Plus จะ parse ไม่ผ่านและขึ้น ORA-00933
--     ต้องเขียนคอมเมนต์ไว้บรรทัดก่อนหน้าเสมอ
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
--  ลบตารางตามลำดับ "ลูกก่อนพ่อ" (child -> parent)
--  ลำดับนี้ทำให้ FK ไม่ขัดขวาง และ Oracle ลบ identity sequence
--  ของตารางไปพร้อมกัน
-- ------------------------------------------------------------------
DECLARE
  TYPE t_order IS TABLE OF VARCHAR2(30);
  l_order t_order := t_order(
    'trip_passenger', 'trip',          'booking',
    'vehicle_assign', 'driver_assign', 'schedule_stop',
    'schedule',      'vehicle',        'vehicle_type',
    'route_stop',    'route',          'stop',
    'token_blacklist','employee_role', 'role_permission',
    'permission',    'app_role',       'employee',
    'job_position',  'department'
  );
BEGIN
  FOR i IN 1 .. l_order.COUNT LOOP
    BEGIN
      EXECUTE IMMEDIATE 'DROP TABLE ' || l_order(i) || ' PURGE';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE != -942 THEN   -- -942 = table does not exist (ยอมรับได้)
          RAISE;
        END IF;
    END;
  END LOOP;
END;
/

-- ------------------------------------------------------------------
--  ลบ sequence ที่สร้างเอง
--  ข้าม ISEQ$ ของ identity ซึ่งห้ามลบมือ (ORA-32794)
--  ปกติจะไม่เหลืออยู่แล้วเพราะ DROP TABLE ลบไปพร้อมตาราง
-- ------------------------------------------------------------------
BEGIN
  EXECUTE IMMEDIATE 'DROP SEQUENCE seq_booking_code';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -2289 THEN   -- -2289 = sequence does not exist (ยอมรับได้)
      RAISE;
    END IF;
END;
/

COMMIT;

-- ------------------------------------------------------------------
--  ตรวจสอบ: ทั้ง 4 ค่าต้องเป็น 0
-- ------------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM user_tables) AS tables_left,
       (SELECT COUNT(*) FROM user_sequences
         WHERE sequence_name NOT LIKE 'ISEQ$%') AS seqs_left,
       (SELECT COUNT(*) FROM user_indexes) AS idx_left,
       (SELECT COUNT(*) FROM user_sequences
         WHERE sequence_name LIKE 'ISEQ$%') AS iseq_orphans
FROM dual;
