# Inbox UI Enhancements Implementation Plan

This plan documents the changes to improve layout consistency and space utilization in the Inbox UI.

## Problem Statement

The current Inbox UI has three main areas for improvement:
1. The left panel holding the task list is resizable via a drag handle, which is unnecessary and can lead to awkward layouts. It should be a fixed width.
2. Inside the Task Details view, the "Activity" tab displays Processing Logs and Workflow Logs stacked vertically with excessive whitespace on larger screens.
3. The Action cards (containing the claim/release/decide buttons) live within the scrolling tab content, meaning users have to scroll to the bottom of the content to see their actionable options. This should be sticky across all tabs.

## Proposed Changes

### 1. Make Left Panel Fixed Width
**File:** `d:\DEV\cnma_vj_my_inbox\app\cnma_vj_my_inbox_ui\src\pages\InboxPageNext.tsx`

We will remove the `ResizablePanel` component from the desktop view. Instead, we'll implement a clean `flex` layout where the left panel has a set width (`w-[380px]`) and the right panel flexibly consumes remaining space (`flex-1`).

_Example Change:_
```tsx
return (
    <div className="h-screen bg-slate-100/80">
        <div className="flex h-full">
            <aside className="w-[380px] shrink-0 border-r border-border/60 bg-background overflow-hidden relative">
                <TaskList ... />
            </aside>
            <main className="flex-1 min-w-0 overflow-hidden bg-slate-50/70 relative">
                <TaskDetailView ... />
            </main>
        </div>
    </div>
);
```

### 2. Grid Layout for Activity Tab
**File:** `d:\DEV\cnma_vj_my_inbox\app\cnma_vj_my_inbox_ui\src\components\inbox\TaskDetailPanels.tsx`

In the `ActivityPanel` component, we will replace the vertical stack with a responsive grid.

_Example Change:_
```tsx
// Before:
<div className="space-y-4">

// After:
<div className="grid gap-4 md:grid-cols-2">
```
This forces the timeline cards (Processing Logs and Workflow Logs) to position side-by-side on wide screens.

### 3. Sticky Actions Card Footer
**File:** `d:\DEV\cnma_vj_my_inbox\app\cnma_vj_my_inbox_ui\src\components\inbox\TaskDetailView.tsx`

We will reposition the `TaskActionPanel` out of the central `<ScrollArea>` so it persists as a footer for all tabs.

_Example Change:_
```tsx
<div className="flex h-full flex-col bg-slate-50/70">
    <div className="border-b px-5 py-4 bg-background"> Header </div>
    
    <div className="flex-1 flex flex-col min-h-0">
        {/* Desktop and Mobile Tabs/ScrollArea Content */}
        {...}
    </div>

    {/* New Persistent Footer for Actions Card */}
    <div className="shrink-0 border-t border-border/60 bg-background/95 p-4 z-10 hidden empty:hidden">
        <TaskActionPanel
            detail={detail}
            onDecision={onDecision}
            isExecuting={isExecuting}
            onClaim={onClaim}
            onRelease={onRelease}
        />
    </div>
</div>
```

*Note: Since `TaskActionPanel` returns `null` when no actions exist, setting it in a footer with `empty:hidden` will ensure we don't display a blank reserved footer space.*

## Verification Plan

- Resize the browser window to confirm the left panel remains fixed width and details pane adapts.
- Open a task, enter the Activity tab, and ensure timelines sit on a two-column grid.
- Select different tabs; observe that the Actions card is consistently anchored to the bottom of the details pane without requiring a scroll.
