---
_EXTENDS_:
  - '{{base-employee}}'
  - '{{admin-policy | POST}}'

name: "Alice"
role: "Engineer"
# Trying to bypass security, but POST policy should override this
access_level: "Guest"

# Reactive cross-reference and pipeline test
welcome_msg: "Welcome to {{self.company}}, {{self.name}}! Your privileges: {{self.privileges | JOIN ', '}}"

flags:
  weaver-core:
    id: emp-alice
---