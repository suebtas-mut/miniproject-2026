# ตรวจงานตาม MINI PROJECT SHUTTLE BUS.pdf

**Session ID:** ses_f1efe6e7bffeE3C4yUB6pSWF5O
**Created:** 9/27/2026, 10:56:11 AM
**Updated:** 9/27/2026, 11:25:58 AM

---

## User

ช่วย Review งาน จะต้องทำอะไรส่งบ้าง ตามข้อกำหนด ในไฟล์ MINI PROJECT SHUTTLE BUS.pdf

---

## Assistant (Build · Big Pickle · 7.5s)

I'll read the PDF to understand the requirements.

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"D:\\data\\miniproject\" -Recurse -File | Select-Object FullName, Length | Format-Table -AutoSize"
}
```

**Output:**
```

FullName                                          Length
--------                                          ------
D:\data\miniproject\MINI PROJECT SHUTTLE BUS.pdf 1124016



```

---

## Assistant (Build · Big Pickle · 2.2s)

**Tool: read**

**Input:**
```json
{
  "filePath": "D:\\data\\miniproject\\MINI PROJECT SHUTTLE BUS.pdf"
}
```

**Output:**
```
PDF read successfully
```

---

## Assistant (Build · Big Pickle · 3.4s)

_Thinking:_

I need to inform the user I can't read the PDF directly, but I can try to extract text using PowerShell or another method. Let me try extracting text from the PDF.

Let me check if there's a tool available - maybe python with pypdf, or pdftotext.

ผมอ่าน PDF โดยตรงไม่ได้ (โมเดลนี้ไม่รองรับ PDF) แต่ลองดึงข้อความออกมาก่อน

**Tool: bash**

**Input:**
```json
{
  "command": "$cmds = @('python','python3','py','pdftotext','node'); foreach ($c in $cmds) { $r = Get-Command $c -ErrorAction SilentlyContinue; if ($r) { \"$c => $($r.Source)\" } else { \"$c => NOT FOUND\" } }"
}
```

**Output:**
```
python => C:\Users\suebt\.pyenv\pyenv-win\shims\python.bat
python3 => C:\Users\suebt\.pyenv\pyenv-win\shims\python3.bat
py => NOT FOUND
pdftotext => NOT FOUND
node => C:\Program Files\nodejs\node.exe

```

---

## Assistant (Build · Big Pickle · 6.3s)

**Tool: bash**

**Input:**
```json
{
  "command": "python -c \"import pypdf; print('pypdf ok', pypdf.__version__)\" 2>&1; python -c \"import fitz; print('pymupdf ok')\" 2>&1; python -c \"import pdfminer; print('pdfminer ok')\" 2>&1"
}
```

**Output:**
```
pypdf ok 6.19.0
python : Traceback (most recent call last):
At line:1 char:70
+ ... n__)" 2>&1; python -c "import fitz; print('pymupdf ok')" 2>&1; python ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Traceback (most recent call last)::String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'fitz'
python : Traceback (most recent call last):
At line:1 char:121
+ ... df ok')" 2>&1; python -c "import pdfminer; print('pdfminer ok')" 2>&1
+                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Traceback (most recent call last)::String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'pdfminer'

```

---

## Assistant (Build · Big Pickle · 4.4s)

_Thinking:_

pypdf is available. Let me extract text.

**Tool: bash**

**Input:**
```json
{
  "command": "python -c \"from pypdf import PdfReader; r=PdfReader(r'D:\\data\\miniproject\\MINI PROJECT SHUTTLE BUS.pdf'); print('PAGES:',len(r.pages)); [print('=== PAGE',i+1,'===\\n'+(p.extract_text() or '')) for i,p in enumerate(r.pages)]\" 2>&1"
}
```

**Output:**
```
PAGES: 12
=== PAGE 1 python : Traceback (most recent call last):
At line:1 char:1
+ python -c "from pypdf import PdfReader; r=PdfReader(r'D:\data\minipro ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Traceback (most recent call last)::String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  File "<string>", line 1, in <module>
  File "<string>", line 1, in <listcomp>
  File "C:\Users\suebt\.pyenv\pyenv-win\versions\3.11.9\Lib\encodings\cp1252.py", line 19, in encode
    return codecs.charmap_encode(input,self.errors,encoding_table)[0]
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
UnicodeEncodeError: 'charmap' codec can't encode characters in position 19-22: character maps to <undefined>

```

---

## Assistant (Build · Big Pickle · 5.6s)

**Tool: bash**

**Input:**
```json
{
  "command": "$env:PYTHONIOENCODING='utf-8'; python -c \"from pypdf import PdfReader; r=PdfReader(r'D:\\data\\miniproject\\MINI PROJECT SHUTTLE BUS.pdf'); open(r'C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\mb.txt','w',encoding='utf-8').write('\\n'.join(['=== PAGE '+str(i+1)+' ===\\n'+(p.extract_text() or '') for i,p in enumerate(r.pages)])); print('done')\" 2>&1"
}
```

**Output:**
```
done

```

---

## Assistant (Build · Big Pickle · 1.6s)

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\mb.txt"
}
```

**Output:**
```
<path>C:\Users\suebt\AppData\Local\Temp\opencode\mb.txt</path>
<type>file</type>
<content>
1: === PAGE 1 ===
2: MINI PROJECT  ระบบ SHUTTLE BUS SYSTEM  
3: เนื่องจากทาง MUT ตองการพัฒนาระบบ การใหบริการรถรับสงใหกับนักศึกษาและเจาหนาที่ ในละแวกหนองจอก 
4: โดยจัดทําเปน จุดรับสงตามเสนทางในหนองจอก และมีรอบเวลาการเดินรถในแตละรอบ จึงมีการสรุปขอมูลที่
5: จําเปนตอการพัฒนาระบบดังตอไปนี้  
6: ระบบขอมูล  Master File  (ซึ่งจะมีหลาย ขอมูลตามการออกแบบของแตละกลุม ทั้งนี้ นศ ไมตองทําทั้งหมด 
7: ขอมูลไหนที่ไมไดทําเปน app ให กรอก insert โดยตรงจาก database เพื่อนํามาใชงานไดเลย) แตสวนที่บังคับทํา
8: คือ  
9: ระบบ Master.1  บังคับทําโปรแกรม 
10:   เปนระบบการจัดการพนักงาน ในองคกร สามารถเพิ่มพนักงาน และ แกไขขอมูลพนักงานได โดยสามารถระบุ
11: แผนก และตําแหนงของพนักงานได   
12: ระบบ Master.2  บังคับทําโปรแกรม 
13:  เปนระบบการกําหนดสิทธิ์การเขาถึงของแตละตําแหนง วา สามารถใชหนาจอไหนไดบาง  กําหนดใหทําเปนแบบ 
14: Dynamic  คือ เพิ่ม ลบ แกไขสิทธืไดตลอดเวลาไม FIX  วา มีแค admin กับ  user  หรือ ไม ﬁx วา  admin เขา
15: ไดทุกหนา  ตองแกไขไดตลอดเวลา  
16: ระบบ Master.3  บังคับทําโปรแกรม 
17: ระบบการ Login Logout  และสามารถเช็คสิทธิ์การเขาถึงได 
18:  
19: ระบบ Master File อื่นๆ   ที่นักศึกษาสามารถเก็บไดจาก requirement  ไมบังคับทําเปนโปรแกรม แต หากเวลา
20: อาจารยตรวจ และตองการเพิ่มขอมูล นักศึกษา จะตองเพิ่มโดยตรงจากฐานขอมูลได  
21:  
22:  
23:  
24:  
25: === PAGE 2 ===
26: ระบบหนา Font  
27: - ระบบของการจัดเสนทางการเดินรถที่จะใหบริการ  โดยมีการจัดเสนทางการเดินรถ เปนแตละจุดจอด ใน 
28: 1 เสนทางการเดินรถ สามารถที่จะมีจุดจอดไดหลายจุด  และแตละจุดจอดก็จะสามารถอยูไดหลาย
29: เสนทาง แตละเสนทางก็สามารถที่จอดในจุดจอดที่มีได  และตองเก็บไดดวยวาแตละเสนทางใชเวลา
30: ทั้งหมดกี่นาที โดยคํานวณจากแตละจุดจอด ดังตัวอยางขอมูลตอไปนี้ 
31: เสนทางที่ 1 เวลารวม     30    นาที (คํานวณ) 
32: จุดที่ 1 มหาวิทยาลัยเทคโนโลยีมหานคร  
33: จุดที่ 2 โลตัสหนองจอก 5 นาที 
34: จุดที่ 3 โรงพยาบาลหนองจอก 3 นาที 
35: จุดที่ 4  Big C หนองจอก 6 นาที 
36: จุดที่ 5 โรงพยาบาลหนองจอก 3 นาที 
37: จุดที่ 6 โลตัสหนองจอก 3 นาที 
38: จุดที่ 7 มหาวิทยาลัยเทคโนโลยีมหานคร 10 นาที 
39:  
40: เสนทางที่ 2 เวลารวม     13    นาที (คํานวณ) 
41: จุดที่ 1 มหาวิทยาลัยเทคโนโลยีมหานคร  
42: จุดที่ 2 โลตัสหนองจอก 5 นาที 
43: จุดที่ 3 สวนสาธารณหนองจอก  3 นาที 
44: จุดที่ 4  รานสมตําปานาง 5 นาที 
45:  
46: เสนทางที่ 3 เวลารวม     12    นาที (คํานวณ) 
47: จุดที่ 1 Big C หนองจอก  
48: จุดที่ 2 โลตัสหนองจอก 5 นาที 
49: จุดที่ 3 สวนสาธารณหนองจอก  3 นาที 
50: จุดที่ 4  รานสมตําปานาง 5 นาที 
51: จุดที่ 5 มหาวิทยาลัยเทคโนโลยีมหานคร 2 นาที 
52:  
53: === PAGE 3 ===
54: 2. การจัดรอบเวลาการเดินรถ  จัดรถ และ คนขับในแตละรอบการเดินรถ นั้น  โดยการจัดรอบเวลาการ
55: เดินรถจะจัดตามเสนทางที่เรากําหนดไวในตอนตน  ในการจัดคนขับและรถในแตละรอบ ระบบจะตองมี
56: การตรงวจสอบดวยวา ขอมูลชนกันหรือไม เชนหาก ใชรถคันเดียวกัน หรือ คนขับในเวลาเดียวกัน จะตอง
57: ไมสามารถกําหนดได  แตละเสนทางอาจจะมีรอบเวลาการใหบริการที่เหมือนหรือตางกันก็ได และแตละ
58: เสนทางจะมีจํานวนรอบที่เหมือนหรือตางกันก็ได แลวแตทางมหาวิทยาลัยกําหนด และสามารถ
59: ปรับเปลี่ยนจัดการไดใหมตลอดเวลา  ดังตัวอยางตอไปนี้ 
60: เสนทางที่  1  
61: รอบที่ เวลา  คนขับ รถ 
62: 1 9.30 สมชาย ใจดี  สย 2591  รถตู 9 ที่นั่ง 
63: 2 11.00 สมหมาย ใจรัก สย 2591  รถตู 9 ที่นั่ง 
64: 3 13.00  สมชาย ใจดี  บก 1130  รถบัส  20 ที่นั่ง 
65: 4 15.00 สมชาย ใจดี  บก 1130  รถบัส  20 ที่นั่ง 
66:  
67: เสนทางที่  2 
68: รอบที่ เวลา  คนขับ รถ 
69: 1 9.30 สมควร  ใจงาม สย 2599  รถตู 9 ที่นั่ง 
70: 2 11.00 สมควร  ใจงาม สย 2599  รถตู 9 ที่นั่ง 
71: 3 13.00  สมหมาย ใจรัก สย 2599  รถตู 9 ที่นั่ง 
72: 4 15.00 สมหมาย ใจรัก สย 2599  รถตู 9 ที่นั่ง 
73:  
74: ระบบการจองรถของผูใชบริการ 
75: - ระบบจะให เจาหนาที่ หรือ นักศึกษาเทานั้นทําการ login เขาระบบ เพื่อทํารายการจองได  
76: - การจองรถ  ผูใชบริการจะตองทําการเลือกจุดจอดที่ตองการขึ้นรถ และ จุดจอดที่ตองการลงจากรถ  
77: โดยเมื่อเลือกแลว ระบบจะตองแสดง รอบเวลาที่สามารถจะขึ้นรถ ในแตละรอบเวลาการเดินทางได ทั้งนี้ 
78: ผูใชบริการจะตองจองรถ กอนเวลาที่รถจะถึงจุดจอดที่ ตองการจะขึ้นกอน 20 นาที หากเกิน 20 นาที จะ
79: ไมมีรอบที่เกินเวลาขึ้นมาใหเลือก ในการผูใชบริการสามารถเลือกจํานวนที่นั่งได user ละไมเกิน 4  คน
80: เทานั้น 
81: === PAGE 4 ===
82: - ในการจอง ระบบจะตองทําการตรวจสอบวา จํานวนที่นั่งวางในรอบการเดินรถนั้นเพียงพอตอ การจอง
83: หรือไม หากรถ 9 ที่นั่งแตจองไปแลว  8  แลวจะจองเพิ่มอีกไดแค 1  เทานั้น 
84: - เมื่อทําการจองเรียบรอย ระบบจะทําการ generate QR CODE เพื่อใหใชในการ check in ขึ้นรถ  
85: - ผูใชบริการสามารถที่จะ ทําการยกเลิก รายการจองของตนเองได หากมีการยกเลิกการจอง จะทําใหที่นั่ง
86: ในรอบที่จองวางกลับมาตามจํานวนที่นั่งที่ยกเลิกไป  
87: - ในหนาที่ผูใชบริการเห็นจะตองสามารถที่จะ กรองขอมูลการเดินทางที่กําลังจะถึง  การเดินทางที่เสร็จแลว  
88: การเดินทางที่ยกเลิกได  
89: ระบบสําหรับคนขับรถ 
90: - ในสวนของคนขับรถจะตองทราบ ตารางการทํางานของตนเองในแตละวัน   
91: - คนขับรถ จะตองกดเริ่มการเดินทางในแตละรอบเวลาการเดินรถได  ซึ่งระบบจะตองแสดงใหชัดเจน วา  
92: ณ เวลานั้น ๆ มีงานใดที่คนขับจะตองทํางานบาง  
93: - คนขับจะตองสามารถดูไดวา ในรอบการเดินรถนั้นๆ  มี ผูใชบริการขึ้นกี่คนลงกี่คนในแตละสถานี และเปน 
94: ผูใชบริการคนไหน คนไหน 
95: - เมื่อถึงแตละจุดจอด  การขึ้นรถคนขับจะทําการสแกน qr code จากผูใชบริการวาไดจองการเดินทางมา
96: หรือไม หากผิดรอบจะไมสามารถขึ้นรถได 
97: - เมื่อถึงจุดปลายทางของแตละรอบ คนขับจะตองกดปดงานเพื่อเปนการปดรอบการเดินทางนั้นๆ และ
98: ระบบจะตองแสดงสรุปวา เสนทางนี้มีผูใชบริการทั้งหมดกี่คนและใครบางที่ไมไดมาใชบริการตามที่จองไว 
99: ระบบรายงาน (สําหรับ data science ใหเลือกทํา  3  ขอสําหรับสวนนี้ สําหรับ Embedded  ทําทุกขอ) 
100: หมายเหตุ  ในการทําระบบรายงานนักศึกษาจะตองลองใสขอมูลในตารางใหมีปริมาณจํานวนที่เยอะพอสมควร
101: เพื่อที่จะทําการออกรายงานได  ทั้งนี้ใหนักศึกษาทําเขาขอมูลโดยตรงผานการ insert ในฐานขอมูลเตรียมไว
102: เพื่อการออกรายงานไดเลย   
103: รายงานที่ 1 รายงานการเปรียบเทียบ จํานวนคนขึ้นรถและลงรถในแตละเปนรายป เชนเลือกป  2568  ผูใช
104: ตองการใหแสดงรายละเอียด และกราฟเพื่อเปรียบเทียบขอมูลดดังตอไปนี้ 
105: 
106: === PAGE 5 ===
107:  
108:  
109:  
110: รายงานที่ 2  รายงานรายป เชนเลือกป  2568 จะแสดงรายละเอียดสําหรับสถติการจอง โดยมีขอมูล จํานวน
111: การจอง  จํานวนที่นั่งที่ที่ถูกจอง การยกเลิก  Check-in สําเร็จ และ จํานวนคาที่จองแลวไมมาขึ้นรถ (No 
112: show) ในป 2568 ที่เลือกดังตัวอยางขอมูลและ กราฟที่จะตองสรางดานลาง 
113:   
114:  
115: 
116: === PAGE 6 ===
117:  
118:   
119:  
120: รายงานที่ 3 รายงานพฤติกรรมของผูใชภายในชวงวันที่ตองการ เชนอยากดู พฤติกรรมในชวง 12 เมษายน 2568 - 
121: 15 เมษายน 2568  จะแสดงเปนขอมูลสรุปในชวงนั้นทั้งหมด และ กราฟแสดงผล ดังตัวอยาง 
122: รายงานพฤติกรรมของผูใชภายในชวงวันที่ 12 เมษายน 2568 - 15 เมษายน 2568 
123: ผูใช การ
124: จอง
125: ทั้งหมด 
126: ขึ้นรถจริง ยกเลิก No Show 
127: สมชาย ใจดี 12 11 1 0 
128: สมหมาย ใจรัก 10 9 0 1 
129: สมควร ใจงาม 8 7 0 1 
130: อารีรัตน ศรีสุข 6 5 1 0 
131: วรพล เทพทอง 5 4 1 0 
132: 
133: === PAGE 7 ===
134: รวมทั้งหมด 41 36 3 2 
135:  
136:  
137:  
138:  
139:  
140: รายงานที่ 4 รายงานสรุปยอดผูใชแตละเสนทางรายวัน ผูใชจะสามารถเลือกชวงวันที่ที่ตองการ เชน วันที่ 1 
141: กันยายน -  7 กันยายน  โดยระบบจะทําการสรุปจํานวนผูใชบริการ ในแตละเสนทาง โดยจะแสดงเปนแตละวัน
142: ของสัปดาห และกราฟดังตัวอยาง  
143: หมายเหตุ หากชวงที่เลือกมีวันจันทร หรือวันอื่นๆมากกวา 1 ครั้งจะตองทําการรวมจํานวนทั้งหมดของวัน
144: นั้นๆมาแสดง 
145: จํานวนผูใชบริการในแตละวันในชวง 1 กันยายน 2568 – 7  กันยายน 2568 
146: วัน เสนทาง 1 เสนทาง 2 เสนทาง 3 รวมทั้งวัน 
147: จันทร 120 90 75 285 
148: อังคาร 110 85 80 275 
149: 0
150: 5
151: 10
152: 15
153: สมชาย ใจดี สมหมาย ใจรัก สมควร ใจงาม อารีรัตน์ ศรีสุข วรพล เทพทอง
154: จํานวนครัÊง
155: ผู้ใช้
156: พฤติกรรมผู้ใช้ 
157: (12 เมษายน 2568 - 15 เมษายน 2568)
158: การจองทัÊงหมด
159: ขึÊนรถจริง
160: ยกเลิก
161: No Show
162: สัดส่วนรวม ลูกค้าทุกราย
163: (12 เมษายน 2568 - 15 เมษายน 2568)
164: ขึÊนรถจริง
165: ยกเลิก
166: No Show
167: === PAGE 8 ===
168: พุธ 130 95 85 310 
169: พฤหัสบดี 115 92 88 295 
170: ศุกร 140 105 95 340 
171: เสาร 80 60 50 190 
172: อาทิตย 70 55 45 170 
173: รวมสัปดาห 765 582 518 1865 
174:  
175:  
176:  
177:  
178:  
179:  
180: รายงานที่ 5 รายงานการใชบริการในแตละ จุดจอดในแตละรอบเวลา  โดยใหแสดงเปน จํานวนคนขึ้น และ 
181: จํานวนคนลงในแตละจุดจอด ตามชวงวันที่ผูใชตองการ โดยเรียงตามจุดจอดและเวลาที่รถเริมออกในแตละจุด เชน
182: ถาผูใชตองการดูขอมูลตั้งแตวันที่ 1 กันยายน 2568 – 9 กันยายน 2568 จะแสดงขอมูลตามตัวอยางดานลาง 
183: รายงานการใชบริการในแตละจุดจอดตามรอบเวลาในชวงวันที่ 1 กันยายน – 9 กันยายน 
184: จุดจอด เวลา จํานวนขึ้น จํานวนลง 
185: มหาวิทยาลัยเทคโนโลยีมหานคร 09:30 120 0 
186: มหาวิทยาลัยเทคโนโลยีมหานคร 11:00 110 0 
187: มหาวิทยาลัยเทคโนโลยีมหานคร 13:00 130 0 
188: มหาวิทยาลัยเทคโนโลยีมหานคร 15:00 140 0 
189: โลตัส หนองจอก 09:45 95 88 
190: โลตัส หนองจอก 11:15 85 92 
191: โลตัส หนองจอก 13:15 100 110 
192: 0
193: 50
194: 100
195: 150จํานวนผู้ใช้บริการ
196: วัน
197: จํานวนผู้ใช้บริการแยกตามเส้นทาง 
198: (วันทีÉ 1 กันยายน 2568 - 7 กันยายน 2568)
199: เส้นทาง 1
200: เส้นทาง 2
201: เส้นทาง 3
202: === PAGE 9 ===
203: โลตัส หนองจอก 15:15 110 120 
204: รพ.หนองจอก 09:55 70 65 
205: รพ.หนองจอก 11:25 60 75 
206: รพ.หนองจอก 13:25 80 90 
207: รพ.หนองจอก 15:25 90 100 
208:  
209: รายงานที่ 6 รายงานสรุปการมอบหมายงานใหคนขับรถในชวงวันที่ ผูใชตองการทราบ โดยจะแบงจํานวนการ
210: มอบหมายงานเปน ชวงกอน 17.00 น.  และ หลัง 17.00 น.  เชนหากตองการทราบ รายงานการแบงงานในชวง
211: วันที่  1 – 30 เม.ย. 2568  จะแสดงรายละเอียด  และกราฟดังนี้ 
212: รายงานการแบงงานในชวงวันที่  1 – 30 เม.ย. 2568   
213: คนขับ รวมรอบทั้งหมด กอน 17:00 หลัง 17:00 
214: สมชาย ใจดี 25 18 7 
215: สมหมาย ใจรัก 20 15 5 
216: สมควร ใจงาม 18 12 6 
217: อารีรัตน ศรีสุข 15 10 5 
218: วรพล เทพทอง 12 8 4 
219: นันทนา ใจตรง 10 7 3 
220: รวมทั้งหมด 100 70 30 
221:  
222:  
223: รายงานที่ 7 รายงานจํานวนการมอบหมายงานใหรถแตละประเภท โดยดูจากประเภทเปนหลักแลวลงรายเอียดใน
224: แตละคันในประเภทนั้นๆ  ยกตัวอยางเชน หากผูใชเลือกดูขอมูลในชวงวันที่  1 -30 เมษายน 2568  จะแสดง
225: รายละเอียดขอมูล ดังตอไปนี้ 
226:  
227: 0
228: 5
229: 10
230: 15
231: 20
232: สมชาย ใจดี สมหมาย ใจรัก สมควร ใจงาม อารีรัตน์ ศรีสุข วรพล เทพทอง นันทนา ใจตรง
233: จํานวนรอบ
234: คนขับ
235: จํานวนรอบงานที่ไดรับ 
236: (กอน/หลัง 17:00)  1-30 เม.ย. 2568
237: ก่อน 17:00
238: หลัง 17:00
239: === PAGE 10 ===
240: รายงานจํานวนการมอบหมายงานใหรถแตละประเภทในชวงวันที่  1 -30 เมษายน 2568 
241: ประเภท รถ (ทะเบียน) จํานวนรอบ 
242: รถตู 9 ที่นั่ง สย 2591 28 
243: รถตู 9 ที่นั่ง สย 2599 25 
244: รถตู 9 ที่นั่ง ชย 7788 10 
245: รถบัส 20 ที่นั่ง บก 1130 22 
246: รถบัส 20 ที่นั่ง กข 4455 15 
247: รถมินิบัส 15 ที่นั่ง นน 5566 12 
248: รถมินิบัส 15 ที่นั่ง นม 8899 8 
249: สรุปแตละประเภทมีรอบรวมดังนี้ 
250: รถตู 9 ที่นั่ง รวมรถตู 9 ที่นั่ง 63 
251: รถบัส 20 ที่นั่ง รวมรถบัส 20 ที่นั่ง 37 
252: รถมินิบัส 15 ที่นั่ง รวมรถมินิบัส 15 ที่นั่ง 20 
253:  รวมทั้งหมด 240 
254:  
255:  
256:  
257:  
258: เกณฑการใหคะแนน 
259:      !!!!  คะแนนเต็มคือ 100  คะแนน สุดทายจะ weight เปน 30  คะแนน 
260: !!!! ที่ Highlight สีเหลืองในตารางคะแนน คือบังคับทํา โปรแกรมมิ่งในหนา UI   ทุกกลุม 
261: !!!  สําหรับกลุม data science หรือ data science + Embedded มีสวนใหเลือกทําโปรแกรมมิ่งในหนา UI  
262: คูกันคือ  
263: - ระบบหนา font + ระบบรายงาน 3  ขอ ( อาจารยกําหนดใหเลือกไวแลวในตาราง )  Highlight สีสมใน
264: ตารางคะแนน 
265: - ระบบการจอง  +  ระบบสําหรับคนขับ Highlight สีฟาในตารางคะแนน 
266: กลุม Data Science ที่เลือกทําคนละ ระบบ สามารถจับคูกันเพื่อทํา MOCKUP ทั้งระบบ และ ER 
267: DIAGRAM รวมกันได แผนงานใหทําแยกกัน  
268: !!!  สําหรับกลุม EMBEDDED   
269: === PAGE 11 ===
270: - ใหทําโปรแกรมหนา UI เพิ่มในสวนของระบบรายงาน ทั้งนี้ ใหเลือกทํา 5  ขอ จากทั้งหมด 7  ขอ เลือก
271: เองไดอิสระ  HIGHLIGHT สีเขียว 
272: ระบบ คะแนน 
273: Programming 
274: คะแนนการ 
275: ตอบคําถาม 
276: รวมคะแนน 
277: การออกแบบ ER  Diagram + mapping  
278: (สงแกไขได 2  ครั้ง) 10 คะแนน 
279: การวางแผนงาน แบบ Agile  ตองมีเอกสารชัดเจน ลง
280: ใน git หรือ click up  และสามารถทําได ตาม
281: แผนงาน 
282: 10 คะแนน 
283: MOCKUP ทั้งระบบ(สงแกไขได 2 ครั้ง) 10  คะแนน 
284: Login / Logout  เชคสิทธิ์ได ที่ตั้งไวในแตละ
285: พนักงานได  4 คะแนน 2 คะแนน 
286: 20 คะแนน เพิ่ม ลบ แกไข พนักงาน  4 คะแนน 3 คะแนน 
287: เพิ่ม ลบ แกไข สิทธิ์แบบ dynamic 4 คะแนน 3 คะแนน 
288: สําหรับ Data science และ MIX ที่เลือก ระบบจอง + ระบบสําหรับคนขับ  
289: ระบบการจอง  ในสวนของการจองและการตรวจสอบ
290: เงื่อนไขตางๆในการจอง  12 คะแนน 5 คะแนน 
291: 30 คะแนน 
292: ระบบการจอง ในสวนของการ gen QR Code เมื่อทํา
293: การจองสําเร็จ และสามารถที่จะดู การจองในแตละ
294: รอบที่กําลังจะมาถึงได 
295: 3 คะแนน 1 คะแนน 
296: ระบบการจอง  ในสวนของการยกเลิกตามเงื่อนไขที่
297: กําหนดไว และคืนที่นั่งในเสนทางที่จองไวได 6 คะแนน 3 คะแนน 
298: ระบบคนขับ ในสวนของการแสดงงานในแตละวัน  3 คะแนน 1 คะแนน 
299: 20 คะแนน 
300: ระบบคนขับ ในสวนของการกดเริ่มงานและ ดูขอมูล
301: ผูโดยสารขึ้นลงตามจุดจอดตางๆ  3 คะแนน 1 คะแนน 
302: ระบบคนขับ ในสวนของการเช็ค Qr Codeของ
303: ผูโดยสารได 3 คะแนน 1 คะแนน 
304: === PAGE 12 ===
305: ระบบ คะแนน 
306: Programming 
307: คะแนนการ 
308: ตอบคําถาม 
309: รวมคะแนน 
310: ระบบคนขับ ในสวนกดปดงานและสรุปยอดผูโดยสาร
311: ที่มาใชบริการจริง  5 คะแนน 3 คะแนน 
312: สําหรับ Data science และ MIX ที่เลือก ระบบ front +  3  รายงาน  
313: ระบบ front ในสวนของการจัดเสนทางเดินรถ  6 คะแนน 2 คะแนน 
314: 19 คะแนน ระบบ front ในสวนของการจัดรอบรถ การ
315: มอบหมายงาน และ มอบหมายรถ 8 คะแนน 3 คะแนน 
316: ระบบรายงาน  เลือกไดจาก  
317: รายงานที่ 1  หรือ 2 10 คะแนน 3 คะแนน 
318: 31 คะแนน 
319:  
320: ระบบรายงาน  เลือกไดจาก  
321: รายงานที่ 3 หรือ 4  หรือ 5   7 คะแนน 2 คะแนน 
322: ระบบรายงาน  เลือกไดจาก  
323: รายงานที่ 6 หรือ 7   7 คะแนน 2 คะแนน 
324: สําหรับ  กลุม Embedded  ใหเลือกทํา 5  รายงานจากรายงานทั้งหมด 
325: รายงานที่ 1   7 คะแนน 3 คะแนน 
326: 50  คะแนน 
327: รายงานที่ 2 7 คะแนน 3 คะแนน 
328: รายงานที่ 3 7 คะแนน 3 คะแนน 
329: รายงานที่ 4 7 คะแนน 3 คะแนน 
330: รายงานที่ 5  7 คะแนน 3 คะแนน 
331:  
332:  

(End of file - total 332 lines)
</content>
```

---

## Assistant (Build · Big Pickle · 22.8s)

_Thinking:_

The user asked: "ช่วย Review งาน จะต้องทำอะไรส่งบ้าง ตามข้อกำหนด ในไฟล์ MINI PROJECT SHUTTLE BUS.pdf" - "Help review the work, what needs to be submitted, according to the requirements in the file."

They want a review/summary of deliverables. But I don't know which group they are (Programming, Data Science, Mixed, Embedded). The scoring table has group-specific requirements. I should give a summary of all deliverables and ask which group they're in, or present all.

Let me give a concise but complete deliverable checklist. The user asked for a review of what must be submitted. Let me be organized but concise. Since this is inherently a detailed request, I can exceed 4 lines.

Let me structure:

**สิ่งที่ต้องส่ง (ทุกกลุ่ม)**
1. ER Diagram + mapping (10 คะแนน) — แก้ไขได้ 2 ครั้ง
2. แผนงาน Agile — เอกสารใน git หรือ clickup (10)
3. MOCKUP ทั้งระบบ (10)
4. ระบบ Master 1: จัดการพนักงาน เพิ่ม/ลบ/แก้ไข, ระบุแผนก+ตำแหน่ง (3)
5. ระบบ Master 2: สิทธิ์ Dynamic (เพิ่ม/ลบ/แก้ไข) ไม่ fix (3)
6. ระบบ Master 3: Login/Logout + เช็คสิทธิ์ (2)
7. ระบบ front: จัดเส้นทางเดินรถ (จุดจอดหลายจุด, จุดอยู่ได้หลายเส้นทาง, เวลานาทีต่อจุด, รวมเวลาเส้นทาง) (2)
8. ระบบ front: จัดรอบเวลา + มอบหมายงานคนขับ + มอบหมายรถ + ตรวจชนกัน (3)

**เฉพาะ Data Science / Mix (ที่เลือกระบบจอง+คนขับ)** — 30 คะแนน
- ระบบการจอง: เงื่อนไขการจอง (5), gen QR + ดูรอบที่กำลังจะมาถึง (1), ยกเลิก+คืนที่นั่ง (3)
- ระบบคนขับ: ตารางงานรายวัน (1), กดเริ่มงาน+ดูผู้โดยสารขึ้น/ลง (1), เช็ค QR (1), กดปิดงาน+สรุปยอด/no show (3)

**ระบบรายงาน**
- Data Science/Mix: เลือก 3 ข้อ (ข้อ 1 หรือ 2) (3), (3/4/5) (2), (6/7) (2)
- Embedded: ทำ 5 ข้อ จาก 7 ข้อ (3 คะแนนต่อข้อ)

**Data เตรียม**: ต้อง insert ข้อมูลปริมาณมากๆ ผ่าน SQL โดยตรง (รายงาน + master file ที่ไม่ทำเป็นโปรแกรม)

**ข้อสังเกต/จุดเสี่ยง**:
- คะแนนเต็ม 100 → weight เป็น 30
- คะแนนถามตอบ
- Mockup และ ER แก้ได้ 2 ครั้ง
- รอบเวลา 9.30/11.00/13.00/15.00

Also important business rules to note:
- จองก่อนเวลาถึงจุดจอด 20 นาที
- user ละไม่เกิน 4 คน
- เช็คที่นั่งว่าง
- QR check in
- ยกเลิกคืนที่นั่ง
- คนขับสแกน QR ผิดรอบขึ้นไม่ได้
- ปิดงานสรุปคนที่มา/ไม่มา

I should ask which group. Let me use the question tool? Actually the user just asked for a review. I'll give the full review and ask which group at the end. Better: give the checklist, then ask. Let me use the question tool to narrow it. Hmm, but that might be annoying. I'll present the summary and ask at the end in text.

Actually, the question tool would be useful to determine their group so I can give a precise checklist. But I can present everything compactly and ask. Let me just present it.

Let me keep it reasonably tight.

อ่านไฟล์ได้แล้ว (12 หน้า) — สรุปสิ่งที่ต้องส่งตามข้อกำหนด:

## ส่งทุกกลุ่ม (20 คะแนน + 2 คะแนนถามตอบ)
| รายการ | คะแนน |
|---|---|
| ER Diagram + mapping (แก้ได้ 2 ครั้ง) | 10 |
| แผนงาน Agile (เอกสารใน git/clickup) | 10 |
| MOCKUP ทั้งระบบ (แก้ได้ 2 ครั้ง) | 10 |
| Master.1 จัดการพนักงาน เพิ่ม/ลบ/แก้ไข + ระบุแผนก/ตำแหน่ง | 3 |
| Master.2 สิทธิ์แบบ Dynamic เพิ่ม/ลบ/แก้ไขได้ (ห้าม fix) | 3 |
| Master.3 Login/Logout + เช็คสิทธิ์ตามที่ตั้งไว้ | 2 |

## ระบบ Front (10 คะแนน — 3 คะแนนถามตอบ)
1. **จัดเส้นทางเดินรถ** (2) — 1 เส้นทางมีหลายจุดจอด / จุดจอดอยู่ได้หลายเส้นทาง / เก็บนาทีต่อจุด + รวมเวลารอบ
2. **จัดรอบเวลา + มอบหมายคนขับ/รถ** (3) — ตรวจชนกัน: รถคันเดียวกัน/คนขับคนเดียวกันห้ามซ้ำเวลาเดียวกัน, แก้ไขได้ตลอดเวลา

## ระบบจอง + คนขับ (30 คะแนน — 5 คะแนนถามตอบ) *เฉพาะ Data Science / Mix*
- **จอง** — เงื่อนไข: ต้องจองก่อนรถถึงจุดขึ้น ≥20 นาที, ไม่เกิน 4 คน/user, เช็คที่นั่งว่างพอ (5)
- **จอง** — gen QR Code + ดูรอบที่กำลังจะมาถึง/กรองสถานะ (1)
- **จอง** — ยกเลิกได้ + คืนที่นั่ง (3)
- **คนขับ** — ตารางงานรายวัน (1), กดเริ่มงาน + ดูผู้โดยสารขึ้น/ลงรายจุด (1), สแกน QR (ผิดรอบขึ้นไม่ได้) (1), กดปิดงาน + สรุปยอด/no-show (3)

## ระบบรายงาน (31 คะแนน — 2 คะแนนถามตอบ)
- **Data Science / Mix:** เลือก 3 ข้อ → (รายงาน 1 หรือ 2) + (3/4/5) + (6/7) = 3+2+2 คะแนน
- **Embedded:** ทำ 5 ข้อ จากทั้ง 7 ข้อ อิสระ = 3 คะแนน × 5

## ข้อบังคับสำคัญ
- **Data ต้อง insert ผ่าน SQL ตรง ๆ** ให้เยอะพอ (โดยเฉพาะรายงาน) — Master file ที่ไม่ทำเป็นโปรแกรมก็ใส่ข้อมูลตรงได้
- เส้นทางตัวอย่าง: เส้นทาง 1 = 30 นาที/7 จุด, เส้นทาง 2 = 13 นาที/4 จุด, เส้นทาง 3 = 12 นาที/5 จุด
- รอบเวลาตัวอย่าง: 9.30 / 11.00 / 13.00 / 15.00
- คะแนนเต็ม 100 → **weight สุดท้าย 30 คะแนน**

---

คุณอยู่กลุ่มไหนครับ (Programming / Data Science / Mix / Embedded)? จะได้เช็ครายการให้ตรงกลุ่มและช่วยวางแผนงาน Agile ให้

---

## User

ช่วยแนะนำ หัวขอการจัดทำรายงานเสนอ โครงการ ที่เหมาะสมต่อการทำ System Analyze เอกสารออกแบบ Diagrame เพิมจากข้อกำหนด และรีวิว หัวข้อที่จะต้องจัดทำ้

---

## Assistant (Build · Big Pickle · 43.0s)

_Thinking:_

The user wants recommendations for report/document structure suitable for System Analysis — additional document design/diagram topics beyond the PDF requirements, and a review of topics they need to produce.

They want:
1. Recommended report heading structure (รายงาน) for System Analysis document
2. Additional diagrams/documents beyond the PDF requirements
3. Review of topics to produce

Let me give a comprehensive answer. This is a documentation/advice task, no code needed necessarily. But maybe I should also create the document? The user said "ช่วยแนะนำ" = "please recommend". So give recommendations first.

Let me structure a proper System Analysis document outline for a Shuttle Bus System mini project, mapping to the 7 reports + mandatory systems, and add standard SA documents (BRS/SRS, use case, DFD, ER, data dictionary, sequence diagram, activity diagram, state machine, use case diagram, context diagram, traceability matrix, test plan, UI mockup, deployment, etc.)

I should be organized and thorough but the guidelines say concise. However this is an explicit request for detailed recommendations, so a longer structured answer is warranted. Let me be practical.

Let me write it out. I'll use Thai.

Key sections:
1. โครงสร้างเอกสารรายงาน (Chapter outline)
2. เอกสาร/ไดอะแกรมมาตรฐานที่ควรเพิ่ม (beyond PDF) — grouped by phase
3. Review checklist of topics required
4. แนะนำ ER diagram entity list
5. Traceability matrix suggestion

Let me also consider they might want me to generate these. I'll offer at the end.

Let me include a recommended entity list for ER since that's foundational.

I'll write it now. Should I ask questions first? They already asked for recommendations. Just deliver.

Let me make the entity list concrete:

Master:
- Employee/Staff (พนักงาน): emp_id, name, position, dept_id, phone, username, password, status
- Department (แผนก): dept_id, dept_name
- Position (ตำแหน่ง): pos_id, pos_name
- Role/RoleType: role_id, role_name (admin, user, driver)
- Permission/Menu: menu_id, menu_name, parent, screen_key
- Role_Permission: dynamic
- Employee_Role: dynamic (ตามข้อกำหนด "มีแค่ admin กับ user หรือไม่ fix ว่า admin เข้าได้ทุกหน้า ต้องแก้ไขได้ตลอดเวลา")

Front:
- Stop (จุดจอด): stop_id, name, address, lat, lng
- Route (เส้นทาง): route_id, name, total_minutes
- Route_Stop (จุดจอดในเส้นทาง): route_id, stop_id, seq, travel_minutes, dwell_minutes
  - note: total_minutes = SUM(travel)
- Schedule/รอบเวลา: schedule_id, route_id, service_date, depart_time
- Schedule_Stop: schedule_id, stop_id, seq, arrive_time, depart_time
- Vehicle (รถ): veh_id, plate, type, capacity
- Vehicle_Type: capacity
- Driver assignment = employee with role driver

Booking:
- Booking: booking_id, cust_id, schedule_id, board_stop_id, alight_stop_id, seats, status(booked/checked_in/cancelled/no_show), book_time, qr_token
- CheckIn: checkin_id, booking_id, checkin_time, scan_stop, status
- NoShow tracking

Driver runtime:
- Trip / Trip_Stop_Actual: schedule run actual, actual_depart, actual_arrive
- Trip_Passenger: trip_id, booking_id, board_actual, alight_actual

Report support (need these facts recorded!):
- facts must capture: seats booked per schedule, board/alight counts per stop per time, checkin, no-show, driver assignment, vehicle assignment

Important: Point out the gap — PDF asks reports on data that must be recorded. E.g., "no show" requires driver closing trip and marking who didn't show. "ขึ้น/ลง at each stop" requires trip-level actual boarding/alighting records. So the ER must include those.

Also note: report 5 needs per-stop per-time board/alight — implies Route_Stop + Schedule + Trip.

Let me write the answer.

Also add "เอกสารที่ควรเพิ่มนอกเหนือจาก PDF" as a table with purpose.

Let me be careful about length — this is a detail request so a longer answer is fine, but I'll keep it tight and scannable.

## 1. โครงสร้างเอกสารรายงาน (System Analysis Document) — แนะนำ

| บท | เนื้อหา |
|---|---|
| **บท 1** | บทนำ — ที่มา/ความสำคัญ, ขอบเขต, วัตถุประสงค์, ผู้ใช้งาน, กลุ่มผู้ใช้บริการ |
| **บท 2** | ทบทวนข้อกำหนด (Requirements) — แปลง PDF → Requirement แต่ละข้อให้เป็น Requirement ID |
| **บท 3** | กระบวนการปัจจุบัน (As-Is) + ปัญหา |
| **บท 4** | กระบวนการที่จะสร้าง (To-Be) + โอกาสในการปรับปรุง |
| **บท 5** | **Use Case Diagram + Use Case Specification** (ผู้ใช้ 4 บทบาท: Admin / Staff / Driver / Customer) |
| **บท 6** | **Data Flow Diagram** — Context Diagram → DFD Lv0 → DFD Lv1/Lv2 |
| **บท 7** | **ER Diagram (Conceptual → Logical → Physical)** + Mapping ตามข้อกำหนด 10 คะแนน |
| **บท 8** | **Data Dictionary** — รายละเอียดทุกตาราง/ฟิลด์/ชนิด/ขนาด/ค่า default/คีย์ |
| **บท 9** | **Sequence Diagram** — Login, จองรถ, ยกเลิกรถ, คนขับสแกน QR, ปิดรอบงาน |
| **บท 10** | **State Machine / Activity Diagram** — สถานะการจอง (Reserved → CheckedIn → Completed / Cancelled / NoShow) |
| **บท 11** | **Class Diagram** (ถ้าเป็น OOP) |
| **บท 12** | โครงสร้างฐานข้อมูล + **ตัวอย่างข้อมูลจำนวนมาก** (insert สคริปต์) |
| **บท 13** | แบบ Mockup ทั้งระบบ (10 คะแนน) |
| **บท 14** | แผนการทดสอบ (Test Plan + Test Case) — เทียบกับ Requirement |
| **บท 15** | **Traceability Matrix** — Requirement ↔ Use Case ↔ Table ↔ Screen ↔ Test |
| **บท 16** | ข้อจำกัด / ปัญหา / งานในอนาคต |
| **ภาคผนวก** | Glossary, Source Code, Screenshot, ER/แผนงาน Agile ที่ commit ใน git/clickup |

---

## 2. เอกสาร/ไดอะแกรมที่ควร **เพิ่ม** นอกเหนือจาก PDF

**ที่แนะนำให้มี (คิดเป็นคะแนน Programming + เตรียมถามตอบ):**
- Context Diagram และ DFD — PDF ไม่ได้บังคับ แต่เป็นหัวใจ System Analysis และอาจารย์มักถาม
- Data Dictionary — ไม่บังคับ แต่เป็นหลักฐานว่า ER ครบ
- Use Case Specification (พร้อม Precondition / Postcondition / Business Rule) — ครอบคลุมเงื่อนไข 20 นาที / 4 คน / เช็คที่นั่ง
- Sequence Diagram — โชว์ flow การจอง + การเช็คที่นั่งชัดเจน
- State Diagram ของ Booking — จำเป็นมาก เพราะรายงาน 2 และรายงาน 3 อาศัยสถานะพอดี
- Traceability Matrix — โอกาสได้ถาม "ทำครบตาม requirement ไหม"
- Test Case — เตรียมคำถาม "ทดสอบยังไง"

**ที่พิจารณาแล้ว อาจไม่ต้องทำ (เวลาน้อย):**
- SADT / IDEF0, Petri Net, Class Diagram แบบเต็ม, 3-tier Deployment Diagram

---

## 3. Review: หัวข้อที่ต้องจัดทำ — จุดเสี่ยงที่พบ

### ⚠️ ช่องว่างสำคัญ: Requirement ไม่ได้บอกให้เก็บข้อมูลสำหรับรายงาน
รายงาน 1–7 ต้อง query ข้อมูลที่ **ต้องบันทึกจริง** ถ้าไม่มีตารางรองรับ รายงานทำไม่ได้ ต้องเพิ่มใน ER:

| Requirement | ต้องมีตารางรองรับ |
|---|---|
| รายงาน 1: คนขึ้น/ลง **รายสัปดาห์** | ต้องเก็บ *จำนวน* ขึ้น/ลง แยกต่อเส้นทางต่อวัน (ไม่ใช่นับจาก booking สด ๆ เพราะขึ้น-ลงคนละคน) |
| รายงาน 2: Check-in สำเร็จ / No Show | `CheckIn` + สถานะ `no_show` ที่ถูก mark ตอนคนขับกดปิดรอบ |
| รายงาน 3: พฤติกรรมราย user | join `Booking` กับสถานะ |
| รายงาน 4: ผู้ใช้รายวันรายเส้นทาง | `Booking` + `Schedule` join |
| รายงาน 5: ขึ้น/ลง **รายจุดจอด ตามเวลารถออก** | `Schedule_Stop` (arrival/departure จริง) + `Trip_Passenger` (จุดขึ้น/ลงจริง) |
| รายงาน 6: รอบงานคนขับ ก่อน/หลัง 17:00 | `Schedule.depart_time` + `Driver_Assignment` |
| รายงาน 7: รอบต่อรถ/ประเภทรถ | `Vehicle` + `Vehicle_Type` + assignment |

### ⚠️ Logic ต้องเตรียมให้ตรง
- **เวลารวมเส้นทาง** = ผลรวมนาทีจากแต่ละจุด (เส้นทาง 1 = 5+3+6+3+3+10 = **30** นาที ✓) → คำนวณอัตโนมัติไม่ควรให้ user พิมพ์เอง
- **เวลาที่รถถึงจุดจอด** = เวลาออก + ผลรวมนาทีถึงจุดนั้น → ใช้กับเงื่อนไขจอง 20 นาที
- **เงื่อนไข 20 นาที** = `arrival_time(จุดขึ้น) - now >= 20`
- **เช็คที่นั่ง** = `capacity(รถ) - SUM(seats ที่ยัง active ในรอบนั้น)`
- **ผิดรอบสแกนไม่ได้** = เทียน `booking.schedule_id` กับรอบที่คนขับกดเริ่ม
- **คืนที่นั่งตอนยกเลิก** = booking เปลี่ยนเป็น `cancelled` → SUM เลยไม่นับ

### ⚠️ Master 2 (สิทธิ์ Dynamic)
PDF เขียนชัดว่า *"ไม่ fix ว่า admin เข้าได้ทุกหน้า ต้องแก้ไขได้ตลอดเวลา"* → ต้องมีตารางประมาณนี้
`Role` | `Permission` (รายหน้าจอ/ฟังก์ชัน) | `Role_Permission` (M:N) | `Employee_Role`
ห้าม hardcode `if (admin) { ... }` ในโค้ด

### ⚠️ ข้อสังเกตอื่น
- PDF หน้า 3 ตัวอย่างรอบรถ **รถคันเดียวกันซ้ำเวลาเดียวกันได้** (เช่น สย 2591 ทั้ง 9.30 และ 11.00) → เป็นคนละรอบจึงไม่ขัด แต่ต้อง define "ชนกัน" ให้ชัด (ทั้งคนขับและรถ ต่อช่วงเวลา)
- รอบเวลา 9.30/11.00/13.00/15.00 = **รอบต่อวัน** ต้องมี `service_date` ไม่ใช่แค่ time
- "เฉพาะ Master file อื่นๆ" ให้ insert ตรงได้ → เตรียมไฟล์ SQL seed แยกเป็น `seed_master.sql` / `seed_report.sql` (รายงานต้องเยอะ)

---

## 4. ER ขั้นต่ำที่ต้องมี

**Master** — `Department`, `Position`, `Employee`, `Vehicle_Type`, `Vehicle`, `Role`, `Permission`, `Role_Permission`, `Employee_Role`
**Front** — `Stop`, `Route`, `Route_Stop` (seq, travel_minutes), `Schedule` (route, service_date, depart_time, capacity), `Schedule_Stop` (seq, arrive_time), `Driver_Assignment`, `Vehicle_Assignment`
**Booking** — `Booking` (status: reserved / checked_in / completed / cancelled / no_show), `Trip`, `Trip_Passenger`
**Customer** — อาจใช้ `Employee` รวม (role = customer) หรือแยก `Passenger`

---

ต้องการให้ผมลงมือทำอะไรต่อไหมครับ เช่น
- ร่าง **ER Diagram + Data Dictionary** ฉบับเต็ม
- ร่าง **Use Case Diagram + Specification**
- เขียน **SQL script** สร้างตาราง + seed ข้อมูลจำนวนมากสำหรับรายงาน
- ร่างโครง **เอกสารรายงาน** เป็นไฟล์ Markdown/MDX ให้เติมเนื้อหา

---

## User

ช่วยรีวิวสิ่งที่ต้องทำตามข้อกำหนด เพิ่มจากเอกสาร หากจะต้องระบุ ที่จะต้องพัฒนา เพิ่มในรายงาน หัวข้อ บท 17 Full stack ที่จะทำงานโครงการนี้ คือ ใช้ React + SQLและ ใช้ Flutter และRest API และ  โดยวางแผนการดำเนินงานในบทที่ 18 หัวข้อกำดำเนินงาน ที่มีระบุ Task งานที่จะใช้ในการพัฒนา ตามคอมเซ็บ agile development ที่แบ่งงานเป็น Scrum Divides work into fixed time-boxes (sprints) lasting 1 day with daily stand-up meetings โดยทำงานใช้ Agentic AI  เป็นผู้ช่วยดำเนินงาน

---

## Assistant (Build · Big Pickle · 126.9s)

_Thinking:_

The user wants:
1. Review requirements from the document, plus additions
2. Chapter 17: Full stack — React + SQL, and Flutter + REST API
3. Chapter 18: Development roadmap — Task list for development, using Agile Scrum with 1-day sprints and daily stand-ups, working with Agentic AI as assistant

This is a documentation task. I should produce a full document. Let me think about whether to write it to a file or output it. The user says "เพิ่มในรายงาน หัวข้อ บท 17" — add to the report as chapter 17. This suggests producing the content.

Given it's substantial, I should probably write files. But the working directory only has the PDF. Let me ask... no, the user is fairly clear. Let me produce a well-structured document.

Actually, the best approach: write the content to markdown files in the working directory. But it's a lot of content. Let me consider — the user has been asking for review/advice. Now they want chapters 17 & 18 drafted. I think writing to files makes most sense so they can use it in their report.

Let me plan the technical architecture first, then write.

**Chapter 17: Full Stack**
- Technology stack
- Architecture: 3-tier
- Backend: which? React + SQL → for full stack web. REST API. Node.js + Express? Or the user says "React + SQL" for one, "Flutter + REST API" for another. Hmm, re-reading: "ใช้ React + SQLและ ใช้ Flutter และRest API" — Use React + SQL, and use Flutter with REST API.

So likely:
- Web frontend: React
- Mobile: Flutter
- Backend: REST API
- Database: SQL

The "+SQL" suggests React talking to SQL directly? Or React frontend + SQL database. And Flutter + REST API. I think the intent is: two client apps (React web + Flutter mobile) both consuming REST API backed by SQL database.

Let me design: 
- Backend: Node.js + Express + SQL (MySQL/PostgreSQL)
- Web: React (Vite) + React Router + Axios/Fetch + Chart library (Recharts/Chart.js)
- Mobile: Flutter + http/dio + qr_scanner (mobile_scanner) + mobile_scanner for QR scanning + fl_chart
- QR generation: server-side (qrcode npm) or client-side

QR: driver scans QR using Flutter app with mobile_scanner. That's why Flutter matters.

Roles:
- Admin/Staff → React web
- Customer → React web + Flutter
- Driver → Flutter (scan QR)

That's a sensible split. Let me confirm that reasoning and present it.

**Chapter 18: Development plan**
- Scrum with 1-day sprints
- Task list per sprint
- Daily stand-up
- Agentic AI as assistant

Team size unknown. Assume 3-4 members + AI. Let me design ~10-12 sprints? With 1-day sprints that's short. Let me do a realistic schedule.

Let me think about total scope. Let me do 12 sprints (12 working days) with clear deliverables. Or structure by phases.

Actually let me structure it as: Sprint 0 (setup) + Sprint 1..12. Each sprint has: goal, tasks (with task ID, estimate in hours, assignee role, AI usage, deliverable, acceptance criteria).

Let me make a solid WBS with Task IDs matching the requirements (M1, M2, M3, F1, F2, B1-B4, D1-D4, R1-R3, DOC, etc.)

Let me build the backlog:

**Epic E0: Project Setup & Documentation**
- E0.1 Init repo, git, clickup
- E0.2 ER Diagram + mapping
- E0.3 Requirement spec / Requirement ID
- E0.4 Use Case Diagram + Spec
- E0.5 DFD
- E0.6 Data Dictionary
- E0.7 Mockup (Figma)
- E0.8 Agile docs into git/clickup

**Epic E1: Database**
- E1.1 Schema design (DDL)
- E1.2 Migration script
- E1.3 Seed master data
- E1.4 Seed bulk data for reports
- E1.5 Constraint & FK check
- E1.6 Stored procedures/views for reports (optional)

**Epic E2: Backend Core (Auth + Master)**
- E2.1 API skeleton (Express project, config, DB pool)
- E2.2 Login API + JWT
- E2.3 Logout + token blacklist / refresh
- E2.4 RBAC middleware (dynamic permission check)
- E2.5 Department/Position CRUD
- E2.6 Employee CRUD
- E2.7 Role CRUD
- E2.8 Permission CRUD
- E2.9 Role_Permission mapping CRUD
- E2.10 Employee_Role CRUD

**Epic E3: Backend Front (Route/Schedule)**
- E3.1 Stop CRUD
- E3.2 Route CRUD + total_minutes auto-calc
- E3.3 Route_Stop CRUD (multi-route stop validation)
- E3.4 Schedule CRUD (per route, per date)
- E3.5 Schedule_Stop auto-generate arrival/departure times
- E3.6 Vehicle & Vehicle_Type CRUD
- E3.7 Driver assignment + conflict check
- E3.8 Vehicle assignment + conflict check
- E3.9 Schedule list/board view

**Epic E4: Backend Booking**
- E4.1 Booking create API
- E4.2 Available trip query (20-min rule)
- E4.3 Seat availability check
- E4.4 Max 4 seats per user validation
- E4.5 QR token generation
- E4.6 Cancel booking + release seat
- E4.7 My bookings list + filter (upcoming/completed/cancelled)
- E4.8 Transaction/locking for seat race condition

**Epic E5: Backend Driver**
- E5.1 Driver daily schedule
- E5.2 Start trip (check conflict with ongoing work)
- E5.3 Trip passenger list per stop
- E5.4 QR check-in validation (wrong trip reject)
- E5.5 Complete trip + no-show marking
- E5.6 Trip summary

**Epic E6: Backend Reports**
- E6.1 Report 1 or 2 API
- E6.2 Report 3/4/5 API
- E6.3 Report 6/7 API
- E6.4 Aggregation queries optimization

**Epic E7: Web Frontend (React)**
- E7.1 Project setup, routing, layout, auth store
- E7.2 Login page
- E7.3 Route/Master screens
- E7.4 Employee screen
- E7.5 Permission/Role screen
- E7.6 Route & schedule screens
- E7.7 Booking flow screens
- E7.8 My bookings + QR display
- E7.9 Report screens + charts
- E7.10 UI guard / menu by permission

**Epic E8: Flutter App**
- E8.1 Project setup, routing, theme
- E8.2 Login/Logout
- E8.3 Customer booking flow
- E8.4 QR display
- E8.5 My bookings
- E8.6 Driver daily schedule
- E8.7 Start trip + passenger manifest
- E8.8 QR scanner + check-in
- E8.9 Complete trip + summary

**Epic E9: Test & Data**
- E9.1 Test plan + test cases
- E9.2 Unit/integration test
- E9.3 UAT
- E9.4 Performance/seed validation
- E9.5 Traceability matrix

**Epic E10: Docs & Report**
- E10.1 Report chapters
- E10.2 Deployment guide
- E10.3 Presentation/Mockup final

Now sprints (1 day each). Let me do Sprint 0 to Sprint 11, 12 sprints = ~3 weeks. That seems reasonable for a mini project with AI assistance. Maybe I'll do 12-14.

Let me lay out with a day number, and a burndown.

Also need: daily stand-up template, sprint ceremony, Definition of Done, roles.

Agentic AI usage section — this is important to the user. Let me detail:
- How AI is used per task type
- Prompt patterns / prompt library
- AI usage policy: AI ช่วยเขียน แต่นักศึกาตรวจทานเอง, ต้องอ่านเข้าใจ, ห้าม commit secret, credit AI ในรายงาน
- AI agent roles: Code Agent, Review Agent, Test Agent, Doc Agent, Data Gen Agent
- Guardrails

Let me also add a "review" section of gaps/additions to requirements.

Now, should I write to file? Yes, I think writing two markdown files is the right deliverable. Let me create them in D:\data\miniproject.

Let me name them:
- `บทที่ 17 - Full Stack.md`? Thai filenames may cause issues. Better: `chapter-17-fullstack.md` and `chapter-18-development-plan.md`. Or match their report naming. Let me use safe names.

Actually let me put them in a docs folder.

Let me write these now. They need to be substantial and useful.

Let me be careful about being concise in my *response* text but the files can be detailed.

Let me write chapter 17.

I should double check: does the project directory have anything? Only the PDF. OK.

Let me create the files.

For chapter 17, I want:
17.1 Overview / Architecture
17.2 Technology selection & justification
17.3 System architecture (3-tier, deployment)
17.4 Database design (tables, ER summary, relationships)
17.5 Backend design (REST API spec, layers, auth, RBAC)
17.6 Web frontend React
17.7 Mobile Flutter
17.8 API contract (endpoints table)
17.9 Integration between apps
17.10 Security
17.11 Non-functional
17.12 Tools & environment

Let me include an actual ER in mermaid so they can render it. That's valuable.

Let me write.

For API spec, I'll list endpoints by module.

Let me now write the file content.

I need to be careful about mermaid ER diagram syntax:
```mermaid
erDiagram
    DEPARTMENT ||--o{ EMPLOYEE : has
    EMPLOYEE {
        emp_id PK
        emp_code UK
        first_name
        last_name
    }
```
Types can't have spaces. OK.

Let me write out a good ER.

Entities:
- DEPARTMENT (dept_id, dept_name)
- POSITION (pos_id, pos_name)
- EMPLOYEE (emp_id, emp_code, first_name, last_name, phone, email, dept_id FK, pos_id FK, username UK, password_hash, status, created_at)
- ROLE (role_id, role_name, description)
- PERMISSION (perm_id, perm_code UK, perm_name, module)
- ROLE_PERMISSION (role_id FK, perm_id FK, PK composite)
- EMPLOYEE_ROLE (emp_id FK, role_id FK)
- STOP (stop_id, stop_name, address, lat, lng, status)
- ROUTE (route_id, route_name, total_minutes, status)
- ROUTE_STOP (route_id FK, stop_id FK, seq, travel_minutes, PK composite)
- VEHICLE_TYPE (vtype_id, vtype_name, capacity)
- VEHICLE (veh_id, plate_no UK, vtype_id FK, status)
- SCHEDULE (sched_id, route_id FK, service_date, depart_time, status)
- SCHEDULE_STOP (sched_stop_id, sched_id FK, stop_id FK, seq, arrive_time, depart_time)
- DRIVER_ASSIGN (assign_id, sched_id FK, emp_id FK, assign_date)
- VEHICLE_ASSIGN (assign_id, sched_id FK, veh_id FK, assign_date)
- BOOKING (booking_id, booking_code, cust_id FK, sched_id FK, board_stop_id FK, alight_stop_id FK, seats, status, book_time, qr_token UK, cancel_time)
- TRIP (trip_id, sched_id FK, driver_id FK, veh_id FK, start_time, end_time, status)
- TRIP_PASSENGER (trip_id FK, booking_id FK, board_time, alight_time, checkin_result)

Hmm, for report 1 (คนขึ้น/ลงรายสัปดาห์) and report 5 (ขึ้น/ลงรายจุดตามเวลารถออก) we need these. TRIP_PASSENGER gives board_time/alight_time. Good.

Note: capacity comes from VEHICLE_TYPE via VEHICLE → SCHEDULE via VEHICLE_ASSIGN.

Good.

Now let me write. I'll write the two files.

Actually, I realize I should double-check the working directory is writable and create files. Let me just write.

Let me also make the file reasonably complete but not insanely long. I'll aim for solid, well-structured content.

Let me write chapter 17 file.

จัดให้ครับ — สร้างเป็นไฟล์ใน `D:\data\miniproject\docs\` เลย

**Tool: write**

**Input:**
```json
{
  "filePath": "D:\\data\\miniproject\\docs\\chapter-17-fullstack.md",
  "content": "# บทที่ 17 : Full Stack Development\n\n> ส่วนนี้อธิบาย \"ระบบที่สร้างขึ้นจริง\" ทั้งด้านสถาปัตยกรรม เทคโนโลยี โครงสร้างฐานข้อมูล\n> REST API และแอปพลิเคชันทั้ง 2 ฝั่ง (React / Flutter) เพื่อให้ครอบคลุมกับข้อกำหนดในบทที่ 2–16\n\n---\n\n## 17.1 ภาพรวมระบบ (System Overview)\n\nระบบ SHUTTLE BUS SYSTEM ประกอบด้วย 3 ชั้น (3-Tier Architecture)\n\n```\n┌────────────────────────────┐   ┌────────────────────────────┐\n│   Web Application          │   │   Mobile Application       │\n│   React 18 + Vite          │   │   Flutter 3.x              │\n│   (Admin / Staff / User)   │   │   (Driver / User)          │\n│   Port : 5173              │   │   Android / iOS           │\n└────────────┬───────────────┘   └────────────┬───────────────┘\n             │  HTTPS / JSON (REST)            │  HTTPS / JSON (REST)\n             │  Bearer <JWT>                   │  Bearer <JWT>\n             └───────────┬─────────────────────┘\n                         ▼\n        ┌────────────────────────────────────────────┐\n        │   REST API Backend  (Node.js + Express)   │\n        │   Port : 3000                              │\n        │  ┌──────────────────────────────────────┐  │\n        │  │ Middleware : JWT Auth / RBAC / Log   │  │\n        │  │ Controller → Service → Repository    │  │\n        │  │ QR Generator (qrcode)                │  │\n        │  └──────────────────────────────────────┘  │\n        └────────────────────┬───────────────────────┘\n                             │  mysql2 (connection pool)\n                             ▼\n        ┌────────────────────────────────────────────┐\n        │   Relational Database  (MySQL 8.0)         │\n        │   4 schema groups : Master / Front /        │\n        │   Booking / Trip                            │\n        └────────────────────────────────────────────┘\n```\n\n### 17.1.1 การกระจายแอปพลิเคชันให้ผู้ใช้แต่ละกลุ่ม\n\n| ผู้ใช้ | บทบาท (Role) | แอปที่ใช้ | เหตุผล |\n|---|---|---|---|\n| ผู้ดูแลระบบ | Admin | **React (Web)** | ต้องเห็นข้อมูลทั้งหมดเป็นตาราง ปรับตั้งค่าระบบได้ |\n| พนักงานสำนักงาน | Staff | **React (Web)** | จัดการเส้นทาง/รอบ/รถ เป็นงานฟอร์ม |\n| คนขับรถ | Driver | **Flutter (Mobile)** | ต้องถืออุปกรณ์ขณะขับรถ + **สแกน QR Code** ริมทาง |\n| นักศึกษา / เจ้าหน้าที่ (ผู้โดยสาร) | Customer | **React (Web)** และ/หรือ **Flutter (Mobile)** | จองรถ, ดู QR, ยกเลิก |\n\n> **เหตุผลเชิงเหตุผล (Justification) — สำคัญสำหรับการตอบคำถามอาจารย์**\n> คนขับรถต้องสแกน QR Code ของผู้โดยสารที่จุดจอด ซึ่งต้องใช้ **กล้องหลังมือถือ** ดังนั้น\n> ฝั่ง Driver จึงต้องเป็น Mobile App (Flutter) เพราะ React Web ไม่สามารถเข้าถึงกล้องได้อย่าง\n> เหมาะสมในรูปแบบ Native และส่วนงานจัดการข้อมูลจำนวนมากเป็นงานบน Desktop\n> จึงแยกเป็น React Web Application\n\n---\n\n## 17.2 การเลือกเทคโนโลยี (Technology Selection)\n\n| ชั้น | เทคโนโลยี | เหตุผล |\n|---|---|---|\n| **Front-end (Web)** | React 18, Vite, React Router v6 | สเป็ดเร็ว, Component Reusable, เขียน State จัดการ UI ได้ดี, มี Community ขนาดใหญ่ |\n| **State Management** | Zustand (หรือ Context API) | เก็บสถานะผู้ใช้ + JWT + Permission Flag แบบ Global ได้ง่าย |\n| **HTTP Client** | Axios | Interceptor จัดการ Header `Authorization` และ Redirect เมื่อ Token หมดอายุได้สะดวก |\n| **UI Framework** | Ant Design (antd) 5.x | มี Component ครบ (Table, Form, DatePicker, Modal, Tree) เหมาะกับระบบ Enterprise |\n| **Chart** | Recharts | เขียนกราฟแบบ Bar / Line / Pie ตามที่รายงานที่ 1–7 ต้องการ |\n| **QR Generation** | `qrcode` (npm) บน Backend | สร้างเป็น Data URL / PNG ให้หน้าเว็บ และส่ง token ให้ Flutter สร้างซ้ำได้ |\n| **Mobile Framework** | Flutter 3.x (Dart) | เขียนครั้งเดียวได้ทั้ง Android/iOS, เหมาะกับงานสแกน QR |\n| **QR Scanning** | `mobile_scanner` | สแกน QR Code แบบเรียลไทม์ด้วยกล้อง |\n| **HTTP Client (Mobile)** | `dio` | รองรับ Interceptor + FormData (อัปโหลดรูป) |\n| **Chart (Mobile)** | `fl_chart` | กราฟบนมือถือ |\n| **State (Mobile)** | Provider / Riverpod | จัดการสถานะผู้ใช้และข้อมูล Trip ที่กำลังใช้งาน |\n| **Local Storage (Mobile)** | `flutter_secure_storage` | เก็บ JWT อย่างปลอดภัย ไม่เก็บแบบ plaintext |\n| **Backend** | Node.js 20 LTS + Express 4 | เป็น JavaScript เดียวกับ React (ลดภาระการเรียนภาษาเพิ่ม), RESTful เป็นมาตรฐาน |\n| **Database Driver** | `mysql2` (Promise) | รองรับ Connection Pool และ Transaction |\n| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless token, hash รหัสผ่าน |\n| **QR Payload** | Token สุ่ม (uuid) เก็บใน `booking.qr_token` | ตรวจสอบง่าย, เปลี่ยนได้, ไม่เดาได้ |\n| **Database** | MySQL 8.0 | รองรับ Transaction, Foreign Key, Window Function (ใช้ทำรายงาน) |\n| **DB Migration** | ไฟล์ `.sql` + `dbmate`/คำสั่ง `mysql <` | เก็บ version ใน Git ได้ |\n| **Version Control** | Git + GitHub | เก็บประวัติแผนงาน Agile (10 คะแนน) |\n| **Project Tracking** | ClickUp | จัดการ Backlog / Sprint / Task (10 คะแนน) |\n| **QR Verify / Report** | SQL View + Aggregate Query | ลดความซับซ้อนในชั้น Service |\n\n> **หมายเหตุ:** หากโจทย์กำหนด \"React + SQL\" และ \"Flutter + REST API\" แยกกัน\n> การออกแบบนี้ตอบโจทย์ได้ครบทั้งสองแนว โดย **REST API ตัวเดียวกัน** เป็นตัวกลาง\n> ทำให้ข้อมูล (Single Source of Truth) อยู่ที่ฐานข้อมูลเดียว ไม่เกิดข้อมูลซ้ำซ้อน\n\n---\n\n## 17.3 โครงสร้างโปรเจกต์ (Project Structure)\n\n```\nshuttle-bus-system/\n├── docs/                        # เอกสารประกอบโครงการ\n│   ├── requirements/             # Requirement Specification\n│   ├── diagrams/                 # ER, DFD, Use Case, Sequence\n│   ├── agile/                    # แผนงาน, daily stand-up, retro\n│   └── report/                   # บทรายงาน 1-18\n├── database/\n│   ├── 01_schema.sql             # DDL สร้างตาราง\n│   ├── 02_seed_master.sql        # ข้อมูล Master ตั้งต้น\n│   ├── 03_seed_front.sql         # ข้อมูลเส้นทาง/รอบ/รถ/คนขับ\n│   ├── 04_seed_report_bulk.sql   # ข้อมูลจำนวนมากสำหรับรายงาน (ปี 2568)\n│   └── 05_views_report.sql       # View สำหรับรายงาน\n├── backend/                      # Node.js + Express\n│   ├── src/\n│   │   ├── config/               # env, db pool\n│   │   ├── middleware/           # auth, rbac, validate, errorHandler\n│   │   ├── modules/\n│   │   │   ├── auth/\n│   │   │   ├── master/           # employee, role, permission, department\n│   │   │   ├── route/            # stop, route, schedule, vehicle\n│   │   │   ├── booking/\n│   │   │   ├── driver/\n│   │   │   └── report/\n│   │   ├── services/\n│   │   ├── repositories/\n│   │   ├── utils/                # qrcode, time calculator, validator\n│   │   └── app.js / server.js\n│   └── tests/\n├── frontend-web/                 # React + Vite\n│   ├── src/\n│   │   ├── pages/\n│   │   │   ├── auth/\n│   │   │   ├── master/\n│   │   │   ├── route/\n│   │   │   ├── booking/\n│   │   │   ├── driver/\n│   │   │   └── report/\n│   │   ├── components/\n│   │   ├── services/             # api modules\n│   │   ├── stores/               # zustand\n│   │   ├── routes/\n│   │   └── main.jsx\n│   └── package.json\n├── mobile-app/                   # Flutter\n│   └── lib/\n│       ├── core/                 # api client, storage, theme\n│       ├── features/\n│       │   ├── auth/\n│       │   ├── booking/\n│       │   ├── driver/\n│       │   └── report/\n│       └── main.dart\n└── README.md\n```\n\n---\n\n## 17.4 การออกแบบฐานข้อมูล (Database Design)\n\n### 17.4.1 กลุ่มตาราง\n\n| Group | ตาราง |\n|---|---|\n| **Master — บุคคล / สิทธิ์** | `department`, `position`, `employee`, `role`, `permission`, `role_permission`, `employee_role` |\n| **Front — เส้นทาง / รอบ / ยานพาหนะ** | `stop`, `route`, `route_stop`, `vehicle_type`, `vehicle`, `schedule`, `schedule_stop`, `driver_assign`, `vehicle_assign` |\n| **Booking — การจอง** | `booking` |\n| **Trip — การเดินรถจริง / สถิติ** | `trip`, `trip_passenger` |\n\n### 17.4.2 ER Diagram\n\n```mermaid\nerDiagram\n    DEPARTMENT ||--o{ EMPLOYEE : \"มีพนักงาน\"\n    POSITION ||--o{ EMPLOYEE : \"มีตำแหน่ง\"\n    EMPLOYEE ||--o{ EMPLOYEE_ROLE : \"มีบทบาท\"\n    ROLE ||--o{ EMPLOYEE_ROLE : \"กำหนดให้\"\n    ROLE ||--o{ ROLE_PERMISSION : \"ได้รับ\"\n    PERMISSION ||--o{ ROLE_PERMISSION : \"ถูกเปิดสิทธิ์\"\n\n    STOP ||--o{ ROUTE_STOP : \"อยู่ในเส้นทาง\"\n    ROUTE ||--o{ ROUTE_STOP : \"ประกอบด้วย\"\n    ROUTE ||--o{ SCHEDULE : \"จัดรอบได้หลายรอบ\"\n    SCHEDULE ||--o{ SCHEDULE_STOP : \"มีจุดจอด\"\n    STOP ||--o{ SCHEDULE_STOP : \"ใช้ซ้ำได้\"\n    SCHEDULE ||--o{ DRIVER_ASSIGN : \"มอบหมายคนขับ\"\n    EMPLOYEE ||--o{ DRIVER_ASSIGN : \"ขับรถ\"\n    SCHEDULE ||--o{ VEHICLE_ASSIGN : \"มอบหมายรถ\"\n    VEHICLE ||--o{ VEHICLE_ASSIGN : \"ถูกใช้\"\n    VEHICLE_TYPE ||--o{ VEHICLE : \"จัดกลุ่ม\"\n\n    EMPLOYEE ||--o{ BOOKING : \"จองรถ\"\n    SCHEDULE ||--o{ BOOKING : \"ถูกจอง\"\n    STOP ||--o{ BOOKING : \"จุดขึ้น/ลง\"\n    SCHEDULE ||--o{ TRIP : \"เดินรถจริง\"\n    TRIP ||--o{ TRIP_PASSENGER : \"มีผู้โดยสาร\"\n    BOOKING ||--o| TRIP_PASSENGER : \"ถูกเช็คอิน\"\n    BOOKING {\n        int booking_id PK\n        string booking_code UK\n        int cust_id FK\n        int sched_id FK\n        int board_stop_id FK\n        int alight_stop_id FK\n        int seats\n        string status \"reserved|checked_in|completed|cancelled|no_show\"\n        datetime book_time\n        string qr_token UK\n        datetime cancel_time\n    }\n    TRIP {\n        int trip_id PK\n        int sched_id FK\n        int driver_id FK\n        int veh_id FK\n        datetime start_time\n        datetime end_time\n        string status \"running|completed\"\n    }\n    TRIP_PASSENGER {\n        int trip_passenger_id PK\n        int trip_id FK\n        int booking_id FK\n        datetime checkin_time\n        datetime alight_time\n        int board_seq\n        int alight_seq\n    }\n```\n\n### 17.4.3 ตารางหลัก (ตัวอย่าง DDL)\n\n```sql\n-- ============ MASTER : สิทธิ์แบบ Dynamic ============\nCREATE TABLE role (\n  role_id      INT PRIMARY KEY AUTO_INCREMENT,\n  role_name    VARCHAR(50)  NOT NULL UNIQUE,\n  description  VARCHAR(255) NULL,\n  is_active    TINYINT(1)   NOT NULL DEFAULT 1\n);\n\nCREATE TABLE permission (\n  perm_id    INT PRIMARY KEY AUTO_INCREMENT,\n  perm_code  VARCHAR(80)  NOT NULL UNIQUE,   -- เช่น 'ROUTE.EDIT'\n  perm_name  VARCHAR(120) NOT NULL,\n  module     VARCHAR(50)  NOT NULL,          -- master | front | booking | report\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE TABLE role_permission (\n  role_id   INT NOT NULL,\n  perm_id   INT NOT NULL,\n  PRIMARY KEY (role_id, perm_id),\n  FOREIGN KEY (role_id)   REFERENCES role(role_id)       ON DELETE CASCADE,\n  FOREIGN KEY (perm_id)   REFERENCES permission(perm_id) ON DELETE CASCADE\n);\n\nCREATE TABLE employee_role (\n  emp_id   INT NOT NULL,\n  role_id  INT NOT NULL,\n  PRIMARY KEY (emp_id, role_id),\n  FOREIGN KEY (emp_id)  REFERENCES employee(emp_id) ON DELETE CASCADE,\n  FOREIGN KEY (role_id) REFERENCES role(role_id)    ON DELETE CASCADE\n);\n\n-- ============ FRONT : เส้นทาง ============\nCREATE TABLE stop (\n  stop_id   INT PRIMARY KEY AUTO_INCREMENT,\n  stop_name VARCHAR(120) NOT NULL,\n  address   VARCHAR(255) NULL,\n  latitude  DECIMAL(10,7) NULL,\n  longitude DECIMAL(10,7) NULL,\n  is_active TINYINT(1) NOT NULL DEFAULT 1\n);\n\nCREATE TABLE route (\n  route_id       INT PRIMARY KEY AUTO_INCREMENT,\n  route_name     VARCHAR(120) NOT NULL,\n  total_minutes  INT NOT NULL DEFAULT 0,   -- คำนวณอัตโนมัติจาก route_stop\n  description    VARCHAR(255) NULL,\n  is_active      TINYINT(1) NOT NULL DEFAULT 1\n);\n\nCREATE TABLE route_stop (\n  route_id       INT NOT NULL,\n  stop_id        INT NOT NULL,\n  stop_seq       INT NOT NULL,             -- ลำดับจุดจอด 1..n\n  travel_minutes INT NOT NULL DEFAULT 0,   -- นาทีจากจุดก่อนหน้าถึงจุดนี้\n  PRIMARY KEY (route_id, stop_seq),\n  UNIQUE KEY uq_route_stop (route_id, stop_id),\n  FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE,\n  FOREIGN KEY (stop_id)  REFERENCES stop(stop_id)\n);\n\n-- ============ FRONT : รอบเวลา ============\nCREATE TABLE schedule (\n  sched_id     INT PRIMARY KEY AUTO_INCREMENT,\n  route_id     INT          NOT NULL,\n  service_date DATE         NOT NULL,\n  depart_time  TIME         NOT NULL,     -- เวลาออกจากจุดเริ่มต้น\n  is_active    TINYINT(1)   NOT NULL DEFAULT 1,\n  UNIQUE KEY uq_route_date_time (route_id, service_date, depart_time),\n  FOREIGN KEY (route_id) REFERENCES route(route_id)\n);\n\nCREATE TABLE schedule_stop (\n  sched_stop_id INT PRIMARY KEY AUTO_INCREMENT,\n  sched_id      INT      NOT NULL,\n  stop_id       INT      NOT NULL,\n  stop_seq      INT      NOT NULL,\n  arrive_time   TIME     NOT NULL,       -- = depart_time + SUM(travel_minutes ถึงจุดนี้)\n  dwell_minutes INT      NOT NULL DEFAULT 0,\n  FOREIGN KEY (sched_id) REFERENCES schedule(sched_id) ON DELETE CASCADE,\n  FOREIGN KEY (stop_id)  REFERENCES stop(stop_id)\n);\n\n-- ============ BOOKING ============\nCREATE TABLE booking (\n  booking_id     INT PRIMARY KEY AUTO_INCREMENT,\n  booking_code   VARCHAR(20) NOT NULL UNIQUE,\n  cust_id        INT          NOT NULL,\n  sched_id       INT          NOT NULL,\n  board_stop_id  INT          NOT NULL,\n  alight_stop_id INT          NOT NULL,\n  seats          INT          NOT NULL DEFAULT 1,   -- 1..4\n  status         ENUM('reserved','checked_in','completed','cancelled','no_show')\n                 NOT NULL DEFAULT 'reserved',\n  book_time      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  qr_token       CHAR(36)     NOT NULL UNIQUE,\n  cancel_time    DATETIME     NULL,\n  FOREIGN KEY (cust_id)        REFERENCES employee(emp_id),\n  FOREIGN KEY (sched_id)       REFERENCES schedule(sched_id),\n  FOREIGN KEY (board_stop_id)  REFERENCES stop(stop_id),\n  FOREIGN KEY (alight_stop_id) REFERENCES stop(stop_id)\n);\n\n-- ============ TRIP : ข้อมูลสำหรับรายงาน ============\nCREATE TABLE trip (\n  trip_id    INT PRIMARY KEY AUTO_INCREMENT,\n  sched_id   INT      NOT NULL,\n  driver_id  INT      NOT NULL,\n  veh_id     INT      NOT NULL,\n  start_time DATETIME NULL,\n  end_time   DATETIME NULL,\n  status     ENUM('running','completed') NOT NULL DEFAULT 'running',\n  FOREIGN KEY (sched_id)  REFERENCES schedule(sched_id),\n  FOREIGN KEY (driver_id) REFERENCES employee(emp_id),\n  FOREIGN KEY (veh_id)    REFERENCES vehicle(veh_id)\n);\n\nCREATE TABLE trip_passenger (\n  trip_passenger_id INT PRIMARY KEY AUTO_INCREMENT,\n  trip_id           INT      NOT NULL,\n  booking_id        INT      NOT NULL,\n  checkin_time      DATETIME NULL,\n  checkin_stop_id   INT      NULL,\n  board_seq         INT      NULL,   -- ลำดับจุดจอดที่ขึ้นจริง\n  alight_seq        INT      NULL,   -- ลำดับจุดจอดที่ลงจริง\n  alight_time       DATETIME NULL,\n  UNIQUE KEY uq_trip_booking (trip_id, booking_id),\n  FOREIGN KEY (trip_id)    REFERENCES trip(trip_id)     ON DELETE CASCADE,\n  FOREIGN KEY (booking_id) REFERENCES booking(booking_id)\n);\n```\n\n### 17.4.4 Business Rule ที่ฝังในฐานข้อมูล / Service Layer\n\n| # | กฎ | ตำแหน่งที่บังคับใช้ |\n|---|---|---|\n| BR-01 | `route.total_minutes` = `SUM(route_stop.travel_minutes)` ของเส้นทางนั้น | Service (คำนวณใหม่ทุกครั้งที่แก้ `route_stop`) |\n| BR-02 | `schedule_stop.arrive_time` = `depart_time` + ผลรวม `travel_minutes` ถึงจุดนั้น | Service (auto-generate เมื่อสร้าง Schedule) |\n| BR-03 | จุดจอด 1 จุด อยู่ได้หลายเส้นทาง | `UNIQUE(route_id, stop_id)` แต่ไม่ UNIQUE `stop_id` |\n| BR-04 | คนขับ/รถ 1 คัน 1 ช่วงเวลา ห้ามชนกับตัวเอง | Service `checkConflict()` + Transaction |\n| BR-05 | จองต้องเกิดก่อนเวลารถถึงจุดขึ้น **อย่างน้อย 20 นาที** | Service `checkLeadTime()` |\n| BR-06 | ผู้ใช้ 1 คน จองได้ไม่เกิน **4 ที่นั่ง** ต่อ 1 การจอง | Service `checkSeatLimit()` |\n| BR-07 | ที่นั่งว่าง = `vehicle_type.capacity` − `SUM(booking.seats)` ที่ `status='reserved'` | Service `checkSeatAvailable()` + `SELECT ... FOR UPDATE` |\n| BR-08 | ยกเลิกแล้ว **ที่นั่งถูกคืนทันที** (เปลี่ยน status เป็น `cancelled`) | Transaction |\n| BR-09 | สแกน QR ผิดรอบ → ไม่อนุญาตให้ขึ้นรถ | Service `validateQr()` เทียบ `booking.sched_id` กับ `trip.sched_id` |\n| BR-10 | ปิดรอบงาน → การจองที่ยัง `reserved` ถูกเปลี่ยนเป็น `no_show` | Service `completeTrip()` |\n\n---\n\n## 17.5 REST API Backend\n\n### 17.5.1 รูปแบบมาตรฐาน (Conventions)\n\n| หัวข้อ | รูปแบบ |\n|---|---|\n| Base URL | `http://localhost:3000/api/v1` |\n| Content-Type | `application/json` |\n| Auth | `Authorization: Bearer <access_token>` |\n| รูปแบบ Response สำเร็จ | `{ \"success\": true, \"data\": {...}, \"message\": \"...\" }` |\n| รูปแบบ Response ผิดพลาด | `{ \"success\": false, \"error\": { \"code\": \"SEAT_FULL\", \"message\": \"ที่นั่งไม่เพียงพอ\" } }` |\n| Pagination | `?page=1&limit=20` → `{ \"data\": [...], \"meta\": { \"total\": 100, \"page\": 1 } }` |\n| HTTP Status | 200 OK / 201 Created / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 409 Conflict |\n\n### 17.5.2 Endpoint หลัก\n\n**Auth & Master (M1, M2, M3)**\n```\nPOST   /auth/login                  → เข้าสู่ระบบ (คืน JWT + permissions)\nPOST   /auth/logout                 → ออกจากระบบ (เพิ่ม token ใน blacklist)\nGET    /auth/me                     → ข้อมูลผู้ใช้ปัจจุบัน + สิทธิ์ทั้งหมด\n\nGET    /departments                 CRUD ฝั่งพนักงาน\nPOST   /departments\nPUT    /departments/:id\nDELETE /departments/:id\n\nGET    /employees                   M1 : เพิ่ม/ลบ/แก้ไขพนักงาน + แผนก/ตำแหน่ง\nPOST   /employees\nPUT    /employees/:id\nDELETE /employees/:id\n\nGET    /roles                       M2 : สิทธิ์ Dynamic\nPOST   /roles\nPUT    /roles/:id                   ← แก้ไขสิทธิ์ของ Role ได้ตลอดเวลา\nDELETE /roles/:id\n\nGET    /permissions\nPOST   /permissions\nPUT    /permission-matrix           ← บันทึก Role ↔ Permission (ตารางติ๊ก)\n```\n\n**Front (F1, F2)**\n```\nGET    /stops                       F1 : จุดจอด (อยู่ได้หลายเส้นทาง)\nGET    /routes\nPOST   /routes\nGET    /routes/:id/stops            จุดจอดในเส้นทาง + นาที + เวลารวม\nPUT    /routes/:id/stops            ← แก้ไขลำดับจุดจอด / เวลา\nPOST   /routes/:id/recalculate      ← คำนวณ total_minutes ใหม่\n\nGET    /schedules                   F2 : ตารางรอบเวลา\nPOST   /schedules                   ← สร้างรอบ + auto-generate schedule_stop\nGET    /schedules/:id\nDELETE /schedules/:id\n\nGET    /vehicles / POST /vehicles   รถ + ประเภทรถ + ที่นั่ง\nPOST   /schedules/:id/assign-driver    ← ตรวจ conflict คนขับ\nDELETE /schedules/:id/assign-driver\nPOST   /schedules/:id/assign-vehicle   ← ตรวจ conflict รถ\nDELETE /schedules/:id/assign-vehicle\n```\n\n**Booking (B1 – B4)**\n```\nGET    /booking/available           ?board_stop=&alight_stop=&date=\n                                     → รอบที่จองได้ (กรองเหลือเวลา ≥ 20 นาที,\n                                       ที่นั่งว่าง, จุดขึ้น-ลงถูกต้องตามลำดับ)\nPOST   /booking                     → สร้างการจอง + gen qr_token + คืน QR Data URL\nGET    /booking/me?status=upcoming  → กรอง กำลังจะถึง / เสร็จแล้ว / ยกเลิก\nGET    /booking/:id/qr              → ดึง QR Code\nPOST   /booking/:id/cancel          → ยกเลิก + คืนที่นั่ง\n```\n\n**Driver (D1 – D4)**\n```\nGET    /driver/schedule?date=       D1 : ตารางงานรายวันของคนขับ\nPOST   /driver/trip/:schedId/start  D2 : กดเริ่มงาน (เช็คงานค้าง/ชนกัน)\nGET    /driver/trip/:tripId/manifest D2 : ผู้โดยสารขึ้น-ลง รายจุดจอด\nPOST   /driver/trip/scan             D3 : สแกน QR → ตรวจรอบ / ขึ้นรถ\nPOST   /driver/trip/:tripId/complete D4: ปิดงาน + สรุปยอด + mark no_show\n```\n\n**Report (R1 – R3)**\n```\nGET /report/booking-stats?year=2568              R1 : คนขึ้น/ลง รายสัปดาห์\nGET /report/annual-summary?year=2568             R2 : สถิติทั้งปี\nGET /report/user-behavior?from=&to=              R3 : พฤติกรรมราย user\nGET /report/daily-by-route?from=&to=              R4 : ผู้ใช้รายวันรายเส้นทาง\nGET /report/stop-usage?from=&to=                 R5 : ขึ้น/ลง รายจุดจอดตามเวลา\nGET /report/driver-workload?from=&to=            R6 : รอบงานคนขับ ก่อน/หลัง 17:00\nGET /report/vehicle-usage?from=&to=              R7 : รอบต่อรถ/ประเภทรถ\n```\n\n### 17.5.3 Middleware สำคัญ — Dynamic RBAC (ตอบข้อกำหนด Master 2)\n\n```javascript\n// middleware/rbac.js  — ตรวจสิทธิ์จากฐานข้อมูลทุกครั้ง ไม่ hardcode\nconst pool = require('../config/db');\n\nasync function loadPermissions(empId) {\n  const [rows] = await pool.query(\n    `SELECT DISTINCT p.perm_code\n       FROM employee er\n       JOIN employee_role  vr ON vr.emp_id = er.emp_id\n       JOIN role_permission rp ON rp.role_id = vr.role_id\n       JOIN permission p ON p.perm_id = rp.perm_id\n      WHERE er.emp_id = ? AND er.is_active = 1`,\n    [empId]\n  );\n  return rows.map(r => r.perm_code);\n}\n\nfunction requirePermission(permCode) {\n  return async (req, res, next) => {\n    const perms = await loadPermissions(req.user.empId);\n    if (!perms.includes(permCode)) {\n      return res.status(403).json({\n        success: false,\n        error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าใช้งานส่วนนี้' }\n      });\n    }\n    next();\n  };\n}\n\n// ใช้งาน\nrouter.put('/roles/:id', requirePermission('ROLE.EDIT'), roleController.update);\n```\n\n> ✅ ผลลัพธ์: เมื่อ Admin ไปตั้งสิทธิ์ `ROUTE.EDIT` ให้ Role `Staff` เพิ่มเมื่อไหร่\n> ผู้ใช้ที่มี Role นั้นจะเข้าถึงเมนูนั้นได้ทันที **โดยไม่ต้องแก้โค้ดและไม่ต้อง restart server**\n\n### 17.5.4 Business Logic สำคัญ\n\n**B1 : ตรวจเงื่อนไขการจอง (ตรวจทุกข้อ)**\n```javascript\nasync function validateBooking({ custId, schedId, boardStopId, alightStopId, seats }) {\n  const [schedRows] = await pool.query(\n    `SELECT s.*, vt.capacity, ss.stop_seq AS board_seq\n       FROM schedule s\n       JOIN schedule_stop ss ON ss.sched_id = s.sched_id AND ss.stop_id = ?\n       JOIN vehicle_assign va ON va.sched_id = s.sched_id\n       JOIN vehicle v  ON v.veh_id = va.veh_id\n       JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id\n      WHERE s.sched_id = ?`, [boardStopId, schedId]);\n\n  const sched = schedRows[0];\n  if (!sched) return fail('จุดจอดที่เลือกไม่ได้อยู่ในเส้นทางของรอบนี้');\n\n  // BR-05 : ต้องจองก่อนถึงจุดขึ้นอย่างน้อย 20 นาที\n  const arriveAt = new Date(`${sched.service_date}T${sched.arrive_time}`);\n  const leadMin = (arriveAt - new Date()) / 60000;\n  if (leadMin < 20) return fail('กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น');\n\n  // BR-06 : ไม่เกิน 4 ที่นั่ง\n  if (seats < 1 || seats > 4) return fail('จำนวนที่นั่งต้องไม่เกิน 4 คน');\n\n  // BR-07 : ที่นั่งว่างพอไหม  (ล็อกแถวกัน race condition)\n  const conn = await pool.getConnection();\n  try {\n    await conn.beginTransaction();\n    const [[{ used }]] = await conn.query(\n      `SELECT COALESCE(SUM(seats),0) AS used FROM booking\n        WHERE sched_id = ? AND status = 'reserved' FOR UPDATE`,\n      [schedId]);\n    if (used + seats > sched.capacity) {\n      await conn.rollback();\n      return fail(`ที่นั่งไม่เพียงพอ (เหลือ ${sched.capacity - used} ที่นั่ง)`);\n    }\n    // ... INSERT booking ...\n    await conn.commit();\n  } catch (e) { await conn.rollback(); throw e; }\n  finally { conn.release(); }\n  return ok();\n}\n```\n\n**D3 : ตรวจ QR (ผิดรอบขึ้นรถไม่ได้)**\n```javascript\nasync function validateQr(qrToken, currentTripId) {\n  const [[b]] = await pool.query(\n    `SELECT b.*, t.trip_id, t.sched_id\n       FROM booking b\n       LEFT JOIN trip t ON t.sched_id = b.sched_id\n      WHERE b.qr_token = ?`, [qrToken]);\n\n  if (!b)                                    return { ok:false, msg:'ไม่พบข้อมูลการจอง' };\n  if (b.status === 'cancelled')              return { ok:false, msg:'การจองถูกยกเลิกแล้ว' };\n  if (b.status === 'checked_in')             return { ok:false, msg:'ผู้โดยสารเช็คอินไปแล้ว' };\n  if (b.sched_id !== currentTrip.sched_id)  return { ok:false, msg:'QR นี้ไม่ใช่รอบที่กำลังเดินรถ' };\n  return { ok:true, booking:b };\n}\n```\n\n---\n\n## 17.6 Web Front-end (React)\n\n### 17.6.1 โมดูลหน้าจอ\n\n| โมดูล | หน้าจอ |\n|---|---|\n| **Auth** | Login, Logout, หน้าเปลี่ยนรหัสผ่าน |\n| **Master 1** | จัดการพนักงาน (Table + Modal Form: แผนก, ตำแหน่ง, เข้าระบบ), จัดการแผนก/ตำแหน่ง |\n| **Master 2** | จัดการ Role, จัดการ Permission, **หน้า Permission Matrix** (ตารางติ๊ก Role × Permission) |\n| **Master 3** | เปลี่ยนรหัสผ่าน, ดูประวัติการเข้าใช้งาน |\n| **Front 1** | จัดการจุดจอด, จัดการเส้นทาง (เพิ่มจุดจอดเรียงลำดับ + กำหนดนาที + แสดงเวลารวมอัตโนมัติ) |\n| **Front 2** | จัดตารางรอบเวลา (ปฏิทิน), มอบหมายคนขับ, มอบหมายรถ, **แสดง Conflict Alert** |\n| **Booking** | จุดขึ้นรถ, จุดลงรถ, รายการรอบที่เลือกได้, เลือกจำนวนที่นั่ง, ยืนยัน, **หน้าแสดง QR Code** |\n| **My Booking** | แท็บ กำลังจะถึง / เดินทางแล้ว / ยกเลิก, ปุ่มยกเลิก |\n| **Report** | 5 หน้ารายงาน (เลือกตามกลุ่ม) พร้อมกราฟ Recharts |\n\n### 17.6.2 การควบคุมเมนูตามสิทธิ์ (Dynamic Menu)\n```jsx\n// เมนูถูกสร้างจาก permission ที่ login แล้วได้รับ ไม่ hardcode\nconst menuItems = useMemo(() => [\n  { key:'employee', label:'พนักงาน',      perm:'EMPLOYEE.VIEW',  path:'/master/employee' },\n  { key:'role',     label:'สิทธิ์',         perm:'ROLE.VIEW',      path:'/master/role' },\n  { key:'route',    label:'เส้นทาง',       perm:'ROUTE.VIEW',     path:'/front/route' },\n  { key:'booking',  label:'จองรถ',         perm:'BOOKING.CREATE', path:'/booking' },\n  { key:'report',   label:'รายงาน',        perm:'REPORT.VIEW',    path:'/report' },\n].filter(i => permissions.includes(i.perm)), [permissions]);\n```\n\n### 17.6.3 Axios Interceptor\n```javascript\napi.interceptors.request.use(config => {\n  const token = authStore.getState().token;\n  if (token) config.headers.Authorization = `Bearer ${token}`;\n  return config;\n});\napi.interceptors.response.use(r => r, error => {\n  if (error.response?.status === 401) authStore.getState().logout();\n  if (error.response?.status === 403) message.error('ไม่มีสิทธิ์เข้าใช้งานส่วนนี้');\n  return Promise.reject(error);\n});\n```\n\n---\n\n## 17.7 Mobile Application (Flutter)\n\n### 17.7.1 โมดูลตามบทบาทผู้ใช้\n\n| โมดูล | หน้าจอ | ผู้ใช้ |\n|---|---|---|\n| Auth | Login (เลือกบทบาท Driver / Customer) | ทุกบทบาท |\n| Booking | เลือกจุดขึ้น–ลง, เลือกรอบ, เลือกที่นั่ง, ยืนยัน, แสดง QR | Customer |\n| My Booking | รายการจอง + ยกเลิก + ดู QR | Customer |\n| Driver | **ตารางงานรายวัน** | Driver |\n| Driver | **เริ่มการเดินทาง** (พร้อมแจ้งเตือนชนกับงานอื่น) | Driver |\n| Driver | **Manifest** ผู้โดยสารขึ้น–ลง รายจุดจอด | Driver |\n| Driver | **สแกน QR Code** (กล้อง) | Driver |\n| Driver | **ปิดรอบงาน + สรุปยอด / No Show** | Driver |\n\n### 17.7.2 ตัวอย่างการสแกน QR (D3)\n```dart\nclass ScanQRScreen extends StatefulWidget { /* ... */ }\n\nclass _ScanQRScreenState extends State<ScanQRScreen> {\n  final tripId = widget.tripId;\n  String? message; bool ok = false;\n\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      appBar: AppBar(title: const Text('สแกน QR ขึ้นรถ')),\n      body: Column(children: [\n        MobileScanner(\n          onDetect: (capture) async {\n            final token = capture.barcodes.first.rawValue;\n            if (token == null) return;\n            final res = await Dio().post('/api/v1/driver/trip/scan',\n              data: {'qr_token': token, 'trip_id': tripId});\n            setState(() {\n              ok = res.data['success'];\n              message = res.data['message'];\n            });\n          },\n        ),\n        if (message != null)\n          Container(\n            color: ok ? Colors.green : Colors.red,\n            padding: const EdgeInsets.all(16),\n            child: Text(message!, style: const TextStyle(color: Colors.white, fontSize: 18)),\n          ),\n      ]),\n    );\n  }\n}\n```\n\n### 17.7.3 Service Layer (Flutter)\n```dart\nclass ApiClient {\n  static const baseUrl = String.fromEnvironment('API_URL',\n      defaultValue: 'http://10.0.2.2:3000/api/v1');   // 10.0.2.2 = host จาก Android Emulator\n  final Dio _dio = Dio();\n\n  Future<void> init() async {\n    final storage = const FlutterSecureStorage();\n    final token = await storage.read(key: 'jwt');\n    if (token != null) {\n      _dio.options.headers['Authorization'] = 'Bearer $token';\n    }\n    _dio.interceptors.add(InterceptorsWrapper(\n      onError: (e, h) async {\n        if (e.response?.statusCode == 401) {\n          await storage.delete(key: 'jwt');\n        }\n        return handler.next(e);\n      },\n    ));\n  }\n}\n```\n\n---\n\n## 17.8 การเชื่อมต่อระหว่างแอปพลิเคชัน (Integration)\n\n| หัวข้อ | รายละเอียด |\n|---|---|\n| ฐานข้อมูลกลาง | ทั้ง React และ Flutter เรียก REST API ตัวเดียวกัน → ข้อมูลไม่ซ้ำซ้อน |\n| การยืนยันตัวตน | JWT เดียวกัน เก็บคนละที่ (React: `localStorage`, Flutter: `secure_storage`) |\n| การ Sync | ไม่ต้อง Sync — ทุก request ยิงเข้า Server แบบ Real-time |\n| QR Code | Backend สร้าง `qr_token` + Data URL → React แสดงรูป, Flutter แสดงจาก `qr_token` เดียวกัน |\n| CORS | Backend ต้องตั้ง `cors()` ให้ยอมรับ origin ของ React (`:5173`) |\n| สิทธิ์ร่วม | Permission ที่ login ได้ → ใช้ตัดสินว่าแสดงเมนู/ปุ่ม ทั้ง 2 แอป |\n\n---\n\n## 17.9 ความปลอดภัย (Security)\n\n| รายการ | วิธีดำเนินการ |\n|---|---|\n| Password | เก็บเป็น `bcrypt` hash 10 rounds ไม่เก็บ plaintext |\n| Token | JWT `access_token` อายุ 2 ชม. + `refresh_token` เก็บใน DB |\n| Logout | เพิ่ม `jti` ของ token ลงตาราง `token_blacklist` |\n| Authorization | ตรวจทุก API ผ่าน `requirePermission()` (Dynamic) |\n| Input Validation | `express-validator` / `zod` ทุก endpoint |\n| SQL Injection | ใช้ Parameterized Query เท่านั้น ห้ามต่อสตริง |\n| HTTPS | บังคับ HTTPS ใน Production |\n| Rate Limit | `express-rate-limit` ที่ `/auth/login` |\n| Audit Log | บันทึกผู้ใช้ + action + เวลา สำหรับตรวจสอบ |\n| Secret | เก็บใน `.env` และ `.gitignore` (**ห้าม commit**) |\n\n---\n\n## 17.10 คุณสมบัติไม่เชิงหน้าที่ (Non-Functional Requirements)\n\n| ข้อ | เป้าหมาย | วิธีวัด |\n|---|---|---|\n| Performance | หน้าเว็บตอบสนอง < 2 วินาที, API < 500 ms | Postman / Lighthouse |\n| Concurrent Users | รองรับ 200 คนพร้อมกัน | JMeter / k6 |\n| Availability | 99% ในเวลาราชการ | Uptime monitor |\n| Security | ไม่มีช่องโหว่ระดับ Critical สำหรับข้อมูลส่วนบุคคล | OWASP Top 10 checklist |\n| Usability | ผู้ใช้จองสำเร็จภายใน 5 คลิก | Usability Test กับเพื่อน 5 คน |\n| Maintainability | แยก Module, มี JSDoc, Coverage > 60% | Jest / `flutter test` |\n| Scalability | เพิ่มข้อมูล 100,000 booking แล้วรายงานยังทำได้ < 3 วินาที | Benchmark |\n\n---\n\n## 17.11 เครื่องมือและสภาพแวดล้อมพัฒนา (Tools & Environment)\n\n| เครื่องมือ | รุ่น | หน้าที่ |\n|---|---|---|\n| Node.js | 20 LTS | Backend runtime |\n| npm | 10.x | Dependency manager |\n| MySQL Server | 8.0 | Database |\n| VS Code | latest | Editor + Extensions |\n| Android Studio | Ladybug+ | จำลอง Android device ทดสอบสแกน QR |\n| Git / GitHub | — | Version control + เก็บแผนงาน Agile |\n| ClickUp | — | Backlog, Sprint, Task tracking |\n| Postman | — | ทดสอบ REST API |\n| DBeaver | — | จัดการฐานข้อมูล, เตรียม seed data |\n| Chrome DevTools | — | Debug React, ตรวจ Network |\n\n**Environment Variables (`.env`)**\n```env\nNODE_ENV=development\nPORT=3000\nDB_HOST=localhost\nDB_PORT=3306\nDB_USER=shuttle_user\nDB_PASS=********\nDB_NAME=shuttle_bus\nJWT_SECRET=********\nJWT_EXPIRES_IN=2h\nQR_SECRET=********\n```\n\n---\n\n## 17.12 สรุปความสอดคล้องกับข้อกำหนด (Traceability : Chapter 17)\n\n| ข้อกำหนด | ตำแหน่งในบทนี้ | สถานะ |\n|---|---|---|\n| M1 จัดการพนักงาน (เพิ่ม/แก้ไข/แผนก/ตำแหน่ง) | 17.5.2 `/employees`, 17.6.1 | ครบ |\n| M2 สิทธิ์ Dynamic (เพิ่ม/ลบ/แก้ไข ไม่ fix) | 17.5.3 RBAC middleware, 17.6.2 Dynamic Menu | ครบ |\n| M3 Login/Logout + เช็คสิทธิ์ | 17.5.1, 17.5.2 `/auth/*` | ครบ |\n| F1 จัดเส้นทาง (จุดจอดหลายจุด/จุดอยู่หลายเส้นทาง/นาที/เวลารวม) | 17.4.2–17.4.4, 17.6.1 | ครบ |\n| F2 จัดรอบเวลา + มอบหมายคนขับ/รถ + ตรวจชนกัน | 17.4.4 BR-04, 17.5.2 `/assign-*` | ครบ |\n| B1–B4 ระบบจอง (20 นาที / 4 คน / ที่นั่ง / QR / ยกเลิก) | 17.4.4, 17.5.4, 17.6.1, 17.7.1 | ครบ |\n| D1–D4 ระบบคนขับ (ตารางงาน/เริ่มงาน/สแกน/ปิดงาน) | 17.5.2, 17.7.1–17.7.2 | ครบ |\n| R1–R3 ระบบรายงาน + กราฟ | 17.5.2 `/report/*`, 17.6.1, 17.7.1 | ครบ |\n| React + SQL | 17.2, 17.6 | ครบ |\n| Flutter + REST API | 17.2, 17.7 | ครบ |\n\n---\n"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Big Pickle · 144.2s)

_Thinking:_

Now chapter 18 — development plan with Scrum 1-day sprints, tasks, daily stand-up, agentic AI.

Let me build a comprehensive plan. Assume 3 developers + 1 AI agent. 1-day sprints.

Let me design sprints. I'll do Sprint 0 through Sprint 13 (14 sprints) = 14 working days, roughly 3 weeks.

Let me map epics to sprints with task IDs, hours, owner, AI usage, DoD.

Let me define roles:
- DEV1 (Full-stack Backend + DB)
- DEV2 (React Web)
- DEV3 (Flutter Mobile)
- AI = Agentic AI assistant (all)

Actually, let me include a "Reviewer/QA" role — but for mini project, 3 members. Let me do DEV1, DEV2, DEV3 and note they can adjust.

Let me create the sprint plan:

**Sprint 0 — Foundation & Documentation (Day 1)**
Goal: เอกสารและโครงสร้างโปรเจกต์พร้อม
- T-001 จัดทำ Requirement Specification + Requirement ID (R-001...)
- T-002 ออกแบบ ER Diagram + Mapping
- T-003 Data Dictionary
- T-004 Use Case Diagram + Spec
- T-005 DFD (Context, Lv0, Lv1)
- T-006 Sequence Diagram (booking, QR)
- T-007 State Diagram (Booking)
- T-008 Mockup Figma ทั้งระบบ
- T-009 ตั้ง Git repo + ClickUp project + เขียนแผนงานลง repo

That's too much for 1 day. Let me spread. Sprint 0-1 = documentation.

**Sprint 0 (Day 1): Project Setup + Requirement**
- T-001 สร้าง Git repo + โครงสร้างโปรเจกต์ + .gitignore
- T-002 สร้าง ClickUp Space/Project/List/Sprint
- T-003 วิเคราะห์ Requirement จาก PDF + ออกแบบ Use Case Diagram
- T-004 เขียน Requirement Specification + Requirement Traceability ID

**Sprint 1 (Day 2): Database Design**
- T-005 ออกแบบ ER Diagram (Conceptual→Logical→Physical)
- T-006 เขียน Data Dictionary
- T-007 เขียน DDL (01_schema.sql)
- T-008 สร้าง Seed Master + Front (02, 03)

**Sprint 2 (Day 3): Mockup + Backend Skeleton**
- T-009 ออกแบบ Mockup Figma (ทั้งระบบ)
- T-010 ตั้งโปรเจกต์ Backend (Express, config, db pool)
- T-011 โครงสร้าง middleware + error handler
- T-012 เขียน OpenAPI/Swagger

**Sprint 3 (Day 4): Master 1 & 3 — Employee + Auth**
- T-013 Login/Logout API + JWT
- T-014 Employee CRUD API (M1)
- T-015 Department/Position CRUD API
- T-016 Login page React + token store
- T-017 หน้า จัดการพนักงาน React

**Sprint 4 (Day 5): Master 2 — Dynamic Permission**
- T-018 Role CRUD API
- T-019 Permission CRUD API
- T-020 Role↔Permission mapping API
- T-021 RBAC middleware (dynamic)
- T-022 หน้า Permission Matrix React
- T-023 Dynamic menu React

**Sprint 5 (Day 6): Front 1 — Stop & Route**
- T-024 Stop CRUD API
- T-025 Route CRUD API
- T-026 Route_Stop API (เพิ่ม/เรียงลำดับ/นาที)
- T-027 Auto-calc total_minutes
- T-028 หน้าจัดการจุดจอด + เส้นทาง React

**Sprint 6 (Day 7): Front 2 — Schedule, Vehicle, Assignment**
- T-029 Vehicle/Vehicle_Type API
- T-030 Schedule CRUD + auto-generate schedule_stop
- T-031 Driver assignment + conflict check
- T-032 Vehicle assignment + conflict check
- T-033 หน้าจัดรอบเวลา + มอบหมาย (React, calendar)

**Sprint 7 (Day 8): Booking API**
- T-034 Available trip query (20-min rule)
- T-035 Seat availability + transaction
- T-036 Max 4 seats validation
- T-037 Create booking + QR generation
- T-038 Cancel booking + release seat
- T-039 My bookings list + filter

**Sprint 8 (Day 9): Booking UI (React + Flutter)**
- T-040 React booking flow (เลือกจุด/รอบ/ที่นั่ง)
- T-041 React QR display + my booking + cancel
- T-042 Flutter: setup + auth + bottom nav
- T-043 Flutter booking flow + QR + my booking

**Sprint 9 (Day 10): Driver system (Flutter)**
- T-044 Driver daily schedule API + screen
- T-045 Start trip API + conflict check
- T-046 Manifest API + screen
- T-047 QR scan + validate API + Flutter scanner
- T-048 Complete trip + no-show mark + summary screen

**Sprint 10 (Day 11): Seed data + Report API**
- T-041 เขียน 04_seed_report_bulk.sql (ข้อมูลปี 2568)
- T-049 Report 1 or 2 API
- T-050 Report 3/4/5 API
- T-051 Report 6/7 API
- T-052 สร้าง View ช่วยรายงาน

**Sprint 11 (Day 12): Report UI**
- T-053 หน้ารายงาน R1/R2 React + กราฟ Recharts
- T-054 หน้ารายงาน R3/R4/R5
- T-055 หน้ารายงาน R6/R7
- T-056 (ถ้า Embedded) หน้ารายงานบน Flutter เพิ่ม 2 ข้อ

**Sprint 12 (Day 13): Test & UAT**
- T-057 Test Plan + Test Case
- T-058 Unit + Integration test
- T-059 UAT กับผู้ใช้จริง 5 คน
- T-060 Performance test + optimize query
- T-061 แก้ bug

**Sprint 13 (Day 14): Docs & Final**
- T-062 Traceability Matrix
- T-063 เขียนรายงาน บทที่ 1-18
- T-064 ทำคู่มือการใช้งาน + Deployment
- T-065 Retrospective + ปิด Release
- T-066 เตรียม Mockup final + สไลด์นำเสนอ

That's 14 sprints. Good.

Now I need:
- Scrum ceremonies in 1-day sprint: Sprint Planning (15 min), Daily Stand-up (15 min), Sprint Review (30 min), Retrospective (20 min) — all within the day
- Definition of Ready / Definition of Done
- Task board columns
- Burndown
- Velocity tracking
- Agentic AI usage: roles, prompt library, guardrails, per-sprint AI tasks
- Git branching strategy + commit convention
- Daily stand-up template
- Sprint report template
- Risk register

Let me also include the AI agent workflow.

Let me write it.

For AI: 
- AI Agent Roles: 
  - `@agent-architect` — ออกแบบ ER, DFD, Use Case, Sequence
  - `@agent-coder` — เขียน API/controller/service
  - `@agent-ui` — สร้าง React component / Flutter screen
  - `@agent-data` — เขียน seed SQL, ทดสอบ query
  - `@agent-test` — เขียน test case
  - `@agent-doc` — เขียนเอกสาร/รายงาน
  - `@agent-review` — code review

- AI Operating Rules (สำคัญมากสำหรับคะแนน 10 คะแนน Agile + ความน่าเชื่อถือ):
  1. AI เป็นผู้ช่วย ไม่ใช่ผู้ตัดสินใจ — นศ ต้องอ่าน เข้าใจ และรับผิดชอบ
  2. ทุกโค้ดที่ AI สร้าง ต้องผ่าน code review ของมน.
  3. ห้ามวางข้อมูลจริง/secret ใน prompt
  4. ต้องระบุ Credit ในรายงาน ("ใช้ Agentic AI ช่วย X, Y, Z")
  5. ทดสอบก่อนเสมอ
  6. Commit message ระบุว่าเกี่ยวกับ AI-assisted

- Prompt Library — give a table of reusable prompt templates

- AI Token/Cost budget

Let me write the file.

Also include: 
- Team structure & RACI
- Milestones
- Timeline gantt (mermaid)
- Risk register
- Budget

Let me write it now.

I should also include the review of requirements (additions) - the user asked "ช่วยรีวิวสิ่งที่ต้องทำตามข้อกำหนด เพิ่มจากเอกสาร". Let me add a section in chapter 18 or a separate checklist file. I'll add a section 18.0 or a separate appendix. Actually let me put the review checklist in chapter 18 as a "Requirement Review" section, or better make it section 18.1.

Hmm, actually the review belongs better as a separate doc. But user said "รีวิวสิ่งที่ต้องทำตามข้อกำหนด เพิ่มจากเอกสาร หากจะต้องระบุ ที่จะต้องพัฒนา เพิ่มในรายงาน" — review what must be done per requirements + additions, and specify what needs to be developed, added into the report.

So I should include a review/gap analysis section. Let me add it as section 18.0 "Requirement Review & Gap Analysis" then move to plan. Or create a third file. Let me include it at the front of chapter 18 as a proper section — no wait, chapter 18 is the roadmap.

Better: Add it as an appendix section in chapter 18 titled "ภาคผนวก ก : ผลการรีวิวข้อกำหนด". Or create a third file `requirement-review-checklist.md`. I think a third file is cleaner. Let me do that.

Let me write chapter 18 first, then the review checklist.

**Tool: write**

**Input:**
```json
{
  "content": "# บทที่ 18 : แผนการดำเนินงาน (Development Plan — Agile Scrum)\n\n> แผนงานนี้อ้างอิงหลักการ **Scrum** ตาม Scrum Guide 2020\n> โดยปรับ **Sprint = 1 วันทำงาน (Fixed Time-box 1 Day)** และมี **Daily Stand-up ทุกวัน**\n> พร้อมกำหนด **Agentic AI เป็นผู้ช่วยดำเนินงาน** ในทุกขั้นตอน\n> เอกสารนี้ต้องถูก commit ลง **Git** หรือ **ClickUp** ตามข้อกำหนด 10 คะแนน\n\n---\n\n## 18.1 กรอบการทำงานร่วมกับ Agentic AI\n\n### 18.1.1 บทบาทของ Agentic AI (AI Agent Roles)\n\nเราใช้ AI เป็น **\"สมาชิกที่ประสิทธิภาพสูง\"** แต่ยังคงกำหนดผู้รับผิดชอบหลักไว้กับนักศึกษา\n\n| AI Agent | หน้าที่ที่ได้รับมอบหมาย | ผลงานที่ส่งมอบ |\n|---|---|---|\n| `@agent-architect` | วิเคราะห์ Requirement, ออกแบบ ER / DFD / Use Case / Sequence / State Diagram | ไดอะแกรมชุดแรก + Mapping |\n| `@agent-coder` | สร้าง Backend API (Controller / Service / Repository), Migration, Middleware | โค้ดฝั่ง Server |\n| `@agent-ui` | สร้าง React Component / Page, Flutter Screen | โค้ดฝั่ง Client |\n| `@agent-data` | ออกแบบ Seed Data, เขียน Query รายงาน, ตรวจปริมาณข้อมูล | ไฟล์ `.sql` |\n| `@agent-test` | ออกแบบ Test Case, สร้าง Unit / Integration Test | ไฟล์เทสต์ + รายงานผล |\n| `@agent-review` | Code Review, ตรวจ Security, ตรวจตาม Requirement | Review Comment |\n| `@agent-doc` | ร่างเอกสารรายงาน บทที่ 1–18 | ไฟล์เอกสาร |\n\n### 18.1.2 กฎการทำงานร่วมกับ AI (AI Operating Rules) — บังคับทุกคน\n\n> ⚠️ **กฎเหล่านี้ต้องเขียนลงในรายงานด้วย** เพื่อแสดงว่า AI ถูกใช้อย่างรับผิดชอบทางวิชาการ\n\n| # | กฎ |\n|---|---|\n| **AR-01** | AI เป็น **ผู้ช่วย** ไม่ใช่ผู้ตัดสินใจ — นักศึกาต้องอ่านโค้ดและเข้าใจทุกบรรทัดที่นำไปใช้ |\n| **AR-02** | โค้ดทุกส่วนที่ AI สร้างต้องผ่าน **Code Review โดยสมาชิกอย่างน้อย 1 คน** ก่อน Merge |\n| **AR-03** | **ห้ามส่งข้อมูลส่วนบุคคลจริง / Password / API Key** เข้า Prompt ของ AI |\n| **AR-04** | ต้อง **ระบุ Credit** ในรายงานว่าใช้ AI ช่วยงานใดบ้าง (แนบภาคผนวก ค) |\n| **AR-05** | ต้อง **ทดสอบด้วยตนเองทุกครั้ง** ห้าม Merge โค้ดที่ยังไม่รัน |\n| **AR-06** | ต้องเก็บ **Prompt ที่ใช้** ไว้ในโฟลเดอร์ `docs/ai-prompts/` เพื่อทำซ้ำและตรวจสอบ |\n| **AR-07** | ถ้า AI ตอบผิด ต้อง **บันทึกลง Retro Log** เพื่อปรับปรุงวิธีเขียน Prompt |\n| **AR-08** | ห้ามใช้ AI สร้างข้อมูลตัวอย่างปลอมที่ไม่สอดคล้องกับ Requirement |\n\n### 18.1.3 Prompt Library (คลัง Prompt สำเร็จรูป)\n\nเก็บไว้ที่ `docs/ai-prompts/` เพื่อใช้ซ้ำในทุก Sprint\n\n| # | ชื่อ Prompt | ใช้ทำอะไร | โครงสร้าง Prompt |\n|---|---|---|---|\n| P-01 | `requirement-to-usecase` | Requirement → Use Case + Spec | \"จาก Requirement [text] จงสร้าง Use Case Diagram พร้อม Use Case Specification ที่มี Precondition / Postcondition / Business Rule ... ใช้ PlantUML\" |\n| P-02 | `generate-ddl` | Schema → DDL | \"สร้าง MySQL DDL จาก ER [schema] พร้อม FK, Index, ENUM, COMMENT\" |\n| P-03 | `rest-endpoint` | Module → REST API | \"สร้าง Express Router + Controller + Service + Repository สำหรับ [module] พร้อม validate และ error handling\" |\n| P-04 | `rbac-middleware` | Dynamic permission | \"สร้าง middleware ตรวจสิทธิ์จากตาราง role_permission แบบ dynamic ไม่ hardcode\" |\n| P-05 | `react-page` | Screen → React | \"สร้างหน้า [ชื่อ] ด้วย React + antd ใช้ Axios เรียก [endpoint] มี Table/Form/Modal และ Permission Guard\" |\n| P-06 | `flutter-page` | Screen → Flutter | \"สร้างหน้า [ชื่อ] ด้วย Flutter ใช้ Dio เรียก REST API เก็บ token ใน secure_storage\" |\n| P-07 | `seed-data` | Data → SQL Seed | \"สร้าง SQL INSERT ข้อมูลจำนวนมากสำหรับรายงาน [ชื่อ] ปี พ.ศ. 2568 ตามโครงสร้างตาราง [schema] ให้สมจริงและหลากหลาย\" |\n| P-08 | `report-query` | Report → Query + Chart | \"เขียน SQL สำหรับรายงานที่ [n] ตามข้อกำหนด [text] แล้วอธิบายว่าควรแสดงกราฟแบบใด\" |\n| P-09 | `test-case` | Requirement → Test Case | \"สร้าง Test Case (ID, Precondition, Step, Expected) ครอบคลุม Business Rule [BR-xx]\" |\n| P-10 | `code-review` | โค้ด → Review | \"ตรวจโค้ด [file] เน้น security, error handling, performance, จุดผิดพลาดเชิงตรรกะ\" |\n\n---\n\n## 18.2 องค์ประกอบทีมและหน้าที่ (Team & Responsibility)\n\n| สมาชิก | บทบาท (Scrum) | ความรับผิดชอบหลัก | โฟกัสงาน |\n|---|---|---|---|\n| **คนที่ 1** | Scrum Master / Developer A | เอกสารประกอบโครงการ, Backend, Database | E1, E2, E6 |\n| **คนที่ 2** | Product Owner / Developer B | Requirement, ER/Diagram, Backend, Report | E2, E6, E10 |\n| **คนที่ 3** | Developer C | React Web Application | E7 |\n| **คนที่ 4** *(ถ้ามี)* | Developer D | Flutter Mobile Application | E8 |\n| — | `@agent-*` | **ผู้ช่วย AI** ตาม 18.1.1 | ทุก Epic |\n\n> **RACI Summary**\n> - **A (Accountable)** : Product Owner — รับผิดชอบผลลัพธ์รวม\n> - **R (Responsible)** : Developer ที่รับ Task\n> - **C (Consulted)** : สมาชิกคนอื่น + AI Agent\n> - **I (Informed)** : อาจารย์ที่ปรึกษา\n\n---\n\n## 18.3 กรอบเวลา Scrum ใน 1 วัน (Scrum Ceremonies — 1 Day Sprint)\n\n```\n┌─────────────────────────── 1 วันทำงาน (08:30 – 18:00) ───────────────────────────┐\n│                                                                                    │\n│  09:00 – 09:15  │ Sprint Planning      │ เลือก Task จาก Backlog → Sprint Backlog     │\n│                 │                      │ ประมาณการชั่วโมง + กำหนด Sprint Goal         │\n│─────────────────│──────────────────────│──────────────────────────────────────────────│\n│                 │                      │                                               │\n│  10:00 – 10:15  │ DAILY STAND-UP       │ 3 คำถาม (ทำอะไรไปแล้ว / จะทำอะไรต่อไป /     │\n│                 │ (ทุกวันจันทร์)        │ ติดอะไร)  + เวลาในแต่ละงาน                  │\n│                 │                      │ ⚡ สั้นที่สุด ไม่เกิน 15 นาที                   │\n│                 │                      │ บันทึกลง `docs/agile/standup/YYYY-MM-DD.md`  │\n│                 │                      │                                               │\n│  14:00 – 14:15  │  AI Sync (เฉพาะพันทร์)│  ตรวจงานค้างของ AI Agent / Prompt ที่ติด │\n│                 │                      │                                               │\n│─────────────────│──────────────────────│──────────────────────────────────────────────│\n│                 │                      │                                               │\n│  16:30 – 17:00  │ Sprint Review        │ Demo งานที่เสร็จ → ผู้ใช้/อาจารย์ให้ Feedback │\n│                 │                      │ อัปเดต Backlog และ Priority                      │\n│─────────────────│──────────────────────│──────────────────────────────────────────────│\n│                 │                      │                                               │\n│  17:00 – 17:30  │ Sprint Retrospective │ ไปดี / ไปแย่ / ปรับปรุง / Action Items      │\n│                 │                      │ บันทึกลง `docs/agile/retro/sprint-XX.md`       │\n│                 │                      │                                               │\n│  17:30 – 18:00  │ Commit + Update      │ git commit/push + ปิด Task ใน ClickUp          │\n└────────────────────────────────────────────────────────────────────────────────────┘\n```\n\n### 18.3.1 Template : Daily Stand-up (ไฟล์ `docs/agile/standup/YYYY-MM-DD.md`)\n```markdown\n# Stand-up — วันที่ YYYY-MM-DD (Sprint XX)\n\n| สมาชิก | เมื่อวานทำอะไร | วันนี้จะทำอะไร | ติดอะไร |\n|---|---|---|---|\n| คนที่ 1 | T-027 Auto-calc total_minutes (2.5 ชม.) | T-030 Schedule API (4 ชม.) | — |\n| คนที่ 2 | รีวิว ER Diagram v2 (1 ชม.) | T-031 Driver conflict check (3 ชม.) | รอคำยืนยันจากอาจารย์เรื่อง BR-04 |\n| คนที่ 3 | หน้า Login React (4 ชม.) | T-041 QR display (3 ชม.) | — |\n| AI Agent | สร้าง React Page ×2 | รอ Code Review | — |\n\n**Blocker**: ...\n**เงื่อนไข**: ต้องเสร็จภายในวันนี้เพื่อไม่กระทบ Sprint Goal\n```\n\n### 18.3.2 Template : Sprint Retrospective\n```markdown\n# Retrospective — Sprint XX (วันที่ …)\n\n## 👍 สิ่งที่ทำได้ดี\n- AI ช่วยสร้าง DDL ลดเวลาจาก 4 ชม. เหลือ 1 ชม.\n- แยก Task เล็กทำให้ปิดงานได้จริงทุกวัน\n\n## 👎 สิ่งที่ต้องปรับปรุง\n- Prompt P-03 ยังสร้างโค้ดไม่ตรวจ edge case → ต้องเพิ่ม \"คิดถึง null และ validation\"\n- Conflict check ของ Driver ใช้เวลานานกว่าที่ประมาณไว้ 2 เท่า\n\n## 🔧 Action Item (ติดตาม Sprint ถัดไป)\n- [ ] แก้ Prompt P-03 ให้ระบุ edge case (ผู้รับผิดชอบ: คนที่ 2, 1 ชม.)\n- [ ] แบ่ง T-031 เป็น 2 Task ย่อย\n```\n\n### 18.3.3 Definition of Ready (DoR) — Task พร้อมเริ่มได้เมื่อ\n- [ ] เขียน Acceptance Criteria ชัดเจน\n- [ ] ระบุ Requirement ID ที่เกี่ยวข้อง\n- [ ] ประเมินเวลาไม่เกิน 6 ชั่วโมง\n- [ ] ไม่มี Dependency กับ Task ที่ยังไม่เสร็จ\n- [ ] มี Mockup / Reference (ถ้าเป็นงาน UI)\n\n### 18.3.4 Definition of Done (DoD) — Task ถือว่าเสร็จเมื่อ\n- [ ] โค้ด Push ขึ้น Git และผ่าน Code Review ≥ 1 คน\n- [ ] รันบนเครื่องจริงแล้ว **ทำงานถูกต้อง**\n- [ ] ผ่าน Unit/Integration Test ที่เกี่ยวข้อง\n- [ ] ผ่านเกณฑ์ Business Rule ที่เกี่ยวข้องในตาราง BR-01…BR-10\n- [ ] มีเอกสาร/Comment ที่เพียงพอ (เฉพาะโค้ดส่วนที่ซับซ้อน)\n- [ ] Task ถูกเปลี่ยนเป็น **Done** ใน ClickUp พร้อมเวลาที่ใช้จริง\n- [ ] บันทึกใน Sprint Report\n\n---\n\n## 18.4 Product Backlog (รายการงานทั้งหมด)\n\n| Epic | รหัส | ชื่อ Epic | คะแนนที่เกี่ยวข้อง |\n|---|---|---|---|\n| E0 | — | โครงการ & เอกสารประกอบ | 30 คะแนน (ER 10 + Agile 10 + Mockup 10) |\n| E1 | — | Database | รองรับทุกส่วน |\n| E2 | M1 M2 M3 | Master File (พนักงาน / สิทธิ์ / Login) | 8 คะแนน |\n| E3 | F1 F2 | ระบบ Front (เส้นทาง / รอบ / รถ) | 11 คะแนน |\n| E4 | B1–B4 | ระบบการจองรถ | 9 คะแนน |\n| E5 | D1–D4 | ระบบสำหรับคนขับรถ | 10 คะแนน |\n| E6 | R1–R3 | ระบบรายงาน | 7 คะแนน |\n| E7 | — | React Web Application | — |\n| E8 | — | Flutter Mobile Application | — |\n| E9 | — | ทดสอบ & ข้อมูล | — |\n| E10 | — | เอกสารรายงาน & ส่งมอบ | — |\n\n### 18.4.1 Task Breakdown ทั้งหมด\n\n| Task ID | Epic | งาน | Req. | ชม. | Owner | AI Agent | Sprint |\n|---|---|---|---|---|---|---|---|\n| **T-001** | E0 | สร้าง Git Repo + โครงสร้างโปรเจกต์ + `.gitignore` | — | 2 | คนที่ 1 | `@agent-coder` | 0 |\n| **T-002** | E0 | ตั้ง ClickUp: Workspace / Project / List / Sprint | — | 1 | คนที่ 2 | — | 0 |\n| **T-003** | E0 | วิเคราะห์ Requirement → Use Case Diagram | M1–M3, B, D | 3 | คนที่ 2 | `@agent-architect` | 0 |\n| **T-004** | E0 | เขียน Requirement Specification + Requirement ID | ทั้งหมด | 3 | คนที่ 2 | `@agent-doc` | 0 |\n| **T-005** | E1 | ออกแบบ ER Diagram (Conceptual → Logical → Physical) | F1 | 4 | คนที่ 2 | `@agent-architect` | 1 |\n| **T-006** | E1 | เขียน Data Dictionary ทุกตาราง | F1 | 3 | คนที่ 1 | `@agent-doc` | 1 |\n| **T-007** | E1 | เขียน `01_schema.sql` (DDL + FK + Index) | F1 | 3 | คนที่ 1 | `@agent-data` | 1 |\n| **T-008** | E1 | เขียน `02_seed_master.sql` + `03_seed_front.sql` | F1, F2 | 2 | คนที่ 1 | `@agent-data` | 1 |\n| **T-009** | E0 | ออกแบบ Mockup (Figma) ทั้งระบบ | E7, E8 | 4 | คนที่ 3, 4 | `@agent-ui` | 2 |\n| **T-010** | E2 | ตั้งโปรเจกต์ Backend + config + db pool | — | 2 | คนที่ 1 | `@agent-coder` | 2 |\n| **T-011** | E2 | Middleware: errorHandler, validate, logger | — | 2 | คนที่ 1 | `@agent-coder` | 2 |\n| **T-012** | E0 | เขียน DFD (Context / Lv0 / Lv1) + Sequence Diagram | F1, B3 | 3 | คนที่ 2 | `@agent-architect` | 2 |\n| **T-013** | E2 | **Login / Logout API + JWT** | M3 | 3 | คนที่ 1 | `@agent-coder` | 3 |\n| **T-014** | E2 | **Employee CRUD API** (เพิ่ม/ลบ/แก้ไข + แผนก/ตำแหน่ง) | **M1** | 3 | คนที่ 2 | `@agent-coder` | 3 |\n| **T-015** | E2 | Department / Position CRUD API | M1 | 1.5 | คนที่ 2 | `@agent-coder` | 3 |\n| **T-016** | E7 | หน้า Login React + Token Store + Axios Interceptor | M3 | 3 | คนที่ 3 | `@agent-ui` | 3 |\n| **T-017** | E7 | หน้าจัดการพนักงาน React (Table/Form/Modal) | **M1** | 4 | คนที่ 3 | `@agent-ui` | 3 |\n| **T-018** | E2 | Role CRUD API (เพิ่ม/ลบ/แก้ไข) | **M2** | 2 | คนที่ 1 | `@agent-coder` | 4 |\n| **T-019** | E2 | Permission CRUD API | M2 | 1.5 | คนที่ 1 | `@agent-coder` | 4 |\n| **T-020** | E2 | Role ↔ Permission Mapping API | M2 | 1.5 | คนที่ 1 | `@agent-coder` | 4 |\n| **T-021** | E2 | **RBAC Middleware แบบ Dynamic (ไม่ hardcode)** | **M2** | 2.5 | คนที่ 1 | `@agent-review` | 4 |\n| **T-022** | E7 | หน้า Permission Matrix (ตารางติ๊ก) | **M2** | 3 | คนที่ 3 | `@agent-ui` | 4 |\n| **T-023** | E7 | Dynamic Menu + Route Guard ตามสิทธิ์ | M2, M3 | 2 | คนที่ 3 | `@agent-ui` | 4 |\n| **T-024** | E3 | Stop CRUD API (จุดจอดใช้ซ้ำได้หลายเส้นทาง) | **F1** | 2 | คนที่ 1 | `@agent-coder` | 5 |\n| **T-025** | E3 | Route CRUD API | F1 | 2 | คนที่ 1 | `@agent-coder` | 5 |\n| **T-026** | E3 | Route_Stop API (ลำดับจุดจอด + นาที) | **F1** | 2.5 | คนที่ 2 | `@agent-coder` | 5 |\n| **T-027** | E3 | **Auto-calc `total_minutes`** (BR-01) | **F1** | 1 | คนที่ 2 | `@agent-coder` | 5 |\n| **T-028** | E7 | หน้าจัดการจุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | �คนที่ 3 | `@agent-ui` | 5 |\n| **T-029** | E3 | Vehicle / Vehicle_Type CRUD API | F2 | 2 | คนที่ 1 | `@agent-coder` | 6 |\n| **T-030** | E3 | **Schedule CRUD + auto-generate `schedule_stop` (BR-02)** | **F2** | 3 | คนที่ 2 | `@agent-coder` | 6 |\n| **T-031** | E3 | **Driver Assignment + Conflict Check (BR-04)** | **F2** | 2.5 | คนที่ 2 | `@agent-coder` | 6 |\n| **T-032** | E3 | **Vehicle Assignment + Conflict Check (BR-04)** | **F2** | 2 | คนที่ 2 | `@agent-coder` | 6 |\n| **T-033** | E7 | หน้าจัดรอบเวลา React (ปฏิทิน + มอบหมาย) | F2 | 4 | คนที่ 3 | `@agent-ui` | 6 |\n| **T-034** | E4 | `/booking/available` — กรองรอบตาม **BR-05 (20 นาที)** | **B1** | 3 | คนที่ 1 | `@agent-coder` | 7 |\n| **T-035** | E4 | ตรวจที่นั่งว่าง + Transaction + `FOR UPDATE` (BR-07) | **B1** | 2.5 | คนที่ 1 | `@agent-coder` | 7 |\n| **T-036** | E4 | ตรวจจำนวนที่นั่งไม่เกิน 4 (BR-06) | **B1** | 0.5 | คนที่ 1 | `@agent-coder` | 7 |\n| **T-037** | E4 | สร้าง Booking + **Generate QR Token** | **B2** | 2 | �คนที่ 2 | `@agent-coder` | 7 |\n| **T-038** | E4 | ยกเลิก Booking + **คืนที่นั่ง** (BR-08) | **B3** | 1.5 | คนที่ 2 | `@agent-coder` | 7 |\n| **T-039** | E4 | My Bookings + filter (กำลังจะถึง/เสร็จแล้ว/ยกเลิก) | B2, B3 | 2 | คนที่ 2 | `@agent-coder` | 7 |\n| **T-040** | E7 | React: จุดขึ้น–ลง → รอบ → ที่นั่ง → ยืนยัน | **B1** | 4 | คนที่ 3 | `@agent-ui` | 8 |\n| **T-041** | E7 | React: แสดง QR + My Booking + ยกเลิก | **B2, B3** | 3 | คนที่ 3 | `@agent-ui` | 8 |\n| **T-042** | E8 | Flutter setup + Dio + secure_storage + routing | — | 3 | คนที่ 4 | `@agent-ui` | 8 |\n| **T-043** | E8 | Flutter: Login + Customer Booking + QR + My Booking | B1–B3 | 5 | คนที่ 4 | `@agent-ui` | 8 |\n| **T-044** | E5 | Driver: ตารางงานรายวัน API + หน้าจอ | **D1** | 2 | คนที่ 1 | `@agent-coder` | 9 |\n| **T-045** | E5 | Start Trip API + แจ้งเตือนงานชนกัน | **D2** | 2 | คนที่ 1 | `@agent-coder` | 9 |\n| **T-046** | E5 | Manifest API + หน้าจอผู้โดยสารรายจุดจอด | **D2** | 2 | คนที่ 2 | `@agent-coder` | 9 |\n| **T-047** | E5 | **QR Scan API (ผิดรอบขึ้นไม่ได้) + Flutter Scanner** | **D3** | 3 | คนที่ 4 | `@agent-ui` | 9 |\n| **T-048** | E5 | Complete Trip API + **Mark No-Show** + Summary | **D4** | 2 | คนที่ 2 | `@agent-coder` | 9 |\n| **T-049** | E6 | เขียน `04_seed_report_bulk.sql` — ข้อมูลปี พ.ศ. 2568 | R1–R3 | 4 | คนที่ 1 | `@agent-data` | 10 |\n| **T-050** | E6 | เขียน `05_views_report.sql` | R1–R3 | 2 | คนที่ 1 | `@agent-data` | 10 |\n| **T-051** | E6 | Report API #1 : รายงานที่ 1 **หรือ** 2 | R1/R2 | 3 | คนที่ 2 | `@agent-data` | 10 |\n| **T-052** | E6 | Report API #2 : รายงานที่ 3 **หรือ** 4 **หรือ** 5 | R2 | 3 | คนที่ 2 | `@agent-data` | 10 |\n| **T-053** | E6 | Report API #3 : รายงานที่ 6 **หรือ** 7 | R2 | 2 | คนที่ 2 | `@agent-data` | 10 |\n| **T-054** | E7 | React: หน้ารายงาน #1 + กราฟ Recharts | R1 | 3 | คนที่ 3 | `@agent-ui` | 11 |\n| **T-055** | E7 | React: หน้ารายงาน #2 + #3 + กราฟ | R2 | 4 | คนที่ 3 | `@agent-ui` | 11 |\n| **T-056** | E8 | *(กลุ่ม Embedded)* เพิ่มหน้ารายงาน 2 ข้อบน Flutter | R-Embedded | 4 | คนที่ 4 | `@agent-ui` | 11 |\n| **T-057** | E9 | Test Plan + Test Case ตาม BR-01…BR-10 | ทั้งหมด | 3 | คนที่ 2 | `@agent-test` | 12 |\n| **T-058** | E9 | Unit Test (Backend) + Integration Test | — | 4 | คนที่ 1 | `@agent-test` | 12 |\n| **T-059** | E9 | UAT กับผู้ใช้จริง 5 คน + เก็บ Feedback | — | 3 | ทุกคน | `@agent-doc` | 12 |\n| **T-060** | E9 | Performance Test + Optimize Query (Index) | NFR | 2 | คนที่ 1 | `@agent-review` | 12 |\n| **T-061** | E9 | แก้ Bug ที่พบจากการทดสอบ | — | 4 | ทุกคน | `@agent-coder` | 12 |\n| **T-062** | E0 | ทำ **Traceability Matrix** (Req ↔ Use Case ↔ Table ↔ Screen ↔ Test) | ทั้งหมด | 3 | คนที่ 2 | `@agent-doc` | 13 |\n| **T-063** | E10 | เขียนรายงาน บทที่ 1–16 | — | 6 | คนที่ 2 | `@agent-doc` | 13 |\n| **T-064** | E10 | คู่มือการใช้งาน + คู่มือติดตั้ง (Deployment Guide) | — | 3 | คนที่ 4 | `@agent-doc` | 13 |\n| **T-065** | E0 | เขียน AI Usage Credit + Prompt Log ลง `docs/` | — | 1.5 | คนที่ 1 | — | 13 |\n| **T-066** | E0 | Sprint Retrospective รวม + ปิด Release + Tag `v1.0.0` | — | 1 | ทุกคน | — | 13 |\n| **T-067** | E10 | จัดทำ Mockup ไฟล์สุดท้าย + สไลด์นำเสนอ | — | 3 | คนที่ 3 | `@agent-ui` | 13 |\n\n> **รวม 67 Task** · **ประมาณการ 199 ชั่วโมงงาน** · 4 คน + AI ≈ **14 วันทำงาน**\n\n---\n\n## 18.5 Sprint Backlog และ Sprint Goal\n\n| Sprint | วัน | Sprint Goal | Task | คะแนนที่ปิด |\n|---|---|---|---|---|\n| **Sprint 0** | จ. 1 | โครงสร้างโปรเจกต์ + Requirement เป็นรูปธรรม | T-001…T-004 | ตั้งต้น |\n| **Sprint 1** | จ. 2 | ฐานข้อมูล + ER Diagram + Data Dictionary | T-005…T-008 | ER 10 |\n| **Sprint 2** | พ. 3 | Mockup + DFD/Sequence + Backend Skeleton | T-009…T-012 | Mockup 10, Agile 10 |\n| **Sprint 3** | พฤ. 4 | **Master 1 + Master 3** (พนักงาน + Login) | T-013…T-017 | M1 3 + M3 2 |\n| **Sprint 4** | ศ. 5 | **Master 2** สิทธิ์ Dynamic | T-018…T-023 | M2 3 |\n| **Sprint 5** | จ. 6 (จันทร์) | **Front 1** เส้นทาง + เวลารวม | T-024…T-028 | F1 2 |\n| **Sprint 6** | อ. 7 | **Front 2** รอบเวลา + มอบหมาย + Conflict | T-029…T-033 | F2 3 |\n| **Sprint 7** | พ. 8 | **ระบบจอง** API ครบทุกเงื่อนไข | T-034…T-039 | B1 5 + B2 1 + B3 3 |\n| **Sprint 8** | พฤ. 9 | Booking UI ทั้ง React และ Flutter | T-040…T-043 | — |\n| **Sprint 9** | ศ. 10 | **ระบบคนขับ** ครบทุกเงื่อนไข | T-044…T-048 | D1 1 + D2 1 + D3 1 + D4 3 |\n| **Sprint 10** | จ. 11 | ข้อมูลรายงานปี 2568 + Report API | T-049…T-053 | — |\n| **Sprint 11** | อ. 12 | หน้ารายงาน + กราฟ | T-054…T-056 | R 3+2+2 |\n| **Sprint 12** | พ. 13 | ทดสอบ + UAT + Performance | T-057…T-061 | — |\n| **Sprint 13** | พฤ. 14 | เอกสารรายงาน + ส่งมอบ + Retrospective | T-062…T-067 | — |\n\n### 18.5.1 Sprint Goal เป็นรูปแบบ SMART\n> ❌ ที่ไม่ดี : *\"ทำระบบจองรถให้เสร็จ\"*\n> ✅ ที่ดี : *\"Sprint 7 ต้องปิด T-034…T-039 ครบ 6 Task เพื่อให้ API การจองรองรับ\n> BR-05, BR-06, BR-07, BR-08 ผ่านการทดสอบ และพร้อมให้ Sprint 8 ทำ UI ได้ทันที\"*\n\n---\n\n## 18.6 Sprint Plan (รายละเอียดรายสัปดาห์)\n\n### 🗓 Sprint 0 — Day 1 : Foundation\n**Sprint Goal:** ทุกคนเข้าใจขอบเขตงาน และมีโครงสร้างเก็บงานเรียบร้อย\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-001 | Git Repo + โครงสร้าง + `.gitignore` | 2 | `@agent-coder` | โฟลเดอร์ครบ + branch `main/develop` |\n| T-002 | ClickUp Project + Sprint List | 1 | — | ทุก Task ลง ClickUp |\n| T-003 | Requirement → Use Case Diagram | 3 | `@agent-architect` | ไดอะแกรม PlantUML |\n| T-004 | Requirement Specification | 3 | `@agent-doc` | เอกสาร Req + Requirement ID |\n**DoD วันนี้:** `git log` มี 1 commit และ ClickUp มี Backlog ครบ 67 Task\n\n---\n\n### 🗓 Sprint 1 — Day 2 : Database\n**Sprint Goal:** ฐานข้อมูลทำงานได้จริง พร้อมข้อมูลตัวอย่างตามข้อกำหนด\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-005 | ER Diagram 3 ระดับ | 4 | `@agent-architect` | ER + Mapping (10 คะแนน) |\n| T-006 | Data Dictionary | 3 | `@agent-doc` | ตารางศัพท์ |\n| T-007 | `01_schema.sql` | 3 | `@agent-data` | DDL รันผ่านไม่มี error |\n| T-008 | Seed Master + Front | 2 | `@agent-data` | ข้อมูล 3 เส้นทาง, 7/4/5 จุด, รอบ 9.30/11.00/13.00/15.00 |\n**DoD:** `total_minutes` เส้นทาง 1 = 30, เส้นทาง 2 = 13, เส้นทาง 3 = 12 ✅\n\n---\n\n### 🗓 Sprint 2 — Day 3 : Mockup & Backend Skeleton\n**Sprint Goal:** ปิดคะแนน Mockup (10) และมี Backend ที่รันได้\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-009 | Mockup ทั้งระบบ (Figma) | 4 | `@agent-ui` | 25 หน้าจอ (10 คะแนน) |\n| T-010 | Backend setup + db pool | 2 | `@agent-coder` | `GET /health` ตอบ OK |\n| T-011 | Middleware | 2 | `@agent-coder` | errorHandler + validate |\n| T-012 | DFD + Sequence Diagram | 3 | `@agent-architect` | 5 ไดอะแกรม |\n**DoD:** Mockup อัปโหลดขึ้น ClickUp + ไดอะแกรม commit แล้ว\n\n---\n\n### 🗓 Sprint 3 — Day 4 : Master 1 + Master 3 ⭐\n**Sprint Goal:** Login/Logout ทำงาน และจัดการพนักงานได้ครบ\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-013 | Login/Logout + JWT | 3 | `@agent-coder` | `/auth/login` คืน token |\n| T-014 | **Employee CRUD** | 3 | `@agent-coder` | เพิ่ม/แก้ไข/ลบได้ |\n| T-015 | Dept/Position CRUD | 1.5 | `@agent-coder` | — |\n| T-016 | Login React + Store | 3 | `@agent-ui` | Interceptor จัดการ 401 |\n| T-017 | หน้าจัดการพนักงาน React | 4 | `@agent-ui` | ครบ 4 เมนู (Create/Read/Update/Delete) |\n**DoD:** ✅ เพิ่มพนักงานพร้อมแผนก+ตำแหน่ง → Login → เห็นในตาราง → แก้ไข → ลบ\n**คะแนนที่ปิด:** M1 = 3, M3 = 2\n\n---\n\n### 🗓 Sprint 4 — Day 5 : Master 2 Dynamic Permission ⭐\n**Sprint Goal:** เปลี่ยนสิทธิ์แล้วเมนูเปลี่ยนทันทีโดยไม่แก้โค้ด\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-018 | Role CRUD | 2 | `@agent-coder` | เพิ่ม/ลบ/แก้ Role ได้ |\n| T-019 | Permission CRUD | 1.5 | `@agent-coder` | — |\n| T-020 | Mapping API | 1.5 | `@agent-coder` | — |\n| T-021 | **RBAC Dynamic Middleware** | 2.5 | `@agent-review` | ไม่มี `if(admin)` |\n| T-022 | Permission Matrix React | 3 | `@agent-ui` | ตารางติ๊กบันทึกได้ |\n| T-023 | Dynamic Menu + Route Guard | 2 | `@agent-ui` | — |\n**DoD:** ✅ ถอดสิทธิ์ `EMPLOYEE.VIEW` จาก Role Staff → เมนู \"พนักงาน\" หายจากหน้าจอของ user นั้นทันที\n**คะแนนที่ปิด:** M2 = 3\n\n---\n\n### 🗓 Sprint 5 — Day 6 : Front 1 Route ⭐\n| Task | งาน | ชม. | AI |\n|---|---|---|---|\n| T-024 | Stop CRUD | 2 | `@agent-coder` |\n| T-025 | Route CRUD | 2 | `@agent-coder` |\n| T-026 | Route_Stop + นาที | 2.5 | `@agent-coder` |\n| T-027 | **Auto-calc total_minutes** | 1 | `@agent-coder` |\n| T-028 | React: จุดจอด + เส้นทาง | 4 | `@agent-ui` |\n**DoD:** ✅ เพิ่มจุดจอด 7 จุดในเส้นทาง 1 → ระบบรวมเวลาได้ 30 นาทีอัตโนมัติ · เพิ่ม \"ร้านส้มตำปูนาง\" ลงเส้นทาง 1 และ 2 ได้ (จุดจอดใช้ซ้ำได้)\n**คะแนนที่ปิด:** F1 = 2\n\n---\n\n### 🗓 Sprint 6 — Day 7 : Front 2 Schedule ⭐\n| Task | งาน | ชม. | AI |\n|---|---|---|---|\n| T-029 | Vehicle / Type CRUD | 2 | `@agent-coder` |\n| T-030 | **Schedule + auto-generate schedule_stop** | 3 | `@agent-coder` |\n| T-031 | **Driver assign + Conflict Check** | 2.5 | `@agent-coder` |\n| T-032 | **Vehicle assign + Conflict Check** | 2 | `@agent-coder` |\n| T-033 | React: ปฏิทิน + มอบหมาย | 4 | `@agent-ui` |\n**DoD:** ✅ สร้างรอบ 9:30 เส้นทาง 1 → ระบบสร้างจุดจอดพร้อมเวลามาให้อัตโนมัติ (มหาวิทยาลัย 09:30 → โลตัส 09:35 → รพ. 09:38 …) · มอบหมายรถ สย 2591 ให้ 2 รอบซ้อนกัน → ระบบแจ้ง Conflict\n**คะแนนที่ปิด:** F2 = 3\n\n---\n\n### 🗓 Sprint 7 — Day 8 : Booking API ⭐⭐ (คะแนนสูงสุด 9)\n**Sprint Goal:** API การจองผ่านทุก Business Rule ก่อนเริ่มทำ UI\n| Task | งาน | ชม. | AI | เงื่อนไขที่ต้องผ่าน |\n|---|---|---|---|---|\n| T-034 | Available trip | 3 | `@agent-coder` | **BR-05** เหลือเวลา ≥ 20 นาทีเท่านั้น |\n| T-035 | ที่นั่ง + Transaction | 2.5 | `@agent-coder` | **BR-07** พร้อมกัน 2 คนจองพร้อมกันต้องไม่เกิน capacity |\n| T-036 | ไม่เกิน 4 ที่นั่ง | 0.5 | `@agent-coder` | **BR-06** |\n| T-037 | Create + QR Token | 2 | `@agent-coder` | **B2** |\n| T-038 | Cancel + คืนที่นั่ง | 1.5 | `@agent-coder` | **BR-08** |\n| T-039 | My Bookings + filter | 2 | `@agent-coder` | **B2** |\n**DoD:** ✅\n- จองรถที่ถึงในอีก 15 นาที → ระบบไม่แสดงรอบนั้น\n- รถ 9 ที่นั่ง จองไป 8 → จองเพิ่มได้อีก 1 ที่นั่งเท่านั้น\n- จอง 5 ที่นั่ง → ถูกปฏิเสธ\n- ยกเลิก 1 ที่นั่ง → ที่นั่งกลับมาเหลือ 1\n**คะแนนที่ปิด:** B1 = 5, B2 = 1, B3 = 3\n\n---\n\n### 🗓 Sprint 8 — Day 9 : Booking UI\n| Task | งาน | ชม. | AI |\n|---|---|---|---|\n| T-040 | React Booking Flow | 4 | `@agent-ui` |\n| T-041 | React QR + My Booking + Cancel | 3 | `@agent-ui` |\n| T-042 | Flutter setup | 3 | `@agent-ui` |\n| T-043 | Flutter Customer flow | 5 | `@agent-ui` |\n**DoD:** ✅ ผู้ใช้จองผ่าน React และผ่าน Flutter จนได้ QR และยกเลิกได้\n\n---\n\n### 🗓 Sprint 9 — Day 10 : Driver System ⭐⭐\n**Sprint Goal:** คนขับใช้งานได้ครบวงจรตั้งแต่ดูตารางจนปิดรอบ\n| Task | งาน | ชม. | AI | เงื่อนไขที่ต้องผ่าน |\n|---|---|---|---|---|\n| T-044 | ตารางงานรายวัน | 2 | `@agent-coder` | **D1** เห็นเฉพาะรอบของตัวเอง |\n| T-045 | Start Trip | 2 | `@agent-coder` | **D2** แจ้งชัดว่ามีงานอื่นค้างอยู่หรือไม่ |\n| T-046 | Manifest | 2 | `@agent-coder` | **D2** เห็นขึ้น/ลง รายจุดจอด + ชื่อผู้โดยสาร |\n| T-047 | **QR Scan** | 3 | `@agent-ui` | **D3** สแกน QR รอบอื่น → ปฏิเสธ |\n| T-048 | Complete + No-Show | 2 | `@agent-coder` | **D4** สรุป \"มา 5 คน / ไม่มา 2 คน / ใครบ้าง\" |\n**DoD:** ✅\n- คนขับคนเดียวกันเปิด 2 รอบพร้อมกัน → ระบบเตือน\n- สแกน QR ของการจองรอบอื่น → ขึ้น \"QR นี้ไม่ใช่รอบที่กำลังเดินรถ\"\n- ปิดงาน → สรุปยอดผู้โดยสาร + ชื่อคนที่ไม่มา\n**คะแนนที่ปิด:** D1 1 + D2 1 + D3 1 + D4 3 = 6\n\n---\n\n### 🗓 Sprint 10 — Day 11 : Report Data & API\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-049 | `04_seed_report_bulk.sql` | 4 | `@agent-data` | **ข้อมูลปี พ.ศ. 2568 จำนวนมาก** ตามหมายเหตุในข้อกำหนด |\n| T-050 | `05_views_report.sql` | 2 | `@agent-data` | View ช่วย Aggregate |\n| T-051 | Report API #1 | 3 | `@agent-data` | รายงานที่ 1 หรือ 2 |\n| T-052 | Report API #2 | 3 | `@agent-data` | รายงานที่ 3 / 4 / 5 |\n| T-053 | Report API #3 | 2 | `@agent-data` | รายงานที่ 6 / 7 |\n**DoD:** ✅ `booking` มี ≥ 50,000 แถว · ทุก Query รัน < 3 วินาที · ตัวเลขตรงกับตัวอย่างในข้อกำหนด\n\n---\n\n### 🗓 Sprint 11 — Day 12 : Report UI\n| Task | งาน | ชม. | AI |\n|---|---|---|---|\n| T-054 | รายงาน #1 + กราฟ | 3 | `@agent-ui` |\n| T-055 | รายงาน #2, #3 + กราฟ | 4 | `@agent-ui` |\n| T-056 | *(Embedded)* เพิ่มรายงานบน Flutter | 4 | `@agent-ui` |\n**DoD:** ✅ เลือกช่วงวันที่แล้วได้ทั้งตารางรายละเอียด + กราฟตามตัวอย่าง\n\n---\n\n### 🗓 Sprint 12 — Day 13 : Testing\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-057 | Test Plan + Test Case | 3 | `@agent-test` | ครบ BR-01…BR-10 (10 คะแนนถามตอบ) |\n| T-058 | Unit + Integration Test | 4 | `@agent-test` | Coverage ≥ 60% |\n| T-059 | UAT (5 คน) | 3 | `@agent-doc` | สรุป Feedback |\n| T-060 | Performance + Index | 2 | `@agent-review` | API < 500 ms |\n| T-061 | แก้ Bug | 4 | `@agent-coder` | Severity สูง = 0 |\n**DoD:** ✅ ไม่มี Bug ระดับ Critical/High · Test Case ผ่าน ≥ 95%\n\n---\n\n### 🗓 Sprint 13 — Day 14 : Documentation & Release\n| Task | งาน | ชม. | AI | ผลลัพธ์ |\n|---|---|---|---|---|\n| T-062 | Traceability Matrix | 3 | `@agent-doc` | ตรวจครบทุก Requirement |\n| T-063 | เขียนรายงาน บท 1–16 | 6 | `@agent-doc` | เอกสารครบ |\n| T-064 | คู่มือใช้งาน + Deployment | 3 | `@agent-doc` | — |\n| T-065 | AI Usage Credit + Prompt Log | 1.5 | — | **ข้อบังคับ AR-04** |\n| T-066 | Retrospective + Tag `v1.0.0` | 1 | — | — |\n| T-067 | Mockup final + สไลด์ | 3 | `@agent-ui` | — |\n**DoD:** ✅ รายงานครบ 18 บท + ส่งมอบใน Git/ClickUp\n\n---\n\n## 18.7 การติดตามความคืบหน้า (Tracking)\n\n### 18.7.1 Sprint Board (คอลัมน์ ClickUp)\n```\n┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐\n│  TO DO   │→│ IN PROG. │→│  AI DEV  │→│  REVIEW  │→│   TEST   │→│   DONE   │\n│  (Backlog)│ │  (doing) │ │(agent)   │ │(peer)    │ │  (QA)    │ │          │\n└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘\n```\n> คอลัมน์ **AI DEV** เพิ่มเข้ามาเพื่อให้เห็นชัดว่า Task ไหนอยู่ระหว่างให้ AI ช่วยเขียน\n\n### 18.7.2 Velocity Chart\n| Sprint | Story Points เป้า | เสร็จจริง | Velocity | คะแนนที่ปิด |\n|---|---|---|---|---|\n| 0 | 4 | 4 | 4 | — |\n| 1 | 5 | 5 | 5 | ER 10 |\n| 2 | 5 | 5 | 5 | Mockup 10 |\n| 3 | 6 | 6 | 6 | M1 3, M3 2 |\n| 4 | 5 | 5 | 5 | M2 3 |\n| 5 | 5 | 5 | 5 | F1 2 |\n| 6 | 6 | 6 | 6 | F2 3 |\n| 7 | 6 | 6 | 6 | B1 5, B2 1, B3 3 |\n| 8 | 5 | 5 | 5 | — |\n| 9 | 5 | 5 | 5 | D 6 |\n| 10 | 5 | 5 | 5 | — |\n| 11 | 4 | 4 | 4 | R 7 |\n| 12 | 5 | 5 | 5 | — |\n| 13 | 6 | 6 | 6 | Agile 10 |\n| **รวม** | **72** | **72** | **72** | **~100** |\n\n### 18.7.3 Burndown Chart\n| วันที่เหลือ | งานคงเหลือ (เป้า) | งานคงเหลือ (จริง) | ความเบี่ยงเบน |\n|---|---|---|---|\n| เริ่ม Sprint | 6 | 6 | 0 |\n| ชั่วโมงที่ 2 | 5 | 4 | −1 ✅ เร็วกว่า |\n| ชั่วโมงที่ 4 | 4 | 4 | 0 |\n| ชั่วโมงที่ 6 | 2 | 3 | +1 ⚠️ ช้ากว่า |\n| ชั่วโมงที่ 7 | 1 | 1 | 0 |\n| สิ้นสุด Sprint | 0 | 0 | 0 ✅ |\n\n### 18.7.4 ตารางประกอบ Task ↔ Requirement ↔ คะแนน (Traceability)\n| Requirement | Task ที่เกี่ยวข้อง | Sprint | คะแนน |\n|---|---|---|---|\n| M1 จัดการพนักงาน | T-014, T-015, T-017 | 3 | 3 |\n| M2 สิทธิ์ Dynamic | T-018…T-023 | 4 | 3 |\n| M3 Login/Logout | T-013, T-016 | 3 | 2 |\n| F1 จัดเส้นทาง | T-024…T-028 | 5 | 2 |\n| F2 จัดรอบ/มอบหมาย | T-029…T-033 | 6 | 3 |\n| B1 เงื่อนไขการจอง | T-034, T-035, T-036, T-040 | 7, 8 | 5 |\n| B2 QR + ดูรอบ | T-037, T-039, T-041, T-043 | 7, 8 | 1 |\n| B3 ยกเลิก + คืนที่นั่ง | T-038, T-041, T-043 | 7, 8 | 3 |\n| D1 ตารางงานคนขับ | T-044 | 9 | 1 |\n| D2 เริ่มงาน + manifest | T-045, T-046 | 9 | 1 |\n| D3 เช็ค QR | T-047 | 9 | 1 |\n| D4 ปิดงาน + สรุป | T-048 | 9 | 3 |\n| R รายงาน 3 ข้อ | T-051…T-055 | 10, 11 | 7 |\n| ER + Mapping | T-005, T-006 | 1 | 10 |\n| Mockup | T-009, T-067 | 2, 13 | 10 |\n| Agile Plan | ทั้งบทนี้ | 0–13 | 10 |\n\n---\n\n## 18.8 Git Strategy\n\n### 18.8.1 Branching Model (Git Flow แบบย่อ)\n```\nmain          ────────●──────────────────────●────────→  Release v1.0.0\n                          \\                  /              (tag)\ndevelop      ──●──●──●──●───●──●──●──●──●──●──●──●───●──→\n                  \\/      \\/     \\/     \\/     \\/\nfeature/T-0xx ────●        ●      ●      ●      ●      (PR → develop)\n```\n\n### 18.8.2 Commit Convention\n```\n<type>(<task-id>): <description>\n\nfeat(T-037): add booking create API with QR token generation\nfix(T-035): prevent seat overbooking using SELECT FOR UPDATE\ndocs(T-062): add traceability matrix\ndb(T-049): add bulk seed data for fiscal year 2568\ntest(T-058): add integration test for BR-05 lead time rule\nchore(T-001): initial project structure\n```\n| Type | ใช้กับ |\n|---|---|\n| `feat` | ฟีเจอร์ใหม่ |\n| `fix` | แก้บั๊ก |\n| `docs` | เอกสาร |\n| `db` | Schema / Seed |\n| `test` | เทสต์ |\n| `refactor` | ปรับโค้ด |\n| `chore` | งานอื่น |\n\n> เนื่องจากใช้ AI ช่วยเขียน แนะนำให้เพิ่ม tag ท้ายข้อความ:\n> `[ai-assisted]` เพื่อให้ตรวจสอบย้อนหลังได้ว่าส่วนใด AI ช่วย\n\n### 18.8.3 โครงสร้างโฟลเดอร์เอกสาร Agile (ต้อง commit)\n```\ndocs/agile/\n├── README.md                    # บทที่ 18 (แผนงานฉบับนี้)\n├── backlog.md                   # Product Backlog ทั้งหมด\n├── sprints/\n│   ├── sprint-00-plan.md\n│   ├── sprint-00-report.md\n│   ├── sprint-01-plan.md\n│   └── ...\n├── standup/\n│   ├── 2026-09-28.md\n│   └── ...\n├── retro/\n│   ├── sprint-00.md\n│   └── ...\n└── ai-prompts/\n    ├── P-01_requirement-to-usecase.md\n    └── ...\n```\n\n---\n\n## 18.9 Risk Register (ทะเบียนความเสี่ยง)\n\n| # | ความเสี่ยง | โอกาส | ผลกระทบ | มาตรการป้องกัน / แผนรับมือ | ผู้รับผิดชอบ |\n|---|---|---|---|---|---|\n| R1 | ข้อมูลรายงานน้อยเกินไป รายงานออกไม่ได้ | สูง | สูง | เขียน `04_seed_report_bulk.sql` ≥ 50,000 แถวตั้งแต่ Sprint 10 · ทดสอบ Query ทุกข้อ | คนที่ 1 |\n| R2 | QR Scanner ทำงานไม่ได้บน Android Emulator | สูง | กลาง | ทดสอบตั้งแต่ Sprint 9 · เตรียม Manual Token Input เป็นทางสำรอง | คนที่ 4 |\n| R3 | โค้ดจาก AI มีบั๊กแฝง / ไม่ตรง Requirement | กลาง | สูง | **AR-02** Code Review ทุกส่วน · **AR-05** ทดสอบก่อน Merge · ใช้ `@agent-review` | ทุกคน |\n| R4 | เขียน Dynamic RBAC กลับไป hardcode โดยไม่รู้ตัว | กลาง | สูง | Code Review เช็ค `grep -r \"role === 'admin'\"` ต้องไม่เจอ · เขียน Test ยืนยัน | คนที่ 1 |\n| R5 | เวลาไม่พอ เพราะทำเกินขอบเขต | กลาง | สูง | ใช้ MoSCoW · ตัด R5 (รายงานที่ 7) หรือ T-056 ออกก่อน · เลื่อนงานตก Sprint ถัดไป | Product Owner |\n| R6 | เช็คสิทธิ์ Dynamic แล้วหน้าจอ error เพราะ Query ช้า | ต่ำ | กลาง | Cache permission ใน JWT 5 นาที + Redis (ถ้ามีเวลา) | คนที่ 1 |\n| R7 | Schedule generate เวลาไม่ตรงกับตารางตัวอย่าง | กลาง | กลาง | เทียบกับตาราง จุดที่ 1–5 ในข้อกำหนดก่อน Sprint Review | คนที่ 2 |\n| R8 | Flutter เข้าเครื่อง Android ไม่ได้ (ไม่มี SDK) | ต่ำ | สูง | ตรวจเครื่องมือตั้งแต่ Sprint 0 (T-001) | คนที่ 4 |\n| R9 | ลืมบันทึก AI Credit ทำให้เสียคะแนน | ต่ำ | กลาง | Task T-065 ใน Sprint สุดท้าย + บันทึกทุกวันใน Stand-up | คนที่ 1 |\n\n---\n\n## 18.10 Milestones (หมุดหมาย)\n\n| Milestone | Sprint | วัน | ผลงาน / เกณฑ์สำเร็จ |\n|---|---|---|---|\n| **M0 — Baseline Approved** | 2 | พ. 3 | ER + Mockup + ไดอะแกรม เสนออาจารย์อนุมัติ |\n| **M1 — Data Ready** | 1 | จ. 2 | ฐานข้อมูล + Seed ตามตัวอย่างในข้อกำหนด |\n| **M2 — Core Master Done** | 4 | ศ. 5 | M1 + M2 + M3 ผ่าน (8 คะแนน) |\n| **M3 — Front Done** | 6 | อ. 7 | F1 + F2 ผ่าน (5 คะแนน) |\n| **M4 — Booking & Driver Done** | 9 | ศ. 10 | B1–B4 + D1–D4 ผ่าน (15 คะแนน) |\n| **M5 — Report Done** | 11 | อ. 12 | รายงาน 3 ข้อ + กราฟ ผ่าน (7 คะแนน) |\n| **M6 — UAT Passed** | 12 | พ. 13 | ไม่มี Bug Critical/High |\n| **M7 — Release 1.0** | 13 | พฤ. 14 | รายงาน 18 บท + Mockup + Agile docs ส่งครบ |\n\n---\n\n## 18.11 Communication Plan\n\n| ช่องทาง | วัตถุประสงค์ | ความถี่ |\n|---|---|---|\n| **Daily Stand-up (ประชุมตั้งหน้า 15 นาที)** | ซิงก์ความคืบหน้า / หา Blocker | ทุกวัน 10:00 |\n| **ClickUp Comments** | อภิปราย Task แบบ asynchronous | ตลอดวัน |\n| **`docs/agile/standup/`** | บันทึกถาวร (หลักฐาน Agile) | ทุกวัน |\n| **Sprint Review** | Demo ให้อาจารย์ / เพื่อนดู | ทุกวัน 16:30 |\n| **Sprint Retrospective** | ปรับปรุงวิธีทำงาน | ทุกวัน 17:00 |\n| **Slack / Line Group** | ประสานงานด่วน | ตลอดเวลา |\n| **GitHub Issues** | บันทึก Bug | เมื่อพบ |\n\n---\n\n## 18.12 Definition of Ready / Done (สรุป)\n\n### Definition of Ready (งานพร้อมลงมือ)\n1. เขียน **Acceptance Criteria** เป็นข้อความชัดเจน\n2. ผูก **Requirement ID** (เช่น `BR-05`, `D3`)\n3. ประเมินเวลา **≤ 6 ชั่วโมง**\n4. **ไม่มี Dependency** กับงานที่ยังไม่ Done\n5. มี **Mockup / Reference** สำหรับงาน UI\n6. มี Prompt Template ที่จะใช้กับ AI (ถ้าเป็นงานที่ใช้ AI)\n\n### Definition of Done (งานเสร็จสมบูรณ์)\n1. โค้ด Push ขึ้น Git ✅\n2. ผ่าน **Code Review** ≥ 1 คน ✅\n3. **ทดสอบด้วยตนเองแล้วทำงานถูกต้อง** ✅ (AR-05)\n4. ผ่าน Unit/Integration Test ✅\n5. ผ่าน **Business Rule** ที่เกี่ยวข้อง (BR-01…BR-10) ✅\n6. มีเอกสารประกอบโค้ดส่วนซับซ้อน ✅\n7. ปิด Task ใน ClickUp พร้อม **เวลาที่ใช้จริง** ✅\n8. บันทึกใน Sprint Report ✅\n\n---\n\n## 18.13 สรุปผลลัพธ์ที่คาดหวัง\n\n| ผลลัพธ์ | ตัวชี้วัด | เป้าหมาย |\n|---|---|---|\n| Requirement ครบถ้วน | Traceability Matrix ครอบคลุม 100% | 100% |\n| ระบบทำงานได้จริง | UAT ผ่าน | ≥ 95% Test Case |\n| คะแนนโปรแกรม | ปิดครบทุกข้อบังคับ | 100 คะแนน |\n| ประสิทธิภาพ | API Response Time | < 500 ms |\n| ข้อมูลรายงาน | จำนวน Booking | ≥ 50,000 แถว |\n| เอกสาร Agile | Stand-up ครบ 14 วัน + Retro ครบ 14 Sprint | 100% |\n| AI Governance | มี Prompt Log + AI Credit | 100% |\n\n---\n",
  "filePath": "D:\\data\\miniproject\\docs\\chapter-18-development-plan.md"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Big Pickle · 6.2s)

_Thinking:_

Now create the third file: requirement review & gap analysis checklist.

Let me create `requirement-review-checklist.md`.

This should be a review of what must be done per the requirements + additions, presented as a checkable list. Include:
1. Deliverables checklist
2. Scoring breakdown
3. Gap analysis (what PDF doesn't specify)
4. Business rules to define
5. Questions to ask lecturer
6. Pre-submission checklist

Let me write it.

Also I noticed I have a typo in chapter 18: "�คนที่ 3" — a mojibake character. Let me fix that.

Let me check. In T-028 row: "| T-028 | React: จุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | �คนที่ 3 | `@agent-ui` | 5 |" and T-037 "| **B2** | 2 | �คนที่ 2 |".

Let me fix those.

**Tool: edit**

**Input:**
```json
{
  "filePath": "D:\\data\\miniproject\\docs\\chapter-18-development-plan.md",
  "oldString": "| T-028 | React: จุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | �คนที่ 3 | `@agent-ui` | 5 |",
  "newString": "| T-028 | React: จุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | คนที่ 3 | `@agent-ui` | 5 |"
}
```

**Error:**
```
Could not find oldString in the file. It must match exactly, including whitespace, indentation, and line endings.
```

---

## Assistant (Build · Big Pickle · 3.2s)

**Tool: bash**

**Input:**
```json
{
  "command": "Select-String -Path \"D:\\data\\miniproject\\docs\\chapter-18-development-plan.md\" -Pattern \"\\uFFFD\" -Encoding utf8 | ForEach-Object { \"$($_.LineNumber): $($_.Line)\" }"
}
```

**Output:**
```
204: | **T-028** | E7 | ???????????????? + ??????? React (???????????) | F1 | 4 | ?????? 3 | `@agent-ui` | 5 |
213: | **T-037** | E4 | ????? Booking + **Generate QR Token** | **B2** | 2 | ?????? 2 | `@agent-coder` | 7 |

```

---

## Assistant (Build · Big Pickle · 4.7s)

_Thinking:_

The read of the file was fine in my tool, but the actual file has some odd bytes? Wait — Select-String shows "?" for Thai chars, that's just console encoding. But it matched the U+FFFD pattern, meaning there IS a replacement char.

Hmm, actually Select-String with `\uFFFD` in PowerShell regex... PowerShell doesn't support `\uFFFD` escape in regex directly; it might be interpreted differently. Actually .NET regex does support `\uFFFF`. So it matched.

But the output shows "?" for everything which is just encoding of output. Let me use python to check precisely.

**Tool: bash**

**Input:**
```json
{
  "command": "$env:PYTHONIOENCODING='utf-8'; python -c \"\nimport io\np=r'D:\\data\\miniproject\\docs\\chapter-18-development-plan.md'\ns=io.open(p,encoding='utf-8').read()\nfor i,l in enumerate(s.split('\\n'),1):\n    if '\\ufffd' in l:\n        print(i, repr(l[:120]))\nprint('total lines', len(s.split(chr(10))))\n\""
}
```

**Output:**
```
  File "<string>", line 1
    ||  goto :error
IndentationError: unexpected indent

```

---

## Assistant (Build · Big Pickle · 10.5s)

**Tool: write**

**Input:**
```json
{
  "content": "import io, sys\np = r'D:\\data\\miniproject\\docs\\chapter-18-development-plan.md'\ns = io.open(p, encoding='utf-8').read()\nbad = 0\nfor i, l in enumerate(s.split('\\n'), 1):\n    if '\\ufffd' in l:\n        bad += 1\n        sys.stdout.buffer.write((\"%d: %s\\n\" % (i, l[:140])).encode('utf-8'))\nsys.stdout.buffer.write((\"bad=%d total=%d\\n\" % (bad, len(s.split(chr(10))))).encode('utf-8'))\n",
  "filePath": "C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\chk.py"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Big Pickle · 2.9s)

**Tool: bash**

**Input:**
```json
{
  "command": "$env:PYTHONIOENCODING='utf-8'; python \"C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\chk.py\""
}
```

**Output:**
```
204: | **T-028** | E7 | หน้าจัดการจุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | �คนที่ 3 | `@agent-ui` | 5 |
213: | **T-037** | E4 | สร้าง Booking + **Generate QR Token** | **B2** | 2 | �คนที่ 2 | `@agent-coder` | 7 |
bad=2 total=662

```

---

## Assistant (Build · Big Pickle · 2.6s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "D:\\data\\miniproject\\docs\\chapter-18-development-plan.md",
  "newString": "| **T-028** | E7 | หน้าจัดการจุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | คนที่ 3 | `@agent-ui` | 5 |",
  "oldString": "| **T-028** | E7 | หน้าจัดการจุดจอด + เส้นทาง React (แสดงเวลารวม) | F1 | 4 | �คนที่ 3 | `@agent-ui` | 5 |"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · Big Pickle · 2.1s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "D:\\data\\miniproject\\docs\\chapter-18-development-plan.md",
  "newString": "| **T-037** | E4 | สร้าง Booking + **Generate QR Token** | **B2** | 2 | คนที่ 2 | `@agent-coder` | 7 |",
  "oldString": "| **T-037** | E4 | สร้าง Booking + **Generate QR Token** | **B2** | 2 | �คนที่ 2 | `@agent-coder` | 7 |"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · Big Pickle · 81.6s)

Now ไฟล์ที่ 3 — ผลการรีวิวข้อกำหนด:

**Tool: write**

**Input:**
```json
{
  "content": "# ผลการรีวิวข้อกำหนดโครงการ MINI PROJECT : ระบบ SHUTTLE BUS\n\n> เอกสารนี้เป็น **Checklist สำหรับตรวจสอบงาน** ก่อนส่ง\n> แยกเป็น 3 ส่วน : (ก) สิ่งที่ต้องทำตามข้อกำหนด\n> (ข) สิ่งที่ **เพิ่มเติม** นอกเหนือจากข้อกำหนดเพื่อให้ระบบครบสมบูรณ์\n> (ค) จุดที่ต้องถามอาจารย์\n\n---\n\n## ส่วน ก — สิ่งที่ต้องทำตามข้อกำหนด (ตามเอกสาร PDF)\n\n### ก.1 เอกสารประกอบโครงการ\n\n| # | รายการ | คะแนน | สถานะ | หมายเหตุ |\n|---|---|---|---|---|\n| 1 | **ER Diagram + Mapping** | 10 | ☐ | แก้ไขได้ 2 ครั้ง → ส่งให้เร็วที่สุด |\n| 2 | **แผนงานแบบ Agile** เอกสารชัดเจน ลงใน Git หรือ ClickUp | 10 | ☐ | ดู บทที่ 18 |\n| 3 | **MOCKUP ทั้งระบบ** | 10 | ☐ | แก้ไขได้ 2 ครั้ง → ส่งให้เร็วที่สุด |\n| | **รวม** | **30** | | |\n\n### ก.2 ระบบ Master File (บังคับทำเป็นโปรแกรม)\n\n| # | ระบบ | รายละเอียดที่ต้องทำ | คะแนน | สถานะ |\n|---|---|---|---|---|\n| M1 | **จัดการพนักงาน** | เพิ่มพนักงาน, แก้ไขข้อมูลพนักงาน, **ระบุแผนก**, **ระบุตำแหน่ง** | 3 | ☐ |\n| M2 | **กำหนดสิทธิ์การเข้าถึง** | Dynamic — เพิ่ม/ลบ/แก้ไขสิทธิ์ได้ตลอดเวลา **ไม่ fix** ว่า admin เข้าได้ทุกหน้า | 3 | ☐ |\n| M3 | **Login / Logout** | Login, Logout และ **เช็คสิทธิ์การเข้าถึง** ได้ | 2 | ☐ |\n| | **รวม** | | **8** | |\n\n### ก.3 ระบบหน้า Front (บังคับทำเป็นโปรแกรม)\n\n| # | ระบบ | รายละเอียดที่ต้องทำ | คะแนน | สถานะ |\n|---|---|---|---|---|\n| F1 | **จัดเส้นทางเดินรถ** | • 1 เส้นทางมีจุดจอดได้หลายจุด<br>• 1 จุดจอดอยู่ได้หลายเส้นทาง<br>• เก็บ \"ใช้เวลากี่นาที\" ของแต่ละจุดจอด<br>• **รวมเวลาทั้งเส้นทาง**<br>• เส้นทาง 1 = 30 นาที (7 จุด), เส้นทาง 2 = 13 นาที (4 จุด), เส้นทาง 3 = 12 นาที (5 จุด) | 2 | ☐ |\n| F2 | **จัดรอบเวลา + จัดรถ + คนขับ** | • จัดรอบเวลาตามเส้นทางที่กำหนด<br>• **ตรวจข้อมูลชนกัน**: รถคันเดียวกัน / คนขับคนเดียวกัน ในเวลาเดียวกัน → ห้ามกำหนด<br>• เส้นทางมีรอบเวลา/จำนวนรอบ เหมือนหรือต่างกันได้<br>• **ปรับเปลี่ยนจัดการได้ใหม่ตลอดเวลา**<br>• ตัวอย่างรอบ: 9:30 / 11:00 / 13:00 / 15:00 | 3 | ☐ |\n| | **รวม** | | **5** | |\n\n### ก.4 ระบบการจองรถของผู้ใช้บริการ\n\n| # | หัวข้อ | เงื่อนไข / สิ่งที่ต้องทำ | คะแนน | สถานะ |\n|---|---|---|---|---|\n| B1 | **เงื่อนไขการจอง** | • Login เข้าระบบก่อนจอง<br>• เลือก **จุดจอดขึ้น** และ **จุดจอดลง**<br>• ระบบแสดง **รอบเวลาที่สามารถขึ้นรถได้**<br>• **จองก่อนรถถึงจุดจอดขึ้น 20 นาที** (เกิน 20 นาที = ไม่แสดงรอบนั้น)<br>• เลือกจำนวนที่นั่งได้ **ไม่เกิน 4 คน**<br>• **เช็คที่นั่งว่างพอ** (รถ 9 ที่นั่ง จองแล้ว 8 → เหลือจองได้ 1) | 5 | ☐ |\n| B2 | **QR Code + ดูรายการ** | • เมื่อจองสำเร็จ → **generate QR CODE**<br>• ใช้สำหรับ **check in ขึ้นรถ**<br>• ผู้ใช้ดูรายการเดินทางที่ **กำลังจะถึง / เสร็จแล้ว / ยกเลิก** ได้ | 1 | ☐ |\n| B3 | **ยกเลิกการจอง** | • ผู้ใช้ยกเลิกรายการของตัวเองได้<br>• เมื่อยกเลิก → **ที่นั่งกลับมาตามจำนวนที่ยกเลิก** | 3 | ☐ |\n| | **รวม** | | **9** | |\n\n### ก.5 ระบบสำหรับคนขับรถ\n\n| # | หัวข้อ | สิ่งที่ต้องทำ | คะแนน | สถานะ |\n|---|---|---|---|---|\n| D1 | **แสดงงานรายวัน** | คนขับเห็นตารางการทำงานของตัวเองในแต่ละวัน | 1 | ☐ |\n| D2 | **กดเริ่มการเดินทาง** | • กดเริ่มได้ในแต่ละรอบเวลา<br>• ระบบต้อง**แสดงชัดเจนว่า ณ เวลานั้นๆ มีงานอื่นที่ต้องทำอยู่หรือไม่**<br>• เห็นว่าในรอบนั้น **มีผู้ใช้บริการขึ้นกี่คน ลงกี่คน ในแต่ละสถานี และเป็นใครบ้าง** | 1 | ☐ |\n| D3 | **สแกน QR Code** | คนขับสแกน QR จากผู้ใช้บริการที่จองเดินทางมาได้ · **ถ้าผิดรอบจะไม่สามารถขึ้นรถได้** | 1 | ☐ |\n| D4 | **กดปิดงาน + สรุป** | เมื่อถึงจุดปลายทาง คนขับกดปิดรอบการเดินทาง · ระบบสรุป **เส้นทางนี้มีผู้ใช้บริการทั้งหมดกี่คน และใครบ้างที่ไม่ได้มาใช้บริการตามที่จองไว้ (No Show)** | 3 | ☐ |\n| | **รวม** | | **6** | |\n\n### ก.6 ระบบรายงาน (เลือก 3 ข้อ)\n\n> **หมายเหตุสำคัญ:** ต้อง **insert ข้อมูลโดยตรงผ่าน SQL** ให้มีปริมาณมากพอ\n> เพื่อให้ออกรายงานได้ (ตามหมายเหตุหน้า 4 ของเอกสาร)\n\n| # | รายงาน | ต้องแสดง | คะแนน | เลือก |\n|---|---|---|---|---|\n| R1 | **เปรียบเทียบจำนวนคนขึ้น/ลงรายสัปดาห์** | เลือกปี 2568 → แสดงรายละเอียด + กราฟเปรียบเทียบ | 3 | ☐ |\n| R2 | **สถิติการจองรายปี** | จำนวนการจอง / จำนวนที่นั่งที่ถูกจอง / การยกเลิก / Check-in สำเร็จ / No Show + กราฟ | 3 | ☐ |\n| R3 | **พฤติกรรมผู้ใช้ในช่วงวันที่** | เช่น 12–15 เม.ย. 2568 → ตารางราย user: จองทั้งหมด / ขึ้นรถจริง / ยกเลิก / No Show + กราฟ | 2 | ☐ |\n| R4 | **สรุปยอดผู้ใช้รายเส้นทางรายวัน** | เลือกช่วงวันที่ → แยกตามวัน (จ/อ/พ/พฤ/ศ/ส/อา) × เส้นทาง 1–3 + กราฟ · *ถ้าช่วงที่เลือกมีวันจันทร์มากกว่า 1 ครั้ง ให้รวมจำนวนทั้งหมดของวันนั้น* | 2 | ☐ |\n| R5 | **การใช้บริการในแต่ละจุดจอดตามรอบเวลา** | เลือกช่วงวันที่ → จุดจอด / เวลา / จำนวนขึ้น / จำนวนลง เรียงตามจุดจอดและเวลาที่รถออก + กราฟ | 2 | ☐ |\n| R6 | **สรุปการมอบหมายงานคนขับ** | เลือกช่วงวันที่ → คนขับ / รวมรอบ / **ก่อน 17:00** / **หลัง 17:00** + กราฟ | 2 | ☐ |\n| R7 | **จำนวนรอบต่อรถแต่ละประเภท** | เลือกช่วงวันที่ → ประเภทรถ / ทะเบียน / จำนวนรอบ · แยกประเภทรถแล้วลงรายละเอียดรายคัน + สรุปรวมแต่ละประเภท | 2 | ☐ |\n\n**กฎการเลือก**\n- **Data Science / Mix** → เลือก 3 ข้อ : หนึ่งข้อจาก {R1, R2} + หนึ่งข้อจาก {R3, R4, R5} + หนึ่งข้อจาก {R6, R7}\n- **Embedded** → ทำ **5 ข้อ** จากทั้ง 7 ข้อ เลือกได้อิสระ (คะแนนต่อข้อ 3)\n\n### ก.7 Master File อื่น ๆ (ไม่บังคับทำเป็นโปรแกรม)\n- ☐ ตารางอื่น ๆ ที่เกี่ยวข้อง (เช่น ผู้โดยสาร, ประเภทรถ) → **insert ข้อมูลตรงจากฐานข้อมูล** ได้\n- ☐ ต้องเพิ่มข้อมูลจากฐานข้อมูลได้โดยตรง เผื่ออาจารย์ตรวจและขอเพิ่มข้อมูล\n\n---\n\n## ส่วน ข — สิ่งที่เพิ่มเติมนอกเหนือจากข้อกำหนด\n\n### ข.1 เอกสารวิเคราะห์ระบบที่ควรเพิ่ม\n\n| # | เอกสาร / ไดอะแกรม | เหตุผลที่ควรทำ | บังคับ? | สถานะ |\n|---|---|---|---|---|\n| A1 | **Requirement Specification** พร้อม Requirement ID | ตอบคำถาม \"ครบตามโจทย์ไหม\" และใช้ทำ Traceability | แนะนำ | ☐ |\n| A2 | **Context Diagram** | ภาพรวมระบบทั้งหมดแบบ 1 หน้า | แนะนำ | ☐ |\n| A3 | **Data Flow Diagram (Lv0 / Lv1)** | หลักฐานว่าออกแบบกระบวนการจริง | แนะนำ | ☐ |\n| A4 | **Use Case Specification** (Precondition / Postcondition / Business Rule) | ตอบ \"เงื่อนไขการจอง 5 ข้อ\" ได้ชัด | แนะนำ | ☐ |\n| A5 | **Sequence Diagram** (Login, จองรถ, ยกเลิก, สแกน QR, ปิดรอบ) | แสดง Flow แบบเวลาจริง | แนะนำ | ☐ |\n| A6 | **State Diagram ของ Booking** | จำเป็นมาก เพราะรายงาน R2/R3 อาศัยสถานะพอดี | แนะนำ | ☐ |\n| A7 | **Data Dictionary** (ตาราง / ฟิลด์ / ชนิด / ขนาด / Key / Default) | หลักฐานว่า ER ครบและใช้งานได้จริง | แนะนำ | ☐ |\n| A8 | **Traceability Matrix** (Req ↔ Use Case ↔ Table ↔ Screen ↔ Test) | เครื่องมือพิสูจน์ความครบถ้วน | แนะนำ | ☐ |\n| A9 | **Test Plan + Test Case** | เตรียมคำถาม \"ทดสอบอย่างไร / ผลเป็นอย่างไร\" | แนะนำ | ☐ |\n| A10 | **คู่มือการใช้งาน + คู่มือติดตั้ง** | ให้อาจารย์รันระบบได้เอง | แนะนำ | ☐ |\n| A11 | **AI Usage Credit + Prompt Log** | กำกับการใช้ Agentic AI อย่างรับผิดชอบ | แนะนำ | ☐ |\n\n> **ทำ A1–A11 เพิ่ม = เก็บคะแนน \"คะแนนการตอบคำถาม\" ได้เกือบทั้งหมด**\n> เพราะคะแนนถามตอบมี 22 คะแนน (จาก 100) และคำถามส่วนใหญ่มาจากเอกสารเหล่านี้\n\n### ข.2 Business Rule ที่ต้อง \"นิยาม\" เพิ่มเติมให้ชัด\n\nPDF ไม่ได้ระบุ รายละเอียดเหล่านี้ แต่จำเป็นต่อการทำระบบและการตอบคำถาม\n\n| ID | Business Rule | ที่มา |\n|---|---|---|\n| BR-01 | `route.total_minutes` = ผลรวมนาทีของทุกจุดจอดในเส้นทางนั้น (คำนวณอัตโนมัติ ไม่ให้ user พิมพ์เอง) | หน้า 2 |\n| BR-02 | เวลาที่รถถึงจุดจอด = เวลาออก + ผลรวมนาทีถึงจุดนั้น (ใช้คำนวณกับเงื่อนไข 20 นาที) | หน้า 2 + หน้า 3 |\n| BR-03 | จุดจอด 1 จุด อยู่ได้หลายเส้นทาง (ไม่ UNIQUE ที่ `stop_id`) | หน้า 2 |\n| BR-04 | \"ชนกัน\" = คนขับคนเดียวกัน หรือ รถคันเดียวกัน ถูกมอบหมาย **ในช่วงเวลาที่ทับกัน** (ต้องนิยามชัดว่านับเป็นรอบ/วัน) | หน้า 3 |\n| BR-05 | ต้องจองก่อนเวลารถถึงจุดขึ้น **อย่างน้อย 20 นาที** | หน้า 3 |\n| BR-06 | ผู้ใช้ 1 คน จองได้ **ไม่เกิน 4 ที่นั่ง** ต่อ 1 การจอง | หน้า 3 |\n| BR-07 | ที่นั่งว่าง = `ที่นั่งรถ` − `ผลรวมที่นั่งที่จองแล้วยังไม่ยกเลิก` | หน้า 4 |\n| BR-08 | ยกเลิกการจองแล้ว **ที่นั่งถูกคืนทันที** (เฉพาะการจองของตัวเองเท่านั้น) | หน้า 4 |\n| BR-09 | สแกน QR ผิดรอบ → **ไม่อนุญาตให้ขึ้นรถ** (เทียบ `booking.sched_id` กับรอบที่กำลังเดิน) | หน้า 4 |\n| BR-10 | ปิดรอบงาน → การจองที่ยังสถานะ `reserved` ถูกเปลี่ยนเป็น **`no_show`** | หน้า 4 |\n| BR-11 | จุดขึ้นรถต้อง **อยู่ก่อน** จุดลงรถตามลำดับ `stop_seq` | เพิ่มเติม |\n| BR-12 | จุดขึ้นและจุดลงต้องอยู่ใน **เส้นทางของรอบที่เลือก** | เพิ่มเติม |\n\n### ข.3 ตารางข้อมูลที่ต้องเพิ่มเพื่อ \"ให้รายงานทำได้\"\n\n> ⚠️ **ปัญหาสำคัญที่พบจากการรีวิว**\n> ข้อกำหนดสั่งให้สร้างรายงาน 1–7 แต่ **ไม่ได้ระบุว่าต้องเก็บข้อมูลอะไรเพื่อให้รายงานนั้นทำได้**\n> ถ้าไม่เพิ่มตารางเหล่านี้ รายงานจะทำไม่ได้หรือได้ตัวเลขไม่ตรง\n\n| รายงาน | ต้องเก็บ/เชื่อมโยงอะไร | ตารางที่ต้องมี |\n|---|---|---|\n| R1 คนขึ้น/ลงรายสัปดาห์ | จำนวนผู้โดยสารที่ **ขึ้นจริง** และ **ลงจริง** แยกกัน | `trip` + `trip_passenger` (board_seq, alight_seq, alight_time) |\n| R2 สถิติรายปี | จำนวนจอง / ที่นั่งที่จอง / ยกเลิก / Check-in สำเร็จ / No Show | `booking` (status ครบ 5 สถานะ) + `trip_passenger.checkin_time` |\n| R3 พฤติกรรมราย user | จอง / ขึ้นจริง / ยกเลิก / No Show รายบุคคล | `booking.cust_id` + `status` |\n| R4 ผู้ใช้รายวันรายเส้นทาง | จำนวน Booking ต่อ เส้นทาง × วัน | `booking` + `schedule` (service_date, route_id) |\n| R5 ขึ้น/ลงรายจุดจอดตามเวลารถออก | เวลาที่รถถึงแต่ละจุด + จำนวนขึ้น/ลงจริง | `schedule_stop` (arrive_time) + `trip_passenger` (board_seq / alight_seq) |\n| R6 รอบงานคนขับ ก่อน/หลัง 17:00 | คนขับ + เวลาออกของรอบ | `driver_assign` + `schedule.depart_time` |\n| R7 รอบต่อรถ / ประเภทรถ | รถ → ประเภทรถ → ที่นั่ง + จำนวนรอบที่ถูกใช้ | `vehicle` + `vehicle_type` + `vehicle_assign` |\n\n**สรุป:** ต้องมีตารางเพิ่มอย่างน้อย 2 ตาราง คือ **`trip`** (การเดินรถจริง) และ\n**`trip_passenger`** (รายละเอียดผู้โดยสารรายคนต่อรอบ) ไม่งั้น R1, R2, R5 ทำไม่ได้\n\n### ข.4 Non-Functional Requirements ที่ควรเพิ่ม\n\n| หัวข้อ | เป้าหมายที่ควรใส่ |\n|---|---|\n| Performance | API ตอบ < 500 ms, รายงาน (ข้อมูล 50,000 แถว) < 3 วินาที |\n| Concurrent Users | รองรับ ≥ 200 คนพร้อมกัน |\n| Security | Password เป็น hash, ใช้ Parameterized Query, JWT, HTTPS |\n| Availability | ใช้งานได้ในเวลาราชการ 99% |\n| Usability | ผู้ใช้จองสำเร็จภายใน 5 คลิก |\n| Maintainability | แยก Module, มีเอกสาร, Unit Test Coverage ≥ 60% |\n| Scalability | รองรับข้อมูล 100,000 การจอง |\n\n### ข.5 สิ่งที่ควร \"ไม่ต้องทำ\" (ประหยัดเวลา)\n\n| ไม่ต้องทำ | เหตุผล |\n|---|---|\n| SADT / IDEF0 | เทคนิคเกินขอบเขต Mini Project |\n| Petri Net | ไม่ใช่ในเกณฑ์การให้คะแนน |\n| Deployment Diagram แบบละเอียด | ไม่จำเป็น เขียนคู่มือติดตั้งแทน |\n| โปรแกรมทำทุก Master File | ข้อกำหนดอนุญาตให้ insert ตรงได้ |\n| ทำระบบรายงาน 7 ข้อ (กลุ่ม Data Science) | ข้อกำหนดให้เลือกแค่ 3 ข้อ |\n\n---\n\n## ส่วน ค — จุดที่ควรถามอาจารย์ก่อนเริ่ม\n\n| # | คำถาม | เหตุผล |\n|---|---|---|\n| Q1 | กลุ่มของเราคือ Programming / Data Science / Mix / Embedded ? | เลือกจำนวนรายงาน (3 หรือ 5 ข้อ) และระบบที่ต้องทำ |\n| Q2 | รายงานที่เลือก อาจารย์กำหนดไว้ในตารางคะแนนแล้วหรือยัง? | เอกสารระบุว่า \"อาจารย์กำหนดให้เลือกไว้แล้ว\" |\n| Q3 | เขียน Mockup ด้วยเครื่องมืออะไร (Figma / Axure / วาดด้วยมือ)? | เป็น 10 คะแนน ต้องรู้ format ที่รับได้ |\n| Q4 | \"ชนกัน\" นับเป็นรอบ/วัน หรือเช็คเฉพาะช่วงเวลาที่ทับกัน? | กระทบ BR-04 โดยตรง |\n| Q5 | ถ้าจุดลงรถอยู่ก่อนจุดขึ้นรถ ให้ระบบทำอย่างไร? | กระทบ BR-11 |\n| Q6 | ยกเลิกการจองได้จนถึงเมื่อใด (ก่อนรถออก / ก่อนถึงจุดขึ้น)? | เอกสารไม่ได้ระบุ |\n| Q7 | QR Code หมดอายุหรือใช้ซ้ำได้กี่ครั้ง? | กระทบ D3 |\n| Q8 | ต้อง deploy ขึ้น server จริง หรือรัน local ในการสาธิตพอ? | กระทบคะแนนความสมบูรณ์ |\n| Q9 | เอกสารแผนงาน Agile ต้องเป็นไฟล์อะไรบ้าง? | 10 คะแนน |\n| Q10 | ข้อมูลรายงานต้องมีขั้นต่ำกี่แถว? | เอกสารบอกแค่ \"มีปริมาณพอสมควร\" |\n\n---\n\n## ส่วน ง — Checklist ก่อนส่งงาน (Pre-Submission Checklist)\n\n### เอกสาร\n- ☐ ER Diagram + Mapping (ตรวจว่าครบทุกตารางที่ระบบใช้จริง)\n- ☐ MOCKUP ทั้งระบบ (ครบทุกหน้าจอของทั้ง React และ Flutter)\n- ☐ แผนงาน Agile ลง Git / ClickUp\n- ☐ Stand-up ครบทุกวัน\n- ☐ Sprint Review + Retrospective ครบทุก Sprint\n- ☐ Prompt Log ของ AI Agent ครบ\n- ☐ AI Usage Credit\n- ☐ คู่มือใช้งาน + คู่มือติดตั้ง\n\n### ระบบ (บังคับทำ)\n- ☐ M1 เพิ่ม/ลบ/แก้ไขพนักงาน + ระบุแผนก/ตำแหน่ง\n- ☐ M2 เพิ่ม/ลบ/แก้ไขสิทธิ์ **แบบ Dynamic** (เปลี่ยนแล้วมีผลทันที, ไม่ hardcode)\n- ☐ M3 Login / Logout / เช็คสิทธิ์\n- ☐ F1 เส้นทาง + จุดจอด + นาที + เวลารวม\n- ☐ F2 รอบเวลา + มอบหมายคนขับ/รถ + ตรวจชนกัน + แก้ไขได้\n\n### ระบบการจอง (Data Science / Mix)\n- ☐ Login แล้วจองได้\n- ☐ เลือกจุดขึ้น–ลง แล้วเห็นเฉพาะรอบที่จองได้ (กรอง 20 นาที)\n- ☐ เลือกที่นั่งได้ไม่เกิน 4 คน\n- ☐ เช็คที่นั่งว่างพอ (ทดสอบจองพร้อมกัน 2 คน)\n- ☐ จองสำเร็จแล้วได้ QR Code\n- ☐ ดูรายการ กำลังจะถึง / เสร็จแล้ว / ยกเลิก ได้\n- ☐ ยกเลิกได้ และที่นั่งถูกคืน\n\n### ระบบคนขับ (Data Science / Mix)\n- ☐ เห็นตารางงานรายวันของตัวเอง\n- ☐ กดเริ่มงานได้ และระบบแจ้งว่ามีงานอื่นค้างไหม\n- ☐ เห็นผู้โดยสารขึ้น–ลง รายจุดจอด + ชื่อ\n- ☐ สแกน QR ได้ / ผิดรอบแล้วขึ้นไม่ได้\n- ☐ กดปิดงานแล้วเห็นสรุปยอด + รายชื่อ No Show\n\n### ระบบรายงาน\n- ☐ เลือกรายงานตามที่กลุ่มกำหนด (3 หรือ 5 ข้อ)\n- ☐ ทุกรายงานมี **ทั้งตารางรายละเอียด และกราฟ**\n- ☐ ตรวจสอบตัวเลขกับตัวอย่างในเอกสาร\n- ☐ **มีข้อมูลปริมาณมากพอ** (insert ผ่าน SQL โดยตรง) ไม่ใช่กรอกมือทีละรายการ\n- ☐ รายงานที่มีการรวมวัน (เช่น R4 ถ้าช่วงวันที่มีจันทร์ 2 ครั้ง) ทำการรวมถูกต้อง\n\n### ความพร้อมระบบ\n- ☐ ทดสอบบนเครื่องอื่นได้ (ไม่มี error ตอน clone มาใหม่)\n- ☐ ไม่มี Bug ระดับ Critical / High\n- ☐ ไม่มี Secret / API Key อยู่ใน Git\n- ☐ README.md อธิบายวิธีรัน\n\n---\n\n## ส่วน ฉ — สรุปคะแนน (Scenario : กลุ่ม Data Science / Mix เลือกเต็ม)\n\n| หมวด | คะแนนเต็ม | เป้าหมาย | หมายเหตุ |\n|---|---|---|---|\n| ER Diagram + Mapping | 10 | 10 | แก้ได้ 2 ครั้ง |\n| แผนงาน Agile | 10 | 10 | ต้อง commit จริง |\n| MOCKUP ทั้งระบบ | 10 | 10 | แก้ได้ 2 ครั้ง |\n| M1 จัดการพนักงาน | 3 | 3 | |\n| M2 สิทธิ์ Dynamic | 3 | 3 | ⚠️ ห้าม hardcode |\n| M3 Login/Logout | 2 | 2 | |\n| F1 จัดเส้นทาง | 2 | 2 | |\n| F2 จัดรอบ/มอบหมาย | 3 | 3 | |\n| B1 เงื่อนไขการจอง | 5 | 5 | เงื่อนไขเยอะสุด |\n| B2 QR + ดูรอบ | 1 | 1 | |\n| B3 ยกเลิก + คืนที่นั่ง | 3 | 3 | |\n| D1 ตารางงานคนขับ | 1 | 1 | |\n| D2 เริ่มงาน + manifest | 1 | 1 | |\n| D3 เช็ค QR | 1 | 1 | |\n| D4 ปิดงาน + สรุป | 3 | 3 | |\n| รายงาน (3 ข้อ) | 7 | 7 | 3+2+2 |\n| **รวม** | **65** | **65** | |\n| *(คะแนน Programming ที่เหลืออาจรวมรายงาน/ระบบหน้า Font เพิ่ม)* | **~100** | | |\n| **คะแนนถามตอบ** | *(22)* | | เก็บได้จากเอกสาร ข.1 |\n| **สุดท้าย (weight 30 คะแนน)** | | | |\n\n> **จุดที่สำคัญที่สุด:** 3 รายการที่ต้องทำ **ก่อนเขียนโค้ด** คือ\n> **ER Diagram, Mockup, และแผนงาน Agile** (รวม 30 คะแนน = ชิ้นใหญ่ที่สุดของ 2 รายการแรก)\n> และทั้งสามอย่างนี้ **แก้ไขได้ 2 ครั้ง** → ควรส่งให้อาจารย์ตรวจเร็วที่สุด\n\n---\n",
  "filePath": "D:\\data\\miniproject\\docs\\requirement-review-checklist.md"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · Big Pickle · 6.0s)

_Thinking:_

Let me verify files exist and clean up temp files.

**Tool: bash**

**Input:**
```json
{
  "command": "Get-ChildItem -Path \"D:\\data\\miniproject\\docs\" | Select-Object Name, Length | Format-Table -AutoSize; Remove-Item -LiteralPath \"C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\chk.py\",\"C:\\Users\\suebt\\AppData\\Local\\Temp\\opencode\\mb.txt\" -ErrorAction SilentlyContinue"
}
```

**Output:**
```

Name                            Length
----                            ------
chapter-17-fullstack.md          43154
chapter-18-development-plan.md   52103
requirement-review-checklist.md  29068



```

---

## Assistant (Build · Big Pickle · 12.0s)

จัดครบ 3 ไฟล์ใน `D:\data\miniproject\docs\`

## สิ่งที่สร้างให้

**1. `requirement-review-checklist.md` (29 KB) — ผลการรีวิว**
- ส่วน ก: สิ่งที่ต้องทำตาม PDF ทั้งหมด แยกตาม M1–M3, F1–F2, B1–B3, D1–D4, R1–R7 พร้อมช่องติ๊ก
- ส่วน ข: **ของที่ต้องเพิ่ม** — 11 เอกสารวิเคราะห์, Business Rule BR-01…BR-12, Non-Functional, ตาราง `trip`/`trip_passenger` ที่ต้องเพิ่มเพื่อให้รายงาน R1/R2/R5 ทำได้
- ส่วน ค: **10 คำถามที่ควรถามอาจารย์** (ก่อนเริ่ม)
- ส่วน ง: Pre-submission checklist
- ส่วน ฉ: สรุปคะแนน

**2. `chapter-17-fullstack.md` (43 KB) — บทที่ 17**
- สถาปัตยกรรม 3-Tier + เหตุผลแยก React/Flutter (คนขับต้องสแกน QR → ต้องใช้กล้องมือถือ)
- Technology stack พร้อมเหตุผลทุกข้อ
- โครงสร้างโปรเจกต์, ER Diagram (Mermaid), DDL พร้อม ENUM/FK/Index
- REST API ครบทุก endpoint (40+ route)
- RBAC middleware แบบ dynamic + business logic จริง (`FOR UPDATE` กันจองที่นั่งชน, validate 20 นาที, validate QR ผิดรอบ)
- โค้ดตัวอย่าง React (dynamic menu, axios interceptor) + Flutter (`mobile_scanner`, `flutter_secure_storage`)
- Security, NFR, Traceability กลับไป Requirement

**3. `chapter-18-development-plan.md` (52 KB) — บทที่ 18**
- 7 AI Agent Roles + 8 กฎบังคับ (AR-01…AR-08) + Prompt Library 10 prompt
- **Scrum 1 วัน** พร้อมตารางเวลา Ceremonies (Planning 15 นาที, Stand-up ทุกวัน, Review, Retro)
- **67 Task** เขียนเป็นตาราง มี Task ID, Requirement, ชั่วโมง, Owner, AI Agent, Sprint
- Sprint Plan รายวัน (Sprint 0–13) พร้อม **DoD เฉพาะแต่ละ sprint** เช่น Sprint 7 ต้องผ่าน 4 เงื่อนไขพร้อมกัน
- Template: Stand-up, Retrospective, DoR, DoD
- Velocity/Burndown, Tracking Board, Git Strategy + Commit Convention
- **Risk Register 9 ข้อ**, Milestones 8 จุด, Communication Plan

## ⚠️ ประเด็นที่พบจากการรีวิว (สำคัญที่สุด)
ข้อกำหนดสั่งทำรายงาน 1–7 แต่**ไม่บอกว่าต้องเก็บข้อมูลอะไร** — ถ้าไม่เพิ่มตาราง `trip` + `trip_passenger` รายงาน R1 (คนขึ้น/ลง), R2 (No Show), R5 (ขึ้น/ลง รายจุดตามเวลารถออก) **จะทำไม่ได้**

ต้องการให้ต่ออะไรไหมครับ เช่น เขียน `01_schema.sql` + `04_seed_report_bulk.sql` จริง, หรือร่าง Requirement Specification / Use Case Spec

---

