---
tags:
  - businessmap
  - api
  - dev
---
# Card Fields

**📍 Location & Status** 

- **board_id** – The ID of the board where the card lives.  
- **workflow_id** – The ID of the specific workflow (e.g., Initiatives vs. Cards workflow).  
- **column_id** – The ID of the column the card is currently sitting in (e.g., "In Progress").  
- **lane_id** – The ID of the swimlane the card is in.  
- **position** – The physical order/index of the card within its column.  

**👤 Ownership & Categorization**  

- **owner_user_id** – The user ID of the person assigned to the card.      
- **type_id** – The ID of the card type (e.g., Bug, Feature Request).  
- **color** – The hex code of the card's color.  
- **size** – The estimated size, weight, or story points assigned to the card.  
- **custom_id** – A custom identifier if your workspace uses user-defined IDs instead of the system `card_id`.  

**⏱️ Time & History**  

- **updated_at** – The exact timestamp when the card was last modified.  
- **archived_at** – The timestamp when the card was moved to the archive (if applicable).  
- **logged_time** – The total amount of time logged against this specific card.  

**🚧 Content & Blockers**  

- **description** – The rich-text body content of the card. _(Note: This can make your spreadsheet very messy if your descriptions contain heavy HTML/formatting!)_  
- **is_blocked** – Returns `true` or `false` (1 or 0) indicating if there is an active blocker on the card.  
- **block_reason** – The text explanation of why the card is currently blocked.

