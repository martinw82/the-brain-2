# The Brain

A personal operating system designed to help users organize their lives through structured project management, goal tracking, and AI-powered coaching.

## Features

- Project management with phases and health scores
- Hierarchical file system with markdown editing
- AI Coach with state-based routing
- Daily tracking and weekly reviews
- Desktop file synchronization
- Offline mode with local storage

## Development

### Prerequisites

- Node.js 24.x
- MySQL-compatible database (TiDB Cloud recommended)

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up database: `npm run db:setup`
4. Run migrations: `npm run db:migrate`
5. Start development server: `npm run dev`

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run test` - Run Jest unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run cypress:open` - Open Cypress for e2e testing
- `npm run cypress:run` - Run Cypress e2e tests
- `npm run test:critical` - Run critical path tests

### Code Quality

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Jest** for unit testing
- **Cypress** for end-to-end testing

Pre-commit hooks ensure code is formatted before commits.

## Deployment

Deploy to Vercel with the included configuration.