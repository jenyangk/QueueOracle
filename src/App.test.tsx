import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the main title', () => {
    render(<App />)
    expect(screen.getByText('Azure Service Bus Explorer v2.0.0')).toBeInTheDocument()
  })

  it('shows service bus explorer section', () => {
    render(<App />)
    expect(screen.getByText('Service Bus Explorer')).toBeInTheDocument()
  })

  it('shows chirpstack analytics section', () => {
    render(<App />)
    expect(screen.getByText('Chirpstack Analytics')).toBeInTheDocument()
  })

  it('displays system status', () => {
    render(<App />)
    expect(screen.getByText('System Status')).toBeInTheDocument()
  })
})