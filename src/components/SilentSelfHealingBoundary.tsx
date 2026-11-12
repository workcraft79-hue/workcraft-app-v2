import React from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';

interface SilentSelfHealingBoundaryProps {
  areaName: string;
  children: React.ReactNode;
  onSilentRecovered?: (detail: { areaName: string; message: string; timestamp: string }) => void;
}

interface SilentSelfHealingBoundaryState {
  hasError: boolean;
  recoverCount: number;
}

export class SilentSelfHealingBoundary extends React.Component<
  SilentSelfHealingBoundaryProps,
  SilentSelfHealingBoundaryState
> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: SilentSelfHealingBoundaryProps) {
    super(props);
    this.state = { hasError: false, recoverCount: 0 };
  }

  static getDerivedStateFromError(): Partial<SilentSelfHealingBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onSilentRecovered?.({
      areaName: this.props.areaName,
      message: error.message || 'Recovered view glitch automatically',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    // Silently auto-recover within 800ms so field agents, salon owners, and founders never see a broken screen
    this.resetTimer = setTimeout(() => {
      this.setState((prev) => ({
        hasError: false,
        recoverCount: prev.recoverCount + 1,
      }));
    }, 800);
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-[#116329] bg-[#161B22] p-6 text-center space-y-2.5 max-w-md mx-auto my-8">
          <div className="mx-auto size-10 rounded-xl border border-[#116329] bg-[#0D3822] grid place-items-center text-[#3FB950]">
            <RefreshCw className="size-5 animate-spin" />
          </div>
          <p className="text-sm font-bold text-[#F0F6FC] flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-4 text-[#3FB950]" />
            <span>Refreshing {this.props.areaName}...</span>
          </p>
          <p className="text-xs text-[#8B949E] font-sans">
            System detected a display hiccup and restored your screen automatically.
          </p>
        </div>
      );
    }

    return <React.Fragment key={this.state.recoverCount}>{this.props.children}</React.Fragment>;
  }
}
