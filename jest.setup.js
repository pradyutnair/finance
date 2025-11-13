require('@testing-library/jest-dom')

// Mock Plaid module
jest.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({
    open: jest.fn(),
    ready: true,
  }),
}))

// Mock environment variables
process.env.PLAID_CLIENT_ID = 'test-client-id'
process.env.PLAID_SANDBOX_API_KEY = 'test-sandbox-key'
process.env.PLAID_SANDBOX_SECRET = 'test-sandbox-secret'

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})