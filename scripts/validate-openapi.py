import yaml, sys, re, json, pathlib

p = pathlib.Path("docs/api/openapi.yaml")
doc = yaml.safe_load(p.read_text(encoding="utf-8"))
errs, warns = [], []

# 1. basic shape
for k in ("openapi", "info", "paths", "components"):
    if k not in doc:
        errs.append(f"missing top-level key: {k}")
if not doc.get("openapi", "").startswith("3."):
    errs.append(f"bad openapi version: {doc.get('openapi')}")

# 2. resolve all local $ref
def resolve(ref):
    node = doc
    for part in ref.lstrip("#/").split("/"):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node

refs = re.findall(r"\$ref:\s*['\"]?(#[^'\"\s]+)", p.read_text(encoding="utf-8"))
for r in set(refs):
    if resolve(r) is None:
        errs.append(f"unresolved $ref: {r}")

# 3. walk paths -> collect endpoints
METHODS = ("get", "post", "put", "patch", "delete")
eps = []
for path, item in doc.get("paths", {}).items():
    shared = [k for k in item if k.startswith("x-") or k == "parameters"]
    for m in METHODS:
        if m not in item:
            continue
        op = item[m]
        eps.append((path, m, op))
        if "operationId" not in op:
            errs.append(f"{m.upper()} {path}: no operationId")
        if "responses" not in op:
            errs.append(f"{m.upper()} {path}: no responses")
        for code in op.get("responses", {}):
            if not re.fullmatch(r"[1-5](\d\d|XX)", str(code)):
                errs.append(f"{m.upper()} {path}: bad status code {code!r}")
        if "summary" not in op:
            warns.append(f"{m.upper()} {path}: no summary")

# 4. every UC-01..UC-30 covered
ucs_covered = set()
for _, _, op in eps:
    tag = op.get("x-uc") or ""
    ucs_covered |= set(re.findall(r"UC-\d\d", tag))
    s = op.get("summary", "") + " " + tag
    ucs_covered |= set(re.findall(r"UC-\d\d", s))
missing_uc = [f"UC-{i:02d}" for i in range(1, 31) if f"UC-{i:02d}" not in ucs_covered]
if missing_uc:
    errs.append("UC not covered by any endpoint: " + ", ".join(missing_uc))

# 5. x-permission values must exist in the real 21 perm_codes
REAL_PERMS = {
    "BK.CREATE","BK.VIEW","BK.CANCEL","QR.SCAN","TRIP.START","TRIP.END",
    "ROUTE.VIEW","ROUTE.EDIT","SCHED.EDIT","VEH.EDIT",
    "EMP.VIEW","EMP.EDIT","DEPT.EDIT","POS.EDIT","ROLE.EDIT",
    "RPT.R1","RPT.R2","RPT.R3","RPT.R5","RPT.R6","RPT.R7",
}
# R4 is a required report (UC-28, PDF 24 หน้า) but the seed skips it.
# Kept as a known gap so the mismatch stays visible instead of being hidden.
KNOWN_MISSING_PERMS = {"RPT.R4"}
used_perms = set()
for _, _, op in eps:
    if "x-permission" in op:
        used_perms |= set(re.findall(r"[A-Z]+\.[A-Z0-9]+", op["x-permission"]))
bad = used_perms - REAL_PERMS - KNOWN_MISSING_PERMS
if bad:
    errs.append(f"x-permission not in real permission table: {sorted(bad)}")
gaps = used_perms & KNOWN_MISSING_PERMS
if gaps:
    warns.append(
        f"{sorted(gaps)} used but ABSENT from permission table (seed gap - "
        f"report module has R1,R2,R3,R5,R6,R7 = 6 of 7). R4 required by UC-28/PDF."
    )

# 6. enum values must match DB CHECK constraints
db = doc["components"]["schemas"]
bs = db["BookingStatus"]["enum"]
if bs != ["reserved","checked_in","completed","cancelled","no_show"]:
    errs.append(f"BookingStatus enum != CK_BOOKING_STATUS: {bs}")
trip_enum = db["Trip"]["properties"]["status"]["enum"]
if trip_enum != ["running","completed"]:
    errs.append(f"Trip.status enum != CK_TRIP_STATUS: {trip_enum}")
if db["SeatMap"]["properties"]["maxSeatsPerBooking"]["example"] != 4:
    errs.append("maxSeatsPerBooking must be 4 (CK_BOOKING_SEATS)")
bc = db["BookingCreate"]["properties"]["seats"]
if bc.get("minimum") != 1 or bc.get("maximum") != 4:
    errs.append(f"BookingCreate.seats must be 1..4, got {bc.get('minimum')}..{bc.get('maximum')}")

# 7. password_hash must never be exposed in a RESPONSE.
#    A plaintext `password` in a request body is legitimate (login, create, change).
def response_schemas(node):
    """yield every schema that appears under a response body"""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "responses" and isinstance(v, dict):
                for code, resp in v.items():
                    if isinstance(resp, dict) and "content" in resp:
                        for mt, body in resp["content"].items():
                            if isinstance(body, dict) and "schema" in body:
                                yield f"responses.{code}.{mt}", body["schema"]
            yield from response_schemas(v)
    elif isinstance(node, list):
        for v in node:
            yield from response_schemas(v)

def prop_names(schema, seen=None):
    """collect every property name reachable through $ref/allOf from a schema"""
    if not isinstance(schema, dict):
        return set()
    if "$ref" in schema:
        target = resolve(schema["$ref"])
        return prop_names(target) if target else set()
    out = set()
    for k, v in schema.items():
        if k == "properties" and isinstance(v, dict):
            out |= set(v.keys())
        out |= prop_names(v)
    return out

leaked = []
for where, schema in response_schemas(doc):
    for pname in prop_names(schema):
        if pname.lower() in ("passwordhash", "password_hash"):
            leaked.append(f"{where} -> {pname}")
if leaked:
    errs.append(f"password hash exposed in a RESPONSE: {leaked}")

req_leak = []
for path_, item in doc.get("paths", {}).items():
    for m in METHODS:
        op = item.get(m) or {}
        rb = op.get("requestBody") or {}
        for mt, body in (rb.get("content") or {}).items():
            for pname in prop_names(body.get("schema") or {}):
                if pname.lower() in ("passwordhash", "password_hash"):
                    req_leak.append(f"{m.upper()} {path_} -> {pname}")
if req_leak:
    errs.append(f"password hash accepted in a REQUEST: {req_leak}")

if "password_hash" in p.read_text(encoding="utf-8"):
    warns.append("password_hash appears in a description (expected - documents that it is never returned)")

# 8. BR coverage
brs = set()
for _, _, op in eps:
    for b in op.get("x-br", []):
        brs.add(b)
expected_br = {"BR-01","BR-02","BR-04","BR-06","BR-07","BR-09","BR-10"}
missing_br = expected_br - brs
if missing_br:
    warns.append("BR without enforcement endpoint: " + ", ".join(sorted(missing_br)))

# report
print(f"endpoints      : {len(eps)}")
print(f"unique paths   : {len(doc['paths'])}")
print(f"UC covered     : {len(ucs_covered)}/30")
print(f"perms used     : {len(used_perms)}/{len(REAL_PERMS)}")
print(f"BR enforced    : {len(brs)} -> {sorted(brs)}")
print(f"$ref checked   : {len(set(refs))}")
print()
for w in warns:
    print("WARN ", w)
for e in errs:
    print("ERROR", e)
print()
print("RESULT:", "FAIL" if errs else "PASS")
sys.exit(1 if errs else 0)
