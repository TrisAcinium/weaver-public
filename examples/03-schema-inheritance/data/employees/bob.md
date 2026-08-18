---
_EXTENDS_:
  # Normal inheritance (PRE by default): Base attributes are applied first.
  - '{{base-employee}}'

name: "Bob"
# Bob overrides the base department "General" with his own "Marketing"
department: "Marketing"

flags:
  hello-weaver:
    id: emp-bob
---
