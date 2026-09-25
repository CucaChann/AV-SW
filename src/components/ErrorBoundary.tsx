import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Discards the recovery copy and starts over, breaking a crash-on-launch loop. */
  onStartOver: () => void;
};

type State = { error: Error | null };

/** Shows a way out instead of a blank window when rendering fails. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("AV-SW hit an unexpected error", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="app-crash" role="alert">
        <h1>AV-SW hit a problem</h1>
        <p className="app-crash-detail">{error.message}</p>
        <p>
          Project files saved on disk are not affected. Starting a new project
          discards the unsaved recovery copy that may have caused this.
        </p>
        <div className="app-crash-actions">
          <button onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="primary" onClick={this.props.onStartOver}>
            Start a new project
          </button>
        </div>
      </main>
    );
  }
}
