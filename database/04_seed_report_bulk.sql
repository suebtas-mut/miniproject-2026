-- ==================================================================
--  04_seed_report_bulk.sql  —  ข้อมูลปี พ.ศ. 2568 สำหรับรายงาน (≥ 50,000 แถว)
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  Task      : T-052 (Sprint 11) — เจ้าของ: นายเก่งกาญ เชี่ยวชาญ
--  แหล่งข้อมูล: Q10 (ทีมตั้งเป้า 50,000 แถว — แจ้งอาจารย์ทราบ ไม่ต้องขออนุมัติ)
--             + ปี พ.ศ. 2568 = ค.ศ. 2025 (openapi YearParam ปี 2568)
--             + รอบเวลา/รถ/คนขับ/เส้นทางจริงจาก 01-03_seed
--
--  ⛔ ข้อบังคับในการใช้งาน
--    · สคริปต์นี้เป็น INSERT ล้วน (non-destructive) — ไม่มีคำสั่งล้าง/แก้ไข/แทนที่ข้อมูลเดิม
--    · มี guard ตรวจซ้ำ: ถ้ามีรอบปี 2568 อยู่แล้วจะ ABORT ทันทีก่อนเขียนอะไรทั้งสิ้น
--    · ห้ามรันบนฐานข้อมูลร่วมกัน (shared DB) โดยไม่ผ่านการทบทวนของ coordinator
--    · รันได้เฉพาะฐานข้อมูลทดสอบที่ isolated (คนละเครื่อง/คนละ instance กับ environment จริง)
--
--  วิธีรัน (ฐานข้อมูล isolate เท่านั้น — ยังไม่ได้รันที่ไหนเลย ณ วันที่เขียนไฟล์)
--    ต้องรัน 01_schema.sql → 02_seed_master.sql → 03_seed_front.sql มาก่อน
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @04_seed_report_bulk.sql
--
--  ปริมาณที่คาดหวัง (ตรวจด้วย verification block ท้ายไฟล์ — ทุกแถวต้อง PASS)
--    schedule 5,840 · schedule_stop 26,280 · driver_assign 5,840 · vehicle_assign 5,840
--    trip 5,840 · ลูกค้าใหม่ 6,000 · booking ≥ 50,000 · trip_passenger ≥ 30,000
--    รวมทั้งสิ้น ≈ 160,000 แถว
-- ==================================================================

-- ==================================================================
--  SECTION 0 — GUARD : ตรวจก่อนเขียนอะไรทั้งสิ้น (non-destructive idempotency)
--  ถ้ามีรอบปี 2568 อยู่แล้ว → RAISE ก่อน DML = ไม่มีอะไรถูกเขียน
-- ==================================================================
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_cnt
    FROM schedule
   WHERE service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31';

  IF v_cnt > 0 THEN
    RAISE_APPLICATION_ERROR(
      -20001,
      'พบรอบปี 2568 อยู่แล้ว ' || v_cnt || ' แถว — ห้ามรันซ้ำ (สคริปต์นี้ insert อย่างเดียว ไม่เขียนทับข้อมูลเดิม)');
  END IF;
END;
/


-- ==================================================================
--  SECTION 1 — MAIN : สร้างข้อมูลปี 2025 (พ.ศ. 2568) ทั้งชุดใน TX เดียว
--  · FORALL สำหรับ bulk insert (employee / schedule / schedule_stop /
--    driver_assign / vehicle_assign / trip / booking)
--  · สถานะ booking บนรอบที่ปิดแล้ว: เฉพาะ completed / no_show / cancelled
--    (สอดคล้อง BR-10 — ปิดรอบแล้วต้องไม่มีรายการค้างสถานะเดิม)
--    · ที่นั่งรวมต่อรอบ (ไม่รวม cancelled) ≤ capacity รถของรอบนั้น (BR-07)
--    · จุดขึ้น < จุดลง เสมอ (BR-11) · book_time = depart - 12 ชั่วโมง (BR-05 ≥ 20 นาที)
--  · คนขับ/รถ ไม่ชนกันในเวลา depart_at เดียวกัน (BR-04) — คำนวณด้วยโหมดต่างฐาน
-- ==================================================================
DECLARE
  c_start_date   CONSTANT DATE := DATE '2025-01-01';
  c_end_date     CONSTANT DATE := DATE '2025-12-31';
  c_target       CONSTANT PLS_INTEGER := 50000;   -- Q10: เป้าหมาย ≥ 50,000 booking
  c_bulk_cust    CONSTANT PLS_INTEGER := 6000;
  c_flush_at     CONSTANT PLS_INTEGER := 5000;    -- batch ของ FORALL booking
  c_max_per_sched CONSTANT PLS_INTEGER := 40;     -- เพดานนิรภัยต่อรอบ

  TYPE t_num_tab  IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  TYPE t_date_tab IS TABLE OF DATE INDEX BY PLS_INTEGER;
  TYPE t_ts_tab   IS TABLE OF TIMESTAMP INDEX BY PLS_INTEGER;
  TYPE t_var20    IS TABLE OF VARCHAR2(20) INDEX BY PLS_INTEGER;
  TYPE t_var64    IS TABLE OF VARCHAR2(64) INDEX BY PLS_INTEGER;
  TYPE t_var80    IS TABLE OF VARCHAR2(80) INDEX BY PLS_INTEGER;
  TYPE t_var120   IS TABLE OF VARCHAR2(120) INDEX BY PLS_INTEGER;

  -- รอบเวลา 8 ช่วง/วัน (นาทีจากเที่ยงคืน) — 07:30..19:00
  --   6 ช่วงก่อน 17:00 + 2 ช่วงตั้งแต่ 17:00 → รายงาน R6 (ก่อน/หลัง 17:00) มีข้อมูลทั้งสองฝั่ง
  TYPE t_slot_tab IS TABLE OF PLS_INTEGER INDEX BY PLS_INTEGER;
  v_slot t_slot_tab;

  -- master ที่ preload
  v_route_ids  t_num_tab;  v_route_total t_num_tab;
  v_rs_route   t_num_tab;  v_rs_seq  t_num_tab;
  v_rs_stop    t_num_tab;  v_rs_trav t_num_tab;  v_rs_cum t_num_tab;
  v_r_first    t_num_tab;  v_r_last  t_num_tab;
  v_drivers    t_num_tab;
  v_veh_ids    t_num_tab;  v_veh_cap t_num_tab;
  v_cust_role  NUMBER;
  v_cust_pos   NUMBER;

  -- ลูกค้า bulk
  v_c_emp  t_num_tab;
  v_c_code t_var20;  v_c_first t_var80;  v_c_last t_var80;
  v_c_mail t_var120; v_c_user  t_var20;  v_c_hash t_var120;

  -- schedule 5,840 รอบ
  v_s_route t_num_tab;  v_s_date t_date_tab;  v_s_dep t_ts_tab;
  v_s_dri   t_num_tab;  v_s_veh  t_num_tab;   v_s_cap t_num_tab;
  v_s_rpos  t_num_tab;  v_s_id   t_num_tab;
  v_sstop_sched t_num_tab; v_sstop_stop t_num_tab;
  v_sstop_seq   t_num_tab; v_sstop_arr  t_ts_tab;
  v_da_sched t_num_tab; v_da_emp t_num_tab;
  v_va_sched t_num_tab; v_va_veh t_num_tab;
  v_t_sched  t_num_tab; v_t_dri  t_num_tab;
  v_t_veh    t_num_tab; v_t_end  t_ts_tab;

  -- booking batch
  v_b_code  t_var20;   v_b_cust  t_num_tab;  v_b_sched t_num_tab;
  v_b_board t_num_tab; v_b_alight t_num_tab; v_b_seats t_num_tab;
  v_b_status t_var20;  v_b_time  t_ts_tab;   v_b_qr t_var64;

  v_d      DATE;
  v_j      PLS_INTEGER := 0;
  v_gseq   PLS_INTEGER := 0;
  v_blk    PLS_INTEGER := 0;
  v_prev   NUMBER := NULL;
  v_run    PLS_INTEGER := 0;
  v_rk     PLS_INTEGER;
  v_used   NUMBER;
  v_k      PLS_INTEGER;
  v_r100   PLS_INTEGER;
  v_seats  PLS_INTEGER;
  v_status VARCHAR2(20);
  v_nstop  PLS_INTEGER;
  v_bseq   PLS_INTEGER;
  v_aseq   PLS_INTEGER;
  v_cidx   PLS_INTEGER;
  v_vd     PLS_INTEGER;
  v_vv     PLS_INTEGER;
BEGIN
  v_slot(1) := 450;   -- 07:30
  v_slot(2) := 570;   -- 09:30   (รอบตาม PDF หน้า 3)
  v_slot(3) := 660;   -- 11:00
  v_slot(4) := 780;   -- 13:00
  v_slot(5) := 900;   -- 15:00
  v_slot(6) := 990;   -- 16:30
  v_slot(7) := 1050;  -- 17:30   → ฝั่ง "หลัง 17:00" ของรายงาน R6
  v_slot(8) := 1140;  -- 19:00

  ------------------------------------------------------------------
  -- 0) preload master (ถ้าไม่ครบ = ยังไม่ได้รัน 01-03 → abort)
  ------------------------------------------------------------------
  SELECT route_id, total_minutes
    BULK COLLECT INTO v_route_ids, v_route_total
    FROM route
   WHERE is_active = 1
   ORDER BY route_id;

  SELECT route_id, stop_seq, stop_id, travel_minutes
    BULK COLLECT INTO v_rs_route, v_rs_seq, v_rs_stop, v_rs_trav
    FROM route_stop
   ORDER BY route_id, stop_seq;

  SELECT e.emp_id
    BULK COLLECT INTO v_drivers
    FROM employee e
    JOIN employee_role er ON er.emp_id = e.emp_id
    JOIN app_role r ON r.role_id = er.role_id
   WHERE r.role_name = 'DRIVER'
     AND e.is_active = 1
   ORDER BY e.emp_id;

  SELECT veh_id
    BULK COLLECT INTO v_veh_ids
    FROM vehicle
   WHERE is_active = 1
   ORDER BY veh_id;

  FOR i IN 1..v_veh_ids.COUNT LOOP
    SELECT vt.capacity
      INTO v_veh_cap(i)
      FROM vehicle v
      JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
     WHERE v.veh_id = v_veh_ids(i);
  END LOOP;

  SELECT role_id INTO v_cust_role FROM app_role WHERE role_name = 'CUSTOMER';
  SELECT position_id INTO v_cust_pos FROM job_position WHERE position_name = 'ลูกค้า';

  IF v_route_ids.COUNT = 0 OR v_rs_route.COUNT = 0
     OR v_drivers.COUNT = 0 OR v_veh_ids.COUNT = 0 THEN
    RAISE_APPLICATION_ERROR(-20002,
      'master data ไม่ครบ (route/route_stop/driver/vehicle) — ต้องรัน 01_schema + 02_seed_master + 03_seed_front ก่อน');
  END IF;

  -- ลำดับ block ของ route_stop (route_id เรียง → ทุกเส้นทางต่อเนื่องกัน, stop_seq 1..n ต่อเนื่อง)
  --    v_rs_cum(i) = SUM(travel_minutes ตั้งแต่ลำดับ 1 ถึงจุดนี้) — สูตรเดียวกับ BR-02 ใน 03_seed_front
  FOR i IN 1..v_rs_route.COUNT LOOP
    IF v_prev IS NULL OR v_rs_route(i) <> v_prev THEN
      v_blk := v_blk + 1;
      v_r_first(v_blk) := i;
      IF v_blk > 1 THEN
        v_r_last(v_blk - 1) := i - 1;
      END IF;
      v_prev := v_rs_route(i);
      v_run  := v_rs_trav(i);
    ELSE
      v_run := v_run + v_rs_trav(i);
    END IF;
    v_rs_cum(i) := v_run;
  END LOOP;
  v_r_last(v_blk) := v_rs_route.COUNT;
  IF v_blk <> v_route_ids.COUNT THEN
    RAISE_APPLICATION_ERROR(-20003, 'route_stop ไม่ครอบคลุมทุกเส้นทาง — ข้อมูล master ไม่สมบูรณ์');
  END IF;

  ------------------------------------------------------------------
  -- 1) ลูกค้า bulk 6,000 คน (รายงานต้องนับ DISTINCT cust_id ได้มาก)
  --    FORALL + RETURNING BULK COLLECT เอา emp_id ผูกบทบาท CUSTOMER
  ------------------------------------------------------------------
  FOR i IN 1..c_bulk_cust LOOP
    v_c_code(i)  := 'C68' || LPAD(TO_CHAR(i), 6, '0');
    v_c_first(i) := 'ผู้โดยสาร';
    v_c_last(i)  := 'รายงาน' || LPAD(TO_CHAR(i), 4, '0');
    v_c_mail(i)  := 'bulk68' || TO_CHAR(i) || '@invalid.local';
    v_c_user(i)  := 'bulk68' || LPAD(TO_CHAR(i), 5, '0');
    v_c_hash(i)  := '$2b$10$BULKSEEDPLACEHOLDERNOLOGINPOSSIBLE0000000000000000000000';
  END LOOP;

  FORALL i IN 1..v_c_code.COUNT
    INSERT INTO employee (emp_code, first_name, last_name, email, position_id, username, password_hash)
    VALUES (v_c_code(i), v_c_first(i), v_c_last(i), v_c_mail(i), v_cust_pos, v_c_user(i), v_c_hash(i))
    RETURNING emp_id BULK COLLECT INTO v_c_emp;

  FORALL i IN 1..v_c_emp.COUNT
    INSERT INTO employee_role (emp_id, role_id) VALUES (v_c_emp(i), v_cust_role);

  ------------------------------------------------------------------
  -- 2) schedule 365 วัน × 2 เส้นทาง × 8 ช่วง = 5,840 รอบ
  --    พร้อม driver/vehicle assignment (BR-04: ต่างเส้นทางเวลาเดียวกันคนละคน/คัน)
  ------------------------------------------------------------------
  v_d := c_start_date;
  WHILE v_d <= c_end_date LOOP
    FOR rk IN 1..v_route_ids.COUNT LOOP
      FOR sl IN 1..v_slot.COUNT LOOP
        v_j := v_j + 1;
        v_vd := MOD((sl - 1) * 2 + (rk - 1), v_drivers.COUNT) + 1;
        v_vv := MOD((sl - 1) * 2 + (rk - 1), v_veh_ids.COUNT) + 1;
        v_s_route(v_j) := v_route_ids(rk);
        v_s_date(v_j)  := v_d;
        v_s_dep(v_j)   := CAST(v_d AS TIMESTAMP) + NUMTODSINTERVAL(v_slot(sl), 'MINUTE');
        v_s_dri(v_j)   := v_drivers(v_vd);
        v_s_veh(v_j)   := v_veh_ids(v_vv);
        v_s_cap(v_j)   := v_veh_cap(v_vv);
        v_s_rpos(v_j)  := rk;
      END LOOP;
    END LOOP;
    v_d := v_d + 1;
  END LOOP;

  FORALL i IN 1..v_s_route.COUNT
    INSERT INTO schedule (route_id, service_date, depart_at)
    VALUES (v_s_route(i), v_s_date(i), v_s_dep(i))
    RETURNING sched_id BULK COLLECT INTO v_s_id;

  ------------------------------------------------------------------
  -- 3) schedule_stop — arrive_at = depart_at + SUM(travel_minutes ถึงจุดนั้น) (BR-02 สูตรเดียวกับ 03)
  ------------------------------------------------------------------
  FOR j IN 1..v_s_id.COUNT LOOP
    v_rk := v_s_rpos(j);
    FOR x IN v_r_first(v_rk)..v_r_last(v_rk) LOOP
      v_sstop_sched(v_sstop_sched.COUNT + 1) := v_s_id(j);
      v_sstop_stop (v_sstop_stop.COUNT  + 1) := v_rs_stop(x);
      v_sstop_seq  (v_sstop_seq.COUNT   + 1) := v_rs_seq(x);
      v_sstop_arr  (v_sstop_arr.COUNT   + 1) := v_s_dep(j) + NUMTODSINTERVAL(v_rs_cum(x), 'MINUTE');
    END LOOP;
  END LOOP;

  FORALL i IN 1..v_sstop_sched.COUNT
    INSERT INTO schedule_stop (sched_id, stop_id, stop_seq, arrive_at, dwell_minutes)
    VALUES (v_sstop_sched(i), v_sstop_stop(i), v_sstop_seq(i), v_sstop_arr(i), 0);

  ------------------------------------------------------------------
  -- 4) driver_assign + vehicle_assign (คนขับ/รถคนเดียวหนึ่งเวลา = BR-04)
  ------------------------------------------------------------------
  FOR j IN 1..v_s_id.COUNT LOOP
    v_da_sched(j) := v_s_id(j);
    v_da_emp(j)   := v_s_dri(j);
    v_va_sched(j) := v_s_id(j);
    v_va_veh(j)   := v_s_veh(j);
  END LOOP;

  FORALL i IN 1..v_da_sched.COUNT
    INSERT INTO driver_assign (sched_id, emp_id) VALUES (v_da_sched(i), v_da_emp(i));

  FORALL i IN 1..v_va_sched.COUNT
    INSERT INTO vehicle_assign (sched_id, veh_id) VALUES (v_va_sched(i), v_va_veh(i));

  ------------------------------------------------------------------
  -- 5) trip ปิดงานครบแล้วทุกแถว (status 'completed' — ข้อมูลปีเก่า)
  --    end_time = depart_at + route.total_minutes
  ------------------------------------------------------------------
  FOR j IN 1..v_s_id.COUNT LOOP
    v_t_sched(j) := v_s_id(j);
    v_t_dri(j)   := v_s_dri(j);
    v_t_veh(j)   := v_s_veh(j);
    v_t_end(j)   := v_s_dep(j) + NUMTODSINTERVAL(v_route_total(v_s_rpos(j)), 'MINUTE');
  END LOOP;

  FORALL i IN 1..v_t_sched.COUNT
    INSERT INTO trip (sched_id, driver_id, veh_id, start_time, end_time, status)
    VALUES (v_t_sched(i), v_t_dri(i), v_t_veh(i), v_s_dep(i), v_t_end(i), 'completed');

  ------------------------------------------------------------------
  -- 6) booking ≥ 50,000 — FORALL แบทช์ละ 5,000 แถว
  --    · เลือกลูกค้าไม่ซ้ำกันในรอบเดียวกัน (k*7 mod ไม่ฟ้องใน 40 ครั้ง)
  --    · status: 70% completed · 20% no_show · 10% cancelled (บนรอบที่ปิดแล้ว)
  --    · ที่นั่ง: 60% = 1 · 25% = 2 · 10% = 3 · 5% = 4 (BR-06)
  --    · เต็มความจุรถ (ไม่รวม cancelled) → หยุดรอบนั้น (BR-07)
  ------------------------------------------------------------------
  FOR j IN 1..v_s_id.COUNT LOOP
    v_used := 0;
    v_rk   := v_s_rpos(j);
    v_nstop := v_r_last(v_rk) - v_r_first(v_rk) + 1;
    v_k := 0;
    LOOP
      v_k := v_k + 1;
      EXIT WHEN v_k > c_max_per_sched;

      v_r100 := MOD(j * 37 + v_k * 11, 100);
      IF v_r100 < 70 THEN
        v_status := 'completed';
      ELSIF v_r100 < 90 THEN
        v_status := 'no_show';
      ELSE
        v_status := 'cancelled';
      END IF;

      v_r100 := MOD(v_k * 53 + j, 100);
      IF v_r100 < 60 THEN
        v_seats := 1;
      ELSIF v_r100 < 85 THEN
        v_seats := 2;
      ELSIF v_r100 < 95 THEN
        v_seats := 3;
      ELSE
        v_seats := 4;
      END IF;

      IF v_status <> 'cancelled' AND v_used + v_seats > v_s_cap(j) THEN
        EXIT;  -- BR-07: ที่นั่งรวม (ไม่รวม cancelled) เต็มความจุ
      END IF;
      IF v_status <> 'cancelled' THEN
        v_used := v_used + v_seats;
      END IF;

      v_gseq := v_gseq + 1;
      v_bseq := 1 + MOD(v_k + j, LEAST(2, v_nstop - 1));          -- จุดขึ้น = seq 1 หรือ 2
      v_aseq := v_bseq + 1 + MOD(v_k * 3 + j, v_nstop - v_bseq);  -- จุดลง  > จุดขึ้น (BR-11)
      v_cidx := MOD(j * 13 + v_k * 7, v_c_emp.COUNT) + 1;         -- ลูกค้าไม่ซ้ำในรอบเดียวกัน

      v_b_code  (v_b_code.COUNT  + 1) := 'BK68' || LPAD(TO_CHAR(v_gseq), 6, '0');
      v_b_cust  (v_b_cust.COUNT  + 1) := v_c_emp(v_cidx);
      v_b_sched (v_b_sched.COUNT + 1) := v_s_id(j);
      v_b_board (v_b_board.COUNT + 1) := v_rs_stop(v_r_first(v_rk) + v_bseq - 1);
      v_b_alight(v_b_alight.COUNT + 1) := v_rs_stop(v_r_first(v_rk) + v_aseq - 1);
      v_b_seats (v_b_seats.COUNT + 1) := v_seats;
      v_b_status(v_b_status.COUNT + 1) := v_status;
      v_b_time  (v_b_time.COUNT  + 1) := v_s_dep(j) - INTERVAL '12' HOUR;  -- BR-05
      v_b_qr    (v_b_qr.COUNT    + 1) := 'SEED68' || LPAD(TO_CHAR(v_gseq), 58, '0');

      IF v_b_code.COUNT >= c_flush_at THEN
        FORALL i IN 1..v_b_code.COUNT
          INSERT INTO booking (booking_code, cust_id, sched_id, board_stop_id, alight_stop_id,
                               seats, status, book_time, qr_token)
          VALUES (v_b_code(i), v_b_cust(i), v_b_sched(i), v_b_board(i), v_b_alight(i),
                  v_b_seats(i), v_b_status(i), v_b_time(i), v_b_qr(i));
        v_b_code.DELETE;  v_b_cust.DELETE;  v_b_sched.DELETE;
        v_b_board.DELETE; v_b_alight.DELETE; v_b_seats.DELETE;
        v_b_status.DELETE; v_b_time.DELETE; v_b_qr.DELETE;
      END IF;
    END LOOP;
  END LOOP;

  -- batch สุดท้าย
  IF v_b_code.COUNT > 0 THEN
    FORALL i IN 1..v_b_code.COUNT
      INSERT INTO booking (booking_code, cust_id, sched_id, board_stop_id, alight_stop_id,
                           seats, status, book_time, qr_token)
      VALUES (v_b_code(i), v_b_cust(i), v_b_sched(i), v_b_board(i), v_b_alight(i),
              v_b_seats(i), v_b_status(i), v_b_time(i), v_b_qr(i));
  END IF;

  ------------------------------------------------------------------
  -- 7) trip_passenger สำหรับ booking ที่ขึ้นรถจริง (status = completed)
  --    checkin/alight ผูกกับ arrive_at ของจุดขึ้น/ลงจริงในรอบนั้น
  --    · ~5% ของคนที่ขึ้นรถ ไม่มี alight_time (ลงไม่ครบ — ใช้ทดสอบฝั่งนับแยก R1)
  ------------------------------------------------------------------
  INSERT INTO trip_passenger (trip_id, booking_id, checkin_stop_id, checkin_time,
                              board_seq, alight_seq, alight_time)
  SELECT t.trip_id,
         b.booking_id,
         b.board_stop_id,
         ss_b.arrive_at + NUMTODSINTERVAL(MOD(b.booking_id, 2), 'MINUTE'),
         ss_b.stop_seq,
         ss_a.stop_seq,
         CASE WHEN MOD(b.booking_id, 20) = 0 THEN NULL
              ELSE ss_a.arrive_at + NUMTODSINTERVAL(MOD(b.booking_id, 6), 'MINUTE') END
    FROM booking b
    JOIN trip t          ON t.sched_id = b.sched_id
    JOIN schedule_stop ss_b ON ss_b.sched_id = b.sched_id AND ss_b.stop_id = b.board_stop_id
    JOIN schedule_stop ss_a ON ss_a.sched_id = b.sched_id AND ss_a.stop_id = b.alight_stop_id
   WHERE b.qr_token LIKE 'SEED68%'
     AND b.status = 'completed';

  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;   -- ผิดพลาดกลางทาง = ไม่มีข้อมูลครึ่ง ๆ กลาง ๆ
    RAISE;
END;
/


-- ==================================================================
--  SECTION 2 — VERIFICATION (ทุกแถวต้อง PASS บนฐาน isolate หลังรัน)
-- ==================================================================
COLUMN object_type    FORMAT A34
COLUMN expected       FORMAT A14
COLUMN got            FORMAT 12
COLUMN result         FORMAT A6

WITH actual AS (
  SELECT 'SCHEDULE (2025 · 365x2x8)' AS object_type, 5840 AS expected,
         (SELECT COUNT(*) FROM schedule
           WHERE service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31') AS got
  FROM dual
  UNION ALL SELECT 'SCHEDULE_STOP (2025)', 26280,
         (SELECT COUNT(*) FROM schedule_stop ss
           JOIN schedule s ON s.sched_id = ss.sched_id
          WHERE s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31') FROM dual
  UNION ALL SELECT 'DRIVER_ASSIGN (2025)', 5840,
         (SELECT COUNT(*) FROM driver_assign da
           JOIN schedule s ON s.sched_id = da.sched_id
          WHERE s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31') FROM dual
  UNION ALL SELECT 'VEHICLE_ASSIGN (2025)', 5840,
         (SELECT COUNT(*) FROM vehicle_assign va
           JOIN schedule s ON s.sched_id = va.sched_id
          WHERE s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31') FROM dual
  UNION ALL SELECT 'TRIP completed (2025)', 5840,
         (SELECT COUNT(*) FROM trip t
           JOIN schedule s ON s.sched_id = t.sched_id
          WHERE s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
            AND t.status = 'completed') FROM dual
  UNION ALL SELECT 'BULK_CUSTOMER', 6000,
         (SELECT COUNT(*) FROM employee WHERE username LIKE 'bulk68%') FROM dual
  UNION ALL SELECT 'BOOKING_SEED68 (>= Q10 target)', 50000,
         (SELECT COUNT(*) FROM booking WHERE qr_token LIKE 'SEED68%') FROM dual
  UNION ALL SELECT 'TRIP_PASSENGER (>= 30,000)', 30000,
         (SELECT COUNT(*) FROM trip_passenger tp
           JOIN booking b ON b.booking_id = tp.booking_id
          WHERE b.qr_token LIKE 'SEED68%') FROM dual
)
SELECT object_type,
       TO_CHAR(expected) AS expected,
       got,
       CASE WHEN got >= expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM   actual
ORDER  BY object_type;

PROMPT
PROMPT === BR-10 : รอบปี 2025 ปิดแล้ว ห้ามมี booking ค้าง (ทุกแถวต้องเป็น 0) ===
SELECT 'SEED68 สถานะอื่นนอกจาก completed/no_show/cancelled' AS check_name,
       COUNT(*) AS bad_rows
  FROM booking
 WHERE qr_token LIKE 'SEED68%'
   AND status NOT IN ('completed', 'no_show', 'cancelled')
UNION ALL
SELECT 'SEED68 booking บนรอบที่ยังไม่ completed', COUNT(*)
  FROM booking b
  JOIN trip t ON t.sched_id = b.sched_id
 WHERE b.qr_token LIKE 'SEED68%'
   AND t.status <> 'completed';

PROMPT
PROMPT === BR-07 : ที่นั่งรวมต่อรอบ (ไม่รวม cancelled) ต้อง ≤ capacity (ทุกแถวต้องเป็น 0) ===
SELECT 'เกินความจุรถ' AS check_name, COUNT(*) AS bad_rows
  FROM (SELECT b.sched_id,
               SUM(CASE WHEN b.status <> 'cancelled' THEN b.seats ELSE 0 END) AS used_seats,
               MAX(vt.capacity) AS capacity
          FROM booking b
          JOIN schedule s      ON s.sched_id = b.sched_id
          JOIN vehicle_assign va ON va.sched_id = s.sched_id
          JOIN vehicle v       ON v.veh_id = va.veh_id
          JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
         WHERE b.qr_token LIKE 'SEED68%'
         GROUP BY b.sched_id)
 WHERE used_seats > capacity;

PROMPT
PROMPT === BR-04 : คนขับ/รถ ชนกันในเวลา depart_at เดียวกัน (ทุกคู่ต้องเป็น 0) ===
SELECT 'driver conflict 2025' AS check_name, COUNT(*) AS bad_rows FROM (
  SELECT da.emp_id, s.depart_at
  FROM   driver_assign da JOIN schedule s ON s.sched_id = da.sched_id
  WHERE  s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
  GROUP  BY da.emp_id, s.depart_at HAVING COUNT(*) > 1)
UNION ALL
SELECT 'vehicle conflict 2025', COUNT(*) FROM (
  SELECT va.veh_id, s.depart_at
  FROM   vehicle_assign va JOIN schedule s ON s.sched_id = va.sched_id
  WHERE  s.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
  GROUP  BY va.veh_id, s.depart_at HAVING COUNT(*) > 1);

PROMPT
PROMPT === BR-11 : จุดขึ้นต้องมาก่อนจุดลง ทุกแถว booking (ทุกแถวต้องเป็น 0) ===
SELECT 'down before up' AS check_name, COUNT(*) AS bad_rows
  FROM booking b
  JOIN schedule_stop sb ON sb.sched_id = b.sched_id AND sb.stop_id = b.board_stop_id
  JOIN schedule_stop sa ON sa.sched_id = b.sched_id AND sa.stop_id = b.alight_stop_id
 WHERE b.qr_token LIKE 'SEED68%'
   AND sa.stop_seq <= sb.stop_seq;

PROMPT
PROMPT === BR-05 : book_time ต้องก่อนจุดขึ้นอย่างน้อย 20 นาที (ทุกแถวต้องเป็น 0) ===
SELECT 'booked too late' AS check_name, COUNT(*) AS bad_rows
  FROM booking b
  JOIN schedule_stop sb ON sb.sched_id = b.sched_id AND sb.stop_id = b.board_stop_id
 WHERE b.qr_token LIKE 'SEED68%'
   AND b.book_time > sb.arrive_at - NUMTODSINTERVAL(20, 'MINUTE');

PROMPT
PROMPT === สถิติสถานะ booking ปี 2025 (ใช้ตรวจรายงาน) ===
COLUMN status FORMAT A12
SELECT status, COUNT(*) AS cnt
  FROM booking
 WHERE qr_token LIKE 'SEED68%'
 GROUP BY status
 ORDER BY status;
