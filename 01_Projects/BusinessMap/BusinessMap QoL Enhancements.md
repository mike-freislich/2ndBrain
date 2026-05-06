---
tags:
  - businessmap
---
# Features and quirks
- **AI CANVAS**
    - [**FEATURE**] collaborator cursors - would enable collaborative planning in AI Canvas — at the moment, I have to bounce out of businessmap into Miro to have collaborative team meetings about the work, and then I lose out on all the cool AI Canvas functionality.
    - [**FEATURE**] more functional drop down on right click - similar to card operations on boards
        - this would enable using the canvas in favor of the board
    - [**BUG**] link lines often connect to a point in space, requiring a full zoom out and back in, in order to connect correctly
    - [**OPINION**] Predecessor links should draw from left of card, and successor links to the right of cards. This would feel more natural in a world where “Done” happens on the right of the board. This would also make visualization clearer, with fewer lines crossing over cards.

- **CARDS ON BOARDS**
    - [**BUG**] When editing text inside card descriptions, bullets often get confused, making quick note taking painful.
    
    - **[FEATURE]** Use a stable markdown editor inside cards. Markdown would also of course be useful in the age of AI.
    

- **[FEATURE]** Editing concurrency — It would be helpful to allow two people to edit card details concurrently with realtime feedback
    - Currently, multiple people in one card, last commit wins
- **[FEATURE]** Would be helpful to be able search and provide a link to another card when editing text in comments and card descriptions. Again, markdown editor would be useful here.
- **[FEATURE/VISUALISATION]** Link Swatches on cards - Relatives should have the “right arrow” on them, to visually distinguish from child cards.

- **BOARDS**
    
    - Card Links - easier link removal
        - Currently a linked card can be removed by right clicking on the colored swatch
        - **[CHANGE]** right click on linked cards by row -> delete a link
        - **[FEATURE]** change relationship, e.g. right click to change an existing relationship e.g. from Parent to Child. — currently the only way to do this is to delete the relationship, and recreate it; painful :)
    
    - **[FEATURE]** Workflow Design - per cell queue vs. active
        - currently it’s not possible to have different states in one column across swim lanes.
        - What I am wanting to do is have a Column with an active row and an idle row.
    - **[**CHANGE**]** drag-based card linking within current workflow - currently a card cannot be linked to another card in the same workflow using drag and drop.
    - **[**CHANGE**]** Limitations on number of cards able to drag at one time
    
    - we move done cards at the end of a 2 week cycle into ready for archive. Usually this is around 150 cards. I think the max number of cards moveable in one drag operation is 50.
    
    - **[**CHANGE**]** There seems to be a limitation on how many cards in ready to archive. Ideally there should be no limits.

- **GITHUB PLUGIN**

- **[FEATURE]** doesn’t allow more than one base repo per board - when devs are working across multiple repos, we can only automate against a single repo.
- **[CHANGE]** Unable to create-branch if title is longer than 100chars
