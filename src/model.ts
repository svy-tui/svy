export type Unit = '%' | 'kB/s' | 'kB' | '/s' | 'load';

export interface Channel {
  name: string;
  values: (number | null)[];
}

export interface Instance {
  name: string;
  channels: Channel[];
}

export interface Metric {
  id: string;
  label: string;
  unit: Unit;
  instances: Instance[];
}

export interface HostData {
  nodename: string;
  sysname?: string;
  release?: string;
  machine?: string;
  cpuCount?: number;
  fileDate?: string;
  timeLabels: string[];
  epochs: number[];
  metrics: Metric[];
}
