export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  status: DigestStatus;
  error: string | null;
  firstAt: string;
  lastAt: string;
};

export declare function readNight(runsDir: string, night: string): DigestRow[];
