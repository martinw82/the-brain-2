# The Brain — Test Suite

Comprehensive test coverage for The Brain v2.0

## Quick Start

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- uri.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run critical path tests only
npm run test:critical

# Run comprehensive test suite
node scripts/run-tests.js
```

## Test Structure

```
src/__tests__/
├── index.test.js              # Test suite verification
├── agents.test.js             # Agent registry
├── workflows.test.js          # Workflow engine
├── memory.test.js             # Memory system
├── summaries.test.js          # L0/L1 summaries
├── retrieval.test.js          # Directory retrieval
├── agentFunctions.test.js     # Function calling
├── utils/
│   ├── uri.test.js           # URI parsing
│   ├── modeHelper.test.js    # Assistance modes
│   ├── projectFactory.test.js # Project creation
│   └── constants.test.js     # Design tokens
├── hooks/
│   ├── useUndoRedo.test.js   # Undo/redo
│   └── useBreakpoint.test.js # Responsive
├── components/
│   └── UI/
│       └── SmallComponents.test.jsx  # UI primitives
└── integration/
    ├── api.test.js           # API client
    └── critical-path.test.js # Data integrity
```

## Test Categories

### Unit Tests (~90 tests)
- **Utilities**: URI, modes, constants, project factory
- **Hooks**: useUndoRedo, useBreakpoint
- **Services**: Agents, workflows, memory, summaries
- **Components**: UI primitives

### Integration Tests (~25 tests)
- **API Client**: Authentication, CRUD, error handling
- **Critical Path**: Database integrity (in scripts/test-critical.js)

### Total: 130+ tests

## Coverage Goals

| Module | Target | Status |
|--------|--------|--------|
| Utils | 80% | 🟡 In Progress |
| Hooks | 70% | 🟡 In Progress |
| Services | 60% | 🟡 In Progress |
| Components | 50% | 🟡 In Progress |
| API | 60% | 🟡 In Progress |

## Writing Tests

### Test Pattern

```javascript
import { renderHook, act } from '@testing-library/react';
import useMyHook from '../../hooks/useMyHook';

describe('useMyHook', () => {
  it('should do something', () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.someAction();
    });
    
    expect(result.current.someValue).toBe('expected');
  });
});
```

### Mocking API Calls

```javascript
jest.mock('../api.js', () => ({
  projects: {
    list: jest.fn(),
  },
}));

projects.list.mockResolvedValue({ projects: [] });
```

### Testing Components

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Critical Path Tests

The most important tests verify data integrity:

1. **File Save/Load Round-Trip**: Content preserved exactly
2. **Comment Persistence**: Comments survive reload
3. **Session Logging**: Duration and project association correct

Run via: `npm run test:critical`

## Continuous Integration

Tests run on:
- Pre-commit (via Husky)
- Pull request
- Deployment

## Known Limitations

- Some async operations have race conditions (documented in code)
- Optimistic updates not fully tested for rollback scenarios
- Browser APIs (File System Access) mocked but not fully tested
