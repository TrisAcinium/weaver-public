---
name: "Alice"
role: "Architect"

# [Showcase 1] Cross-file reference: Fetching data from the company file
company_name: "{{company-info.name}}"

# [Showcase 2] Self-reference: Combining local and cross-file variables
title: "Lead {{self.role}} at {{self.company_name}}"

# [Showcase 3] Body injection: Weaver injects the markdown body into _BODY_
profile_content: _BODY_

flags:
  hello-weaver:
    id: alice-profile
---
Hello, I am **{{self.name}}**!

My current title is: {{self.title}}.
Our core value is "{{company-info.core_value}}". We are hiring!
