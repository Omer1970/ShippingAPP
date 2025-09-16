export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface LoadingStatus {
  state: LoadingState;
  error?: string;
  message?: string;
}