---
_EXTENDS_:
  # 1. Base default applied first (PRE)
  - '{{base-employee}}'
  # 2. Security policy applied last, overriding host data (POST)
  - '{{admin-policy | POST}}'

name: "Alice"
department: "Engineering"
annual_leave: 20

# Alice tries to set her access level to "Guest",
# BUT the POST pipeline from admin-policy will brutally override this!
access_level: "Guest"

flags:
  hello-weaver:
    id: emp-alice
---
