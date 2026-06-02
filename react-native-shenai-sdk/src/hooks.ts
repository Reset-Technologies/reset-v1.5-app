import { useState, useEffect, useCallback } from "react";

import {
  isInitialized,
  getHeartRate4s,
  getHeartRate10s,
  getRealtimeMetrics,
  getMeasurementResults,
  getMeasurementProgressPercentage,
  getRealtimeHeartbeats,
} from "./index";

/**
 * Type utility to unwrap the type from a Promise.
 * @template T - The promise type to be unwrapped.
 */
type UnwrappedPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Custom hook for polling data from the Shen.AI SDK.
 *
 * @template T - The type of the fetch function.
 * @param {T} fetchFunction - The function to fetch data from the SDK.
 * @param {number} intervalDuration - The duration between each data fetch in milliseconds.
 * @returns {UnwrappedPromise<ReturnType<T>> | null} - The latest fetched data or null if uninitialized or on error.
 */
const useSDKPolling = <T extends (...args: any[]) => Promise<any>>(
  fetchFunction: T,
  intervalDuration: number,
): UnwrappedPromise<ReturnType<T>> | null => {
  const [data, setData] = useState<UnwrappedPromise<ReturnType<T>> | null>(
    null,
  );

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const isInit = await isInitialized();
        if (!isInit) {
          setData(null);
          return;
        }
        const fetchedData = await fetchFunction();
        setData(fetchedData ?? null);
      } catch (error) {
        console.error("Error fetching data:", error);
        setData(null);
      }
    }, intervalDuration);

    return () => clearInterval(intervalId);
  }, [fetchFunction, intervalDuration]);

  return data;
};

/**
 * Hook to continuously fetch the heart rate computed from the last 10 seconds of video.
 *
 * @returns The latest heart rate in BPM or null if uninitialized/error/bad signal.
 */
export const useRealtimeHeartRate = () => useSDKPolling(getHeartRate10s, 1000);

/**
 * Hook to continuously fetch the heart rate computed from the last 4 seconds of video.
 *
 * @returns The latest heart rate in BPM or null if uninitialized/error/bad signal.
 */
export const useRealtimeHeartRate4s = () => useSDKPolling(getHeartRate4s, 1000);

/**
 * Hook to get realtime metrics of the measurement computed from the last `period_sec` seconds of video.
 *
 * @param period_sec Duration in seconds of the period of interest.
 * @returns The latest realtime metrics or null if uninitialized/error/bad signal.
 */
export const useRealtimeMetrics = (period_sec: number) => {
  const callback = useCallback(
    () => getRealtimeMetrics(period_sec),
    [period_sec],
  );
  return useSDKPolling(callback, 1000);
};

/**
 * Hook to get results of the measurement.
 *
 * @returns The latest measurement results or null if the measurement hasn't finished yet.
 */
export const useMeasurementResults = () =>
  useSDKPolling(getMeasurementResults, 1000);

/**
 * Hook to get the measurement progress percentage.
 *
 * @returns The current measurement progress percentage.
 */
export const useMeasurementProgress = (update_interval_ms: number = 1000) =>
  useSDKPolling(getMeasurementProgressPercentage, update_interval_ms);

/**
 * Hook to get the realtime heartbeats.
 *
 * @returns The latest heartbeats or null if uninitialized/error/bad signal.
 */
export const useRealtimeHeartbeats = () =>
  useSDKPolling(getRealtimeHeartbeats, 1000);
