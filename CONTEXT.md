# Shared Grocery List

Help cohabiting couples and multi-adult households coordinate who buys what across time and location, without needing to be online at the same time — so when one person is already at the store, the other can add items and the shopper sees them instantly without duplicate buys or missed items.

## Language

**List**:
The shareable grocery list — the primary thing people collaborate on. Not tied to accounts or formal groups.
_Avoid_: Board, Group list

**Share link**:
A secret URL that grants access to a List. Whoever has the link can open and edit it — no login required for MVP.
_Avoid_: Invite, Invite code

**Editor**:
A person accessing a List via a share link. On first visit, prompted for an optional nickname stored locally on their device; defaults to "Someone" if skipped. No account required.
_Avoid_: User, Member, Contributor

**Creator**:
The Editor whose device holds the creator token — the only person who can rotate or revoke the share link. Assigned automatically when the List is first created.
_Avoid_: Owner, Admin

**Item**:
A single thing to buy on a List. Has a name (required) and an optional quantity (e.g. "milk", "milk × 2"). Nothing else in MVP — no notes, categories, or brand preferences.
_Avoid_: Product, Line item, Need

**List layout**:
Items appear in a flat, manually ordered list. Editors can drag to reorder. Auto-categorization by aisle is out of scope for MVP.
_Avoid_: Section, Aisle group, Category

**Checked item**:
An Item that has been marked as bought. Moves out of the active (unchecked) list into a separate checked list. Can be moved back to unchecked. UX details deferred.
_Avoid_: Done, Purchased, Completed

**Active item**:
An Item still to be bought — the unchecked list.
_Avoid_: Pending, Open, Todo

**Local registry**:
A collection of metadata (share link, list name, roles) stored in the Editor's device `localStorage` to allow managing and switching between multiple lists without a user account.
_Avoid_: User database, accounts index

**List dashboard**:
The dynamic home screen displayed at the root path `/` for returning Editors who have one or more lists in their Local registry, allowing them to switch between lists or create new ones.
_Avoid_: User dashboard, home profile

