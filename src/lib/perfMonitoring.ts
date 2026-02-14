type PerfSnapshot = {
  marks: Record<string, number>;
  measures: Record<string, number>;
  paints: Record<string, number>;
  navStart: number;
};

const snap: PerfSnapshot = {
  marks: {},
  measures: {},
  paints: {},
  navStart: performance.timeOrigin || performance.timing?.navigationStart || Date.now(),
};

export const markPerf = (name: string) => {
  try {
    performance.mark(name);
    const entries = performance.getEntriesByName(name, 'mark');
    const last = entries[entries.length - 1] as any;
    if (last?.startTime != null) snap.marks[name] = last.startTime;
  } catch {}
};

export const measurePerf = (name: string, startMark: string, endMark: string) => {
  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1] as any;
    if (last?.duration != null) snap.measures[name] = last.duration;
  } catch {}
};

export const getPerfSnapshot = (): PerfSnapshot => ({ ...snap, marks: { ...snap.marks }, measures: { ...snap.measures }, paints: { ...snap.paints } });

export const initPerfMonitoring = () => {
  (window as any).__bw_perf = getPerfSnapshot();

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry?.name) {
          snap.paints[entry.name] = entry.startTime;
        }
      }
      (window as any).__bw_perf = getPerfSnapshot();
    });
    po.observe({ type: 'paint', buffered: true } as any);
  } catch {}

  try {
    const poLcp = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last?.startTime != null) snap.paints['largest-contentful-paint'] = last.startTime;
      (window as any).__bw_perf = getPerfSnapshot();
    });
    poLcp.observe({ type: 'largest-contentful-paint', buffered: true } as any);
  } catch {}
};

