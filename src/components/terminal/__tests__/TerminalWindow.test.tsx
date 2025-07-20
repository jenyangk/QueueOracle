import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { TerminalWindow } from '../TerminalWindow';

describe('TerminalWindow', () => {
  it('renders with title and status', () => {
    render(
      <TerminalWindow title="Test Terminal" status="connected">
        <div>Test content</div>
      </TerminalWindow>
    );

    expect(screen.getByText('[TEST TERMINAL]')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('displays correct status indicator', () => {
    const { rerender } = render(
      <TerminalWindow title="Test" status="connected">
        Content
      </TerminalWindow>
    );

    expect(screen.getByText('●')).toBeInTheDocument();

    rerender(
      <TerminalWindow title="Test" status="disconnected">
        Content
      </TerminalWindow>
    );

    expect(screen.getByText('○')).toBeInTheDocument();

    rerender(
      <TerminalWindow title="Test" status="error">
        Content
      </TerminalWindow>
    );

    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('renders action buttons when provided', () => {
    const mockAction = vi.fn();
    const actions = [
      {
        label: 'Connect',
        command: 'connect',
        onClick: mockAction,
      },
    ];

    render(
      <TerminalWindow title="Test" status="disconnected" actions={actions}>
        Content
      </TerminalWindow>
    );

    expect(screen.getByText('Connect')).toBeInTheDocument();
  });
});