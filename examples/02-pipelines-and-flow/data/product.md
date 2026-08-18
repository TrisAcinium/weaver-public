---
name: "Pro Gaming Laptop"
category: "electronics"
tags:
  - "Gaming"
  - "High-Performance"
  - "New Arrival"

# [Showcase 1] Property extraction and basic string transformation
upper_name: "{{self.name}}"

# [Showcase 2] Array Pipeline: Join array items into a clean string
tags_summary: "{{self.tags | JOIN ' | '}}"

# [Showcase 3] Cross-file reference combined with pipeline
store_welcome: "{{store-config.welcome_message}}"

flags:
  hello-weaver:
    id: laptop-product
---
## {{self.upper_name}}

* **Store Notice**: {{self.store_welcome}}
* **Tags**: {{self.tags_summary}}
