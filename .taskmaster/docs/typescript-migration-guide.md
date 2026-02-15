# TypeScript Migration Guide for InstUI Components

Comprehensive guide for converting JavaScript/JSX files importing InstUI to TypeScript.

## Table of Contents

1. [File Renaming](#file-renaming)
2. [Import Patterns](#import-patterns)
3. [React Component Patterns](#react-component-patterns)
4. [Event Handler Typing](#event-handler-typing)
5. [Canvas-Specific Patterns](#canvas-specific-patterns)
6. [Common Type Suppressions](#common-type-suppressions)
7. [Forbidden Patterns](#forbidden-patterns)
8. [Testing](#testing)

---

## File Renaming

### Simple Rule

- `.js` → `.ts` for utility files and non-React code
- `.jsx` → `.tsx` for React components

### Examples

```bash
# React components
ui/features/canvas_career/index.jsx → index.tsx
ui/features/dashboard/react/DashboardHeader.jsx → DashboardHeader.tsx

# Utility files
ui/features/helpers/utils.js → utils.ts
```

---

## Import Patterns

### InstUI Components (Already Typed)

InstUI components are already fully typed - no additional work needed:

```typescript
// Before (JS)
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'

// After (TS) - Same! Types are built-in
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
```

### InstUI Type Imports

Use `type` import for InstUI type-only imports:

```typescript
// Component props types
import type {ButtonProps} from '@instructure/ui-buttons'
import type {ViewProps} from '@instructure/ui-view'

// Event types
import type {ViewOwnProps} from '@instructure/ui-view'
```

### Canvas Modules

Canvas modules may or may not be typed:

```typescript
import {useScope as createI18nScope} from '@canvas/i18n'
import useDateTimeFormat from '@canvas/use-date-time-format-hook'

// If untyped, use @ts-expect-error at import
// @ts-expect-error - legacy module without types
import LegacyHelper from '@canvas/legacy-helper'
```

---

## React Component Patterns

### Function Components with Props

**Pattern 1: Simple Props Interface**

```typescript
interface MyComponentProps {
  title: string
  count: number
  onSubmit: (data: FormData) => void
  children?: React.ReactNode
}

export default function MyComponent({
  title,
  count,
  onSubmit,
  children,
}: MyComponentProps): React.JSX.Element {
  return (
    <View as="div">
      <Heading>{title}</Heading>
      <Text>Count: {count}</Text>
      {children}
    </View>
  )
}
```

**Pattern 2: With Optional Props**

```typescript
interface CardProps {
  title: string
  subtitle?: string // Optional
  variant?: 'default' | 'success' | 'danger' // Union type
  isLoading?: boolean
}

export default function Card({
  title,
  subtitle,
  variant = 'default', // Default value
  isLoading = false,
}: CardProps): React.JSX.Element {
  // ...
}
```

**Pattern 3: With Callback Props**

```typescript
interface FormProps {
  initialValues: Record<string, string>
  onSubmit: (values: Record<string, string>) => void
  onCancel?: () => void
  onFieldChange?: (field: string, value: string) => void
}

export default function Form({
  initialValues,
  onSubmit,
  onCancel,
  onFieldChange,
}: FormProps): React.JSX.Element {
  // ...
}
```

### Return Type

Always use `React.JSX.Element` for component return type:

```typescript
// ✅ Correct
export default function MyComponent(): React.JSX.Element {
  return <div>Hello</div>
}

// ❌ Don't use React.FC
export default const MyComponent: React.FC = () => {
  return <div>Hello</div>
}
```

---

## Event Handler Typing

### Standard HTML Events

```typescript
// Mouse events
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault()
  console.log('clicked')
}

// Input events
const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  setValue(event.target.value)
}

// Form events
const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  // ...
}

// Keyboard events
const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') {
    // ...
  }
}
```

### InstUI Event Handlers

InstUI components often have custom event signatures. When the type is complex or unclear, use `@ts-expect-error`:

```typescript
import {SimpleSelect} from '@instructure/ui-simple-select'

// Option 1: Explicit typing (if you know the type)
const handleSelect = (
  event: React.SyntheticEvent,
  data: {value: string; id: string}
) => {
  setValue(data.value)
}

// Option 2: Use @ts-expect-error (when type is complex)
// @ts-expect-error - InstUI event signature
const handleSelect = (event, {value, id}) => {
  setValue(value)
}

<SimpleSelect onChange={handleSelect}>
  {/* options */}
</SimpleSelect>
```

**Common InstUI Event Patterns:**

```typescript
// Select/Dropdown onChange
// @ts-expect-error - InstUI Select event
const handleChange = (event, {value}) => {
  setValue(value)
}

// Tabs onChange
// @ts-expect-error - InstUI Tabs event
const handleTabChange = (event, {index}) => {
  setSelectedIndex(index)
}

// DateInput onChange
// @ts-expect-error - InstUI DateInput event
const handleDateChange = (event, dateString) => {
  setDate(dateString)
}
```

---

## Canvas-Specific Patterns

### window.ENV Access

Canvas uses `window.ENV` for page-specific configuration. Most ENV properties aren't in the global type definition:

```typescript
// ✅ Correct: Use @ts-expect-error for page-specific ENV properties
// @ts-expect-error - page-specific ENV
const courseId = window.ENV.COURSE_ID

// @ts-expect-error - page-specific ENV
const userId = window.ENV.current_user_id

// @ts-expect-error - feature flag
const isFeatureEnabled = window.ENV.FEATURE_FLAG_NAME
```

**Multiple ENV accesses:**

```typescript
function loadConfig() {
  return {
    // @ts-expect-error - page-specific ENV
    courseId: window.ENV.COURSE_ID,
    // @ts-expect-error - page-specific ENV
    userId: window.ENV.current_user_id,
    // @ts-expect-error - page-specific ENV
    contextAssetString: window.ENV.context_asset_string,
  }
}
```

### I18n (Internationalization)

```typescript
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('feature_name')

// Type: (key: string, options?: Record<string, unknown>) => string
const text = I18n.t('Submit')
const greeting = I18n.t('Welcome, %{name}', {name: userName})
```

### jQuery Integration (Legacy)

When dealing with jQuery in TypeScript files:

```typescript
// @ts-expect-error - jQuery integration
$('#element').trigger('change')

// @ts-expect-error - jQuery plugin
$(element).somePlugin({option: 'value'})
```

### Canvas API Calls

Use `@canvas/do-fetch-api-effect` for API calls:

```typescript
import {doFetchApi} from '@canvas/do-fetch-api-effect'

// doFetchApi returns untyped JSON - use @ts-expect-error
// @ts-expect-error - untyped API response
const {json} = await doFetchApi({
  path: `/api/v1/courses/${courseId}`,
})

// Or: Define response type and assert
interface Course {
  id: string
  name: string
}

const {json} = await doFetchApi<Course>({
  path: `/api/v1/courses/${courseId}`,
})
```

---

## Common Type Suppressions

### When to Use `@ts-expect-error`

Use `@ts-expect-error` with a brief explanation when:

1. **Canvas ENV globals** - Page-specific properties not in global type
2. **Legacy jQuery** - jQuery integration in TypeScript files
3. **InstUI event signatures** - Complex/undocumented event types
4. **Untyped Canvas modules** - Legacy modules without TypeScript support
5. **doFetchApi responses** - Untyped JSON responses

### Format

Always include a brief explanation:

```typescript
// ✅ Good: Clear explanation
// @ts-expect-error - page-specific ENV
const courseId = window.ENV.COURSE_ID

// @ts-expect-error - InstUI Select event signature
const handleChange = (event, {value}) => setValue(value)

// ❌ Bad: No explanation
// @ts-expect-error
const courseId = window.ENV.COURSE_ID
```

### Grouping Suppressions

When multiple related suppressions, group them:

```typescript
function initializeSpeedGrader() {
  return {
    // @ts-expect-error - SpeedGrader ENV properties
    emojisDenyList: window.ENV.EMOJI_DENY_LIST?.split(',') || [],
    // @ts-expect-error
    fixedWarnings: window.ENV.fixed_warnings || [],
    // @ts-expect-error
    canViewAllGrades: window.ENV.VIEW_ALL_GRADES ?? false,
    // @ts-expect-error
    showInactiveEnrollments: window.ENV.show_inactive_enrollments ?? false,
  }
}
```

---

## Forbidden Patterns

### ❌ NEVER Use These

#### 1. Type Assertions with `as` (except `as const`)

```typescript
// ❌ Forbidden
const value = data as string
const element = document.querySelector('.foo') as HTMLElement

// ✅ Allowed: as const for literals
const COLORS = ['red', 'blue', 'green'] as const

// ✅ Better: Use @ts-expect-error if type is wrong
// @ts-expect-error - complex type from untyped module
const value = data
```

#### 2. `any` Type

```typescript
// ❌ Forbidden
function process(data: any) {
  return data.value
}

const items: any[] = []

// ✅ Better: Use unknown
function process(data: unknown) {
  // @ts-expect-error - untyped external data
  return data.value
}

// ✅ Better: Use proper types
interface Item {
  id: string
  name: string
}
const items: Item[] = []

// ✅ Better: Use @ts-expect-error
// @ts-expect-error - legacy untyped function
function legacyProcess(data) {
  return data.value
}
```

#### 3. Non-null Assertions (`!`)

Avoid when possible - use @ts-expect-error or proper null checking instead:

```typescript
// ❌ Avoid
const element = document.getElementById('foo')!

// ✅ Better: Null check
const element = document.getElementById('foo')
if (element) {
  // use element
}

// ✅ Better: @ts-expect-error if you're certain
// @ts-expect-error - element guaranteed to exist
const element = document.getElementById('foo')
```

---

## Testing

### Test File Extensions

- Test files remain `.test.js` or `.test.jsx` for now
- Focus migration on production code first
- Tests can be migrated later as a separate effort

### If You Do Migrate Tests

```typescript
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test" count={5} onSubmit={() => {}} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('calls onSubmit when button clicked', async () => {
    const handleSubmit = jest.fn()
    render(<MyComponent title="Test" count={5} onSubmit={handleSubmit} />)

    await userEvent.click(screen.getByRole('button', {name: /submit/i}))
    expect(handleSubmit).toHaveBeenCalled()
  })
})
```

---

## Checklist

When migrating a file:

- [ ] Rename `.jsx` → `.tsx` or `.js` → `.ts`
- [ ] Add prop interface for React components
- [ ] Define return type as `React.JSX.Element`
- [ ] Type event handlers or use `@ts-expect-error`
- [ ] Add `@ts-expect-error` for ENV access with explanation
- [ ] Add `@ts-expect-error` for jQuery/legacy code
- [ ] Add `@ts-expect-error` for InstUI events if needed
- [ ] Verify no `as` casts (except `as const`)
- [ ] Verify no `any` types
- [ ] Run `eslint` and fix issues
- [ ] Run `yarn biome:fix`
- [ ] Run `npx tsc --noEmit` and verify no errors (use suppressions if needed)

---

## Examples

### Complete Migration Example

**Before (JS):**

```jsx
// ui/features/canvas_career/index.jsx
import React, {useState} from 'react'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {TextInput} from '@instructure/ui-text-input'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('canvas_career')

export default function CanvasCareer({userId, onComplete}) {
  const [name, setName] = useState('')

  const handleChange = (event, value) => {
    setName(value)
  }

  const handleSubmit = () => {
    const apiUrl = ENV.CANVAS_CAREER_API_URL
    onComplete(name)
  }

  return (
    <View as="div" padding="medium">
      <TextInput
        renderLabel={I18n.t('Name')}
        value={name}
        onChange={handleChange}
      />
      <Button onClick={handleSubmit}>
        {I18n.t('Submit')}
      </Button>
    </View>
  )
}
```

**After (TS):**

```tsx
// ui/features/canvas_career/index.tsx
import React, {useState} from 'react'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {TextInput} from '@instructure/ui-text-input'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('canvas_career')

interface CanvasCareerProps {
  userId: string
  onComplete: (name: string) => void
}

export default function CanvasCareer({
  userId,
  onComplete,
}: CanvasCareerProps): React.JSX.Element {
  const [name, setName] = useState('')

  // @ts-expect-error - InstUI TextInput event signature
  const handleChange = (event, value) => {
    setName(value)
  }

  const handleSubmit = () => {
    // @ts-expect-error - page-specific ENV
    const apiUrl = window.ENV.CANVAS_CAREER_API_URL
    onComplete(name)
  }

  return (
    <View as="div" padding="medium">
      <TextInput
        renderLabel={I18n.t('Name')}
        value={name}
        onChange={handleChange}
      />
      <Button onClick={handleSubmit}>{I18n.t('Submit')}</Button>
    </View>
  )
}
```

**Changes Made:**

1. Renamed `.jsx` → `.tsx`
2. Added `CanvasCareerProps` interface
3. Typed function parameters with props interface
4. Added return type `React.JSX.Element`
5. Added `@ts-expect-error` for InstUI event
6. Added `@ts-expect-error` for ENV access with `window.` prefix
7. No `as` casts, no `any` types

---

## Tips

1. **Start simple**: Begin with files that have minimal complexity
2. **Incremental approach**: Add types gradually, using `@ts-expect-error` liberally
3. **Don't over-engineer**: Modest effort on types, suppressions are fine
4. **Follow existing patterns**: Look at other `.tsx` files in Canvas for examples
5. **Run validation early**: Test with `tsc --noEmit` frequently
6. **Biome auto-fix**: Run `yarn biome:fix` to auto-format

## Resources

- **Canvas UI Guide**: `/Users/ashafovaloff/inst/canvas-lms-readonly/ui/CLAUDE.md`
- **InstUI Docs**: https://instructure.design
- **React TypeScript Cheatsheet**: https://react-typescript-cheatsheet.netlify.app/
- **Canvas TypeScript Examples**: `find ui/features -name "*.tsx" | head -10`
