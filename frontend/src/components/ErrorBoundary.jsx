import { Component } from 'react';
import StatusPage from './StatusPage';

// Catches an error thrown while rendering anywhere below it and shows a friendly page instead of
// a blank screen. The error itself is logged for developers but never shown to the visitor.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <StatusPage
        eyebrow="Something went wrong"
        code="Oops"
        title="That didn't go as planned"
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <a className="btn btn-secondary" href="/">
              Go to home
            </a>
          </>
        }
      >
        An unexpected error stopped this page from loading. Try reloading it, and if it keeps happening, please let
        the clinic know.
      </StatusPage>
    );
  }
}
