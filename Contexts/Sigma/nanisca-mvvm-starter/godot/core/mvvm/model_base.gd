## Marker base class for Model layer types.
##
## Models hold game data and pure business rules. They:
##   - extend RefCounted (never Node)
##   - never touch the scene tree
##   - never read Input, Time, or randf() — accept injected Clock / Rng
##   - declare their own signals if they need to notify ViewModels of changes
##
## Why a marker class:
##   - Lets us add lifecycle hooks later without changing every Model.
##   - Code review can grep `extends ModelBase` to find Model layer types.
class_name ModelBase extends RefCounted
