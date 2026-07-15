import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error in UI:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui', textAlign: 'center' }}>
          <h2 style={{ color: '#374151', fontSize: 24, marginBottom: 8 }}>Something went wrong.</h2>
          {this.state.error && (
            <pre style={{ textAlign: 'left', display: 'inline-block', padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
              {this.state.error}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;