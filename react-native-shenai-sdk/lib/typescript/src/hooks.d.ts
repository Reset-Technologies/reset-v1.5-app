/**
 * Hook to continuously fetch the heart rate computed from the last 10 seconds of video.
 *
 * @returns The latest heart rate in BPM or null if uninitialized/error/bad signal.
 */
export declare const useRealtimeHeartRate: () => number | null;
/**
 * Hook to continuously fetch the heart rate computed from the last 4 seconds of video.
 *
 * @returns The latest heart rate in BPM or null if uninitialized/error/bad signal.
 */
export declare const useRealtimeHeartRate4s: () => number | null;
/**
 * Hook to get realtime metrics of the measurement computed from the last `period_sec` seconds of video.
 *
 * @param period_sec Duration in seconds of the period of interest.
 * @returns The latest realtime metrics or null if uninitialized/error/bad signal.
 */
export declare const useRealtimeMetrics: (period_sec: number) => import("./index").MeasurementResults | null;
/**
 * Hook to get results of the measurement.
 *
 * @returns The latest measurement results or null if the measurement hasn't finished yet.
 */
export declare const useMeasurementResults: () => import("./index").MeasurementResults | null;
/**
 * Hook to get the measurement progress percentage.
 *
 * @returns The current measurement progress percentage.
 */
export declare const useMeasurementProgress: (update_interval_ms?: number) => number | null;
/**
 * Hook to get the realtime heartbeats.
 *
 * @returns The latest heartbeats or null if uninitialized/error/bad signal.
 */
export declare const useRealtimeHeartbeats: () => import("./index").Heartbeat[] | null;
//# sourceMappingURL=hooks.d.ts.map