export const jobRegistry = new Map<
  string,
  {
    jobId: string;
    agentId: string;
    type: 'domain' | 'url';
    target: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    currentStep?: string;
    createdAt: string;
    lastUpdate: string;
    completedAt?: string;
    report?: any;
    error?: string;
    logs?: Array<{time: string, msg: string, type: string}>;
  }
>();
