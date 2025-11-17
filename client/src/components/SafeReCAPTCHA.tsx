import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

type NativeProps = React.ComponentProps<typeof ReCAPTCHA>;

interface SafeReCAPTCHAProps extends NativeProps {
  fallbackMessage?: string;
  onBoundaryError?: (error: Error) => void;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  onBoundaryError?: (error: Error) => void;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ReCAPTCHAErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('reCAPTCHA failed to render:', error, info);
    if (this.props.onBoundaryError) {
      this.props.onBoundaryError(error);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      prevProps.resetKey !== this.props.resetKey &&
      this.state.hasError
    ) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="recaptcha-fallback">
          {this.props.fallbackMessage ||
            'reCAPTCHA failed to load. Please refresh and try again.'}
        </div>
      );
    }
    return this.props.children;
  }
}

const SafeReCAPTCHA: React.FC<SafeReCAPTCHAProps> = ({
  fallbackMessage,
  onBoundaryError,
  ...recaptchaProps
}) => (
  <ReCAPTCHAErrorBoundary
    fallbackMessage={fallbackMessage}
    onBoundaryError={onBoundaryError}
    resetKey={recaptchaProps.sitekey}
  >
    <ReCAPTCHA {...recaptchaProps} />
  </ReCAPTCHAErrorBoundary>
);

export default SafeReCAPTCHA;


