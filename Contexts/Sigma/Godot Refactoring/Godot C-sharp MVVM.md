
Here's the same MVVM counter in Godot's C# bindings (Godot Mono, 4.x). The structure is identical—Model, ViewModel, View—but you get static typing and a choice between Godot's `[Signal]` mechanism and plain C# `event`s.

## Model — `CounterModel.cs`

Pure C# data and logic, no Godot types at all. It doesn't even need to inherit from a Godot class, which keeps it cleanly testable.

```csharp
// CounterModel.cs
namespace CounterApp;

public class CounterModel
{
    public int Value { get; private set; }

    public void Increment() => Value++;
    public void Reset()     => Value = 0;
}
```

## ViewModel — `CounterViewModel.cs`

Holds the Model, exposes a **`[Signal]` as bindable state** and **methods as commands**, with no reference to any View node. Inheriting from `GodotObject` is what lets it declare Godot signals; the `partial` keyword is required because Godot's source generator emits the signal plumbing.

```csharp
// CounterViewModel.cs
using Godot;

namespace CounterApp;

public partial class CounterViewModel : GodotObject
{
    // Bindable state: the View connects to this
    [Signal]
    public delegate void DisplayValueChangedEventHandler(string text);

    private readonly CounterModel _model = new();

    // Commands
    public void IncrementCommand()
    {
        _model.Increment();
        Sync();
    }

    public void ResetCommand()
    {
        _model.Reset();
        Sync();
    }

    // Push the initial state after the View has connected
    public void NotifyInitial() => Sync();

    private void Sync()
    {
        // ViewModel owns presentation formatting
        EmitSignal(SignalName.DisplayValueChanged, $"Counter = {_model.Value}");
    }
}
```

## View — `CounterView.cs`

Binds to the ViewModel's signal and routes button presses to its commands. Knows the ViewModel; the ViewModel never knows it back.

```csharp
// CounterView.cs
using Godot;

namespace CounterApp;

public partial class CounterView : Control
{
    private Label _label;
    private Button _incrementButton;
    private Button _resetButton;

    private CounterViewModel _viewModel;

    public override void _Ready()
    {
        _label           = GetNode<Label>("Label");
        _incrementButton = GetNode<Button>("IncrementButton");
        _resetButton     = GetNode<Button>("ResetButton");

        _viewModel = new CounterViewModel();

        // The binding: re-render whenever state changes
        _viewModel.DisplayValueChanged += OnDisplayValueChanged;

        // Wire UI events directly to ViewModel commands
        _incrementButton.Pressed += _viewModel.IncrementCommand;
        _resetButton.Pressed     += _viewModel.ResetCommand;

        _viewModel.NotifyInitial();   // shows "Counter = 0"
    }

    private void OnDisplayValueChanged(string text) => _label.Text = text;

    public override void _ExitTree()
    {
        // GodotObject isn't ref-counted; free it explicitly to avoid a leak
        _viewModel?.Free();
    }
}
```

## C#-specific notes versus the GDScript version

The signal-to-command wiring is even cleaner here. `_incrementButton.Pressed += _viewModel.IncrementCommand` is a plain C# event subscription—Godot exposes built-in signals like `Pressed` as C# events, so you append a handler with `+=` and no string names are involved.

The memory caveat changes shape. In GDScript the ViewModel was `RefCounted`, so it cleaned itself up. Here I used `GodotObject`, which is **not** reference-counted, so I free it explicitly in `_ExitTree()`. You have two ways to avoid the manual `Free()`:

The first is to make the ViewModel a `RefCounted` instead of `GodotObject`—then it's released automatically once the View's `_viewModel` field drops, matching the GDScript behavior exactly. `RefCounted` still supports `[Signal]`, so you lose nothing.

The second, and arguably the most idiomatic C# approach, is to skip Godot signals entirely for the ViewModel and use a plain C# `event Action<string>`:

```csharp
// Alternative ViewModel state — pure C#, no Godot base class needed
public event Action<string> DisplayValueChanged;

private void Sync()
    => DisplayValueChanged?.Invoke($"Counter = {_model.Value}");
```

That lets the ViewModel inherit from nothing (or be a pure POCO), which is the cleanest separation of all—your ViewModel and Model become ordinary C# objects with zero Godot dependencies, so they're trivially unit-testable outside the engine. The only reason to prefer Godot's `[Signal]` over a C# `event` is if you want the signal to be connectable from the Godot editor or from GDScript; for View↔ViewModel binding that's rarely needed, so a C# `event` is often the better fit.

If you're building something real with this, the POCO-plus-`event` style scales best: keep `CounterModel` and `CounterViewModel` free of Godot base classes, and let only the View touch the engine. Want me to show that fully decoupled version, or move on to wiring multiple ViewModels to a shared autoload Model?